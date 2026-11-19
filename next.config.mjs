import { aliasRedirects } from "./src/lib/canonical-host.js";
import { evaluateReviewMode, reviewResponseHeaders } from "./src/lib/review-mode.js";

// Client Review Mode (docs/client-review-mode.md) is decided from the
// server environment when the config loads (build and server start). When
// it is off, which is always the case in production, nothing below changes
// the configuration.
const reviewMode = evaluateReviewMode(process.env);

// Admin sign-in pages and Auth.js endpoints are private in every
// environment: never indexed, never stored by shared caches.
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];
const adminResponseHeaders = ["/admin", "/admin/:path*", "/api/auth/:path*"].map((source) => ({ source, headers: privateHeaders }));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  // Partial Prefetching serves a route's App Shell (HTTP 200) for a slug that
  // was not prerendered and renders the page in the background. The public
  // site turns it off so the first request for an unknown slug waits for the
  // page, whose notFound() then returns a real HTTP 404 (slug pages await
  // params outside Suspense on the public site). Client Review keeps it on,
  // unchanged: its pages stream drafts inside Suspense per request.
  partialPrefetching: reviewMode.enabled,
  // The migrated media library, in every mode: the public site reuses the
  // same Cloudinary files (sanpudam168/staging) that review mode shows. The
  // pattern stays exactly this narrow: one cloud, versioned uploads, one
  // folder. Which assets may render is decided by the media rules in
  // src/server/cms/policy.js, not by this allowlist.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/lov36obu/image/upload/*/sanpudam168/staging/**",
      },
    ],
  },
  // Vercel Production only: sanpudam-168.vercel.app -> custom domain (308,
  // path and query kept). See src/lib/canonical-host.js.
  async redirects() {
    return aliasRedirects(process.env);
  },
  async headers() {
    return [...reviewResponseHeaders(reviewMode), ...adminResponseHeaders];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
