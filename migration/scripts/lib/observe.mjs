// Observes the network traffic the admin UI makes on its own while we
// navigate between its documented hash routes. Read-only by design:
//   - records method, path, status, and content type (never headers)
//   - reads bodies only for same-origin GET JSON responses
//   - non-GET requests are recorded as a warning; the UI should not make any
import { LEGACY_ORIGIN } from "./http.mjs";
import { sleep } from "./cdp.mjs";

// Keys removed from any captured body, at any depth.
const SENSITIVE_KEY = /pass(word)?|token|secret|session|cookie|auth|credential|otp|apikey|api_key|hash(ed)?pw|ip(address)?$|useragent|^email$/i;

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, inner]) => [key, redact(inner)]),
    );
  }
  return value;
}

export async function createObserver(page) {
  await page.send("Network.enable", { maxPostDataSize: 0 });
  const requests = new Map();
  const log = [];

  page.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
    requests.set(requestId, { method: request.method, url: request.url, type });
  });
  page.on("Network.responseReceived", ({ requestId, response }) => {
    const entry = requests.get(requestId);
    if (entry) Object.assign(entry, { status: response.status, mimeType: response.mimeType });
  });
  page.on("Network.loadingFinished", ({ requestId }) => {
    const entry = requests.get(requestId);
    if (entry) entry.finished = true;
  });

  // Collect everything that finished since the last call.
  async function drain({ withBodies = true } = {}) {
    const out = [];
    for (const [requestId, entry] of requests) {
      if (!entry.finished) continue;
      requests.delete(requestId);
      const url = new URL(entry.url);
      const record = {
        method: entry.method,
        path: url.origin === LEGACY_ORIGIN ? url.pathname + url.search : `${url.origin}${url.pathname}`,
        status: entry.status,
        mimeType: entry.mimeType,
        resourceType: entry.type,
        sameOrigin: url.origin === LEGACY_ORIGIN,
      };
      if (entry.method !== "GET") record.warning = "non-GET request observed (made by the UI, not by this script)";
      if (withBodies && entry.method === "GET" && record.sameOrigin && /json/.test(entry.mimeType ?? "")) {
        try {
          const { body, base64Encoded } = await page.send("Network.getResponseBody", { requestId });
          record.json = redact(JSON.parse(base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body));
        } catch (error) {
          record.bodyError = String(error.message ?? error);
        }
      }
      out.push(record);
      log.push(record);
    }
    return out;
  }

  // Navigate to a documented admin hash route and wait for it to settle.
  async function visit(hashRoute, settleMs = 2500) {
    await page.evaluate(`location.hash = ${JSON.stringify(hashRoute)}`);
    await sleep(settleMs);
    return drain();
  }

  return { drain, visit, log };
}
