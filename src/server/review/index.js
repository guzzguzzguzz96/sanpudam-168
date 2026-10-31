import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { readReviewPolicy } from "./config.js";
import { loadReviewHomepage } from "./service.js";

export { REVIEW_LABELS } from "./homepage.js";

// Next.js entry point for Client Review Mode (docs/client-review-mode.md).

// Environment-only decision; request data is never consulted.
export function isClientReviewEnabled() {
  return readReviewPolicy().enabled;
}

// Review homepage data for the current request. connection() runs first, so
// draft data is never fetched while prerendering and never becomes part of
// a static shell or build artifact. cache() shares one load between the
// layout and the page within a single request; nothing is cached across
// requests.
export const getReviewHomepage = cache(async () => {
  await connection();
  return loadReviewHomepage();
});
