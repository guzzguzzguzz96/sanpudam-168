// Polite HTTP client for the legacy public site: fixed User-Agent,
// spacing between requests, timeouts, and bounded retries.

export const LEGACY_ORIGIN = "https://sanpudam168.1d1d.workers.dev";
const USER_AGENT = "Sanpudam168-Migration/1.0 (owner-authorized extraction)";
const MIN_INTERVAL_MS = 800;
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

let lastRequestAt = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

// Only GET requests to the legacy public origin are allowed here.
export async function politeGet(url, { attempts = 3, timeoutMs = 30000 } = {}) {
  const target = new URL(url);
  if (target.origin !== LEGACY_ORIGIN) {
    throw new Error(`Refusing to fetch outside the legacy origin: ${target.origin}`);
  }
  if (target.pathname.startsWith("/admin") || target.pathname.startsWith("/api/")) {
    throw new Error(`Refusing to fetch a disallowed path: ${target.pathname}`);
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await throttle();
    try {
      const response = await fetch(target, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (RETRYABLE.has(response.status) && attempt < attempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastError ?? new Error(`Request failed: ${url}`);
}
