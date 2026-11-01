import "server-only";
import { isValidSlug } from "../cms/policy.js";
import { openReviewRepositories } from "../review/service.js";
import { buildHistoryPage, buildSacredItemPage, buildSacredItemsPage } from "./pages.js";

// Loaders for /history, /sakkara, and /sakkara/[slug]. The scope is chosen
// only by the environment-based review policy:
//   review mode on  -> the dedicated read-only review repositories (drafts,
//                      labeled); a review failure stays "unavailable" and
//                      never falls back to public or sample content
//   review mode off -> the public repositories (published + approved + no
//                      open placeholders)
// Request data never selects the scope. The slug is only a lookup value,
// validated before any query.
//
// Every loader returns { scope, status, view }:
//   "ok"          view holds the page data
//   "empty"       list page with no eligible records (honest empty state)
//   "not_found"   no eligible record (page calls notFound())
//   "unavailable" content could not be read (not a 404)

export const SACRED_ITEMS_LIMIT = 200;

async function repositoriesFor({ review, publicRepositories }) {
  const opened = await review();
  if (opened.status === "ok") return { scope: "review", repositories: opened.repositories };
  if (opened.status === "unavailable") return { scope: "review", repositories: null };
  return { scope: "public", repositories: publicRepositories() };
}

const unavailable = (scope) => ({ scope, status: "unavailable", view: null });

// deps.review: () => openReviewRepositories result.
// deps.publicRepositories: () => public repositories (getPublicContent()).
export function createSitePages({ review = () => openReviewRepositories(), publicRepositories }) {
  if (typeof publicRepositories !== "function") throw new TypeError("publicRepositories is required.");

  return {
    async history() {
      const { scope, repositories } = await repositoriesFor({ review, publicRepositories });
      if (!repositories) return unavailable(scope);
      const result = await repositories.historyPage();
      if (result.status === "unavailable") return unavailable(scope);
      if (result.status !== "ok") return { scope, status: "not_found", view: null };
      return { scope, status: "ok", view: buildHistoryPage(result) };
    },

    async sacredItems() {
      const { scope, repositories } = await repositoriesFor({ review, publicRepositories });
      if (!repositories) return unavailable(scope);
      const result = await repositories.sacredItems({ limit: SACRED_ITEMS_LIMIT });
      if (result.status === "unavailable") return unavailable(scope);
      if (result.status !== "ok") return { scope, status: "empty", view: [] };
      return { scope, status: "ok", view: buildSacredItemsPage(result) };
    },

    async sacredItem(slug) {
      // Checked before any connection or query.
      if (!isValidSlug(slug)) return { scope: null, status: "not_found", view: null };
      const { scope, repositories } = await repositoriesFor({ review, publicRepositories });
      if (!repositories) return unavailable(scope);
      const result = await repositories.sacredItemBySlug(slug);
      if (result.status === "unavailable") return unavailable(scope);
      if (result.status !== "ok") return { scope, status: "not_found", view: null };
      return { scope, status: "ok", view: buildSacredItemPage(result) };
    },
  };
}
