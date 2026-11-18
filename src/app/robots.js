import { evaluateSiteLaunch, readSiteUrl } from "@/lib/site-launch";

// robots.txt from the launch policy (src/lib/site-launch.js). Only the
// launched production site may be crawled, and never /admin or /api.
// Everything else (Preview, review mode, local builds) disallows all.
export default function robots() {
  const launch = evaluateSiteLaunch(process.env);
  const siteUrl = readSiteUrl(process.env);
  if (!launch.indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    ...(siteUrl ? { sitemap: new URL("/sitemap.xml", siteUrl).href, host: siteUrl.origin } : {}),
  };
}
