// Minimal Chrome DevTools Protocol client (Node 24 has a global WebSocket).
// Safety rules for the legacy admin:
//   - never call Network.getCookies / Storage APIs or read request headers
//   - never send or replay requests; only observe what the UI loads itself
//   - only GET response bodies are read, and only from the legacy origin

export const DEBUG_PORT = 9340;

export async function connectToPage({ port = DEBUG_PORT, urlIncludes = "" } = {}) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === "page" && t.url.includes(urlIncludes)) ?? targets.find((t) => t.type === "page");
  if (!page) throw new Error("No browser page found. Start it with admin-browser.mjs first.");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const handler of listeners.get(message.method) ?? []) handler(message.params);
    }
  });

  const forbidden = new Set(["Network.getCookies", "Network.getAllCookies", "Storage.getCookies", "Network.setCookie", "Fetch.continueRequest", "Network.replayXHR"]);
  const send = (method, params = {}) => {
    if (forbidden.has(method)) throw new Error(`Blocked CDP method: ${method}`);
    return new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };
  const on = (method, handler) => listeners.set(method, [...(listeners.get(method) ?? []), handler]);

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };

  return { send, on, evaluate, close: () => ws.close(), url: page.url };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
