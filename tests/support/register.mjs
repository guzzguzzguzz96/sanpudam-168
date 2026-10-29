// Test-only module hooks for running server modules under plain Node:
// - "server-only" resolves to an empty stub (Next.js provides the real
//   guard at build time);
// - "@/..." resolves to src/... like jsconfig.json.
import { registerHooks } from "node:module";

const root = new URL("../../", import.meta.url);
const stub = new URL("./server-only-stub.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: stub, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const target = new URL(`src/${specifier.slice(2)}`, root).href;
      return nextResolve(/\.(m?js|json)$/.test(target) ? target : `${target}.js`, context);
    }
    return nextResolve(specifier, context);
  },
});
