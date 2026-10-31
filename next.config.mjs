import { evaluateReviewMode, reviewResponseHeaders } from "./src/lib/review-mode.js";

// Client Review Mode (docs/client-review-mode.md) is decided from the
// server environment when the config loads (build and server start). When
// it is off, which is always the case in production, nothing below changes
// the configuration.
const reviewMode = evaluateReviewMode(process.env);

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
    return reviewResponseHeaders(reviewMode);
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
