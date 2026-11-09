// Test-only module hooks for running server modules under plain Node:
// - "server-only" resolves to an empty stub (Next.js provides the real
//   guard at build time);
// - "@/..." resolves to src/... like jsconfig.json;
// - "next/<subpath>" (headers, server, navigation) resolves to its file
//   (Next.js bundles these at build time; next-auth imports them too).
import { registerHooks } from "node:module";

const root = new URL("../../", import.meta.url);
const stub = new URL("./server-only-stub.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: stub, shortCircuit: true };
    // Next.js subpath without an exports map; Node ESM needs the extension.
    if (/^next\/[a-z-]+$/.test(specifier)) return nextResolve(`${specifier}.js`, context);
    if (specifier.startsWith("@/")) {
      const target = new URL(`src/${specifier.slice(2)}`, root).href;
      return nextResolve(/\.(m?js|json)$/.test(target) ? target : `${target}.js`, context);
    }
    return nextResolve(specifier, context);
  },
});
