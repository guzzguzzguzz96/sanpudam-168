// Launch policy: whether this deployment is the launched public site.
// Pure and dependency-free (like review-mode.js), so the root layout,
// robots.txt, and sitemap.xml share one decision.
//
// The site is "launched" only when both hold, exactly:
//   VERCEL_ENV=production   (Vercel Production deployment)
//   SITE_LAUNCHED=true      (explicit launch switch, set at launch)
// Every other combination, including missing or unexpected values, local
// builds, and Vercel Preview, is not launched: pages are noindex, robots.txt
// disallows everything, the sitemap is empty, and the prototype notice shows.
// Both values are read when pages are built, so changing SITE_LAUNCHED needs
// a redeploy.

export const LAUNCH_FLAG = "SITE_LAUNCHED";

export function evaluateSiteLaunch(env) {
  const launched = Boolean(env) && env.VERCEL_ENV === "production" && env[LAUNCH_FLAG] === "true";
  return Object.freeze({ launched, indexable: launched });
}

// Canonical origin from NEXT_PUBLIC_SITE_URL (https only outside local
// development, no path, query, or credentials). Returns a URL or null.
export function readSiteUrl(env) {
  const value = typeof env?.NEXT_PUBLIC_SITE_URL === "string" ? env.NEXT_PUBLIC_SITE_URL.trim() : "";
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

// robots metadata for every page of this deployment.
export function robotsFor(launch) {
  return launch.indexable ? { index: true, follow: true } : { index: false, follow: false };
}
