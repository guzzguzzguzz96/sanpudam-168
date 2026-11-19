// Production alias redirect: the Vercel production alias
// (sanpudam-168.vercel.app) answers with a 308 to the custom domain, keeping
// path and query. Pure and dependency-free, so next.config.mjs and tests
// share the same decision.
//
// Applies only when, at build time:
//   VERCEL_ENV === "production"     (Vercel Production deployment)
//   NEXT_PUBLIC_SITE_URL is valid   (https custom domain, via readSiteUrl)
// and only to requests whose Host is exactly the alias. Preview and branch
// URLs (sanpudam-168-git-*.vercel.app, deployment URLs), the custom domain
// itself, and localhost never match. Static assets (/_next/*) and the
// Auth.js endpoints (/api/auth/*) are excluded.
import { readSiteUrl } from "./site-launch.js";

export const PRODUCTION_ALIAS_HOST = "sanpudam-168.vercel.app";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Paths the redirect never touches (path-to-regexp negative lookahead).
const SOURCE = "/:path((?!_next/|api/auth(?:/|$)).*)";

// Rules for next.config.mjs redirects(). Empty unless production + site URL.
export function aliasRedirects(env) {
  if (env?.VERCEL_ENV !== "production") return [];
  const site = readSiteUrl(env);
  if (!site || site.protocol !== "https:" || site.hostname === PRODUCTION_ALIAS_HOST) return [];
  return [
    {
      source: SOURCE,
      has: [{ type: "host", value: `^${escapeRegExp(PRODUCTION_ALIAS_HOST)}$` }],
      destination: `${site.origin}/:path`,
      permanent: true, // 308: keeps the method
    },
  ];
}

// The same decision for one request (tests and documentation): the target
// URL, or null when the request is served as is. Query strings are kept.
export function aliasRedirectTarget({ host, pathname, search = "" }, env) {
  const [rule] = aliasRedirects(env);
  if (!rule) return null;
  const hostName = String(host ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!new RegExp(rule.has[0].value).test(hostName)) return null;
  const path = String(pathname ?? "/");
  if (/^\/(?:_next\/|api\/auth(?:\/|$))/.test(path)) return null;
  return `${new URL(rule.destination).origin}${path}${search}`;
}
