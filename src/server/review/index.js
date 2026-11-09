import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { readReviewPolicy } from "./config.js";
import { loadReviewChrome, loadReviewHomepage, openReviewRepositories, shareSiteSettings } from "./service.js";

export { REVIEW_LABELS } from "./homepage.js";

// Next.js entry point for Client Review Mode (docs/client-review-mode.md).

// Environment-only decision; request data is never consulted.
export function isClientReviewEnabled() {
  return readReviewPolicy().enabled;
}

// React cache() is request-scoped: within one server render it shares one
// repository opening and one site-settings read between the header, the
// footer, and the page. Every new request reads the database again; nothing
// is cached across requests. connection() runs first, so draft data is
// never fetched while prerendering and never becomes part of a static shell
// or build artifact.
export const getReviewRepositories = cache(async () => {
  await connection();
  const opened = await openReviewRepositories();
  return opened.status === "ok" ? { ...opened, repositories: shareSiteSettings(opened.repositories) } : opened;
});

// Review homepage data for the current request.
export const getReviewHomepage = cache(async () => loadReviewHomepage({ opened: await getReviewRepositories() }));

// Header and footer data for the current request (site settings only).
export const getReviewChrome = cache(async () => loadReviewChrome({ opened: await getReviewRepositories() }));
