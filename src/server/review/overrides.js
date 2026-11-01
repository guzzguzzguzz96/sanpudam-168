import "server-only";

// Owner-confirmed values for Client Review Mode (docs/client-review-mode.md
// §11). They take precedence over the migrated staging record while the
// record itself stays unchanged and unverified: nothing here is written to
// MongoDB, and the public site (siteConfig) does not read this file.
//
// Add a value only when the owner has confirmed it, with the date.

export const REVIEW_CONFIRMED_OVERRIDES = Object.freeze({
  // Google Maps directions link supplied by the owner on 2026-11-01. It
  // replaces the imported share.google link, which is not a Maps URL.
  directionsUrl: "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7",
});
