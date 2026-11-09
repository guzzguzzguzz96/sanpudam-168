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
  partialPrefetching: true,
  // Migrated staging media only, and only while review mode is on.
  ...(reviewMode.enabled
    ? {
        images: {
          remotePatterns: [
            {
              protocol: "https",
              hostname: "res.cloudinary.com",
              pathname: "/lov36obu/image/upload/*/sanpudam168/staging/**",
            },
          ],
        },
      }
    : {}),
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
