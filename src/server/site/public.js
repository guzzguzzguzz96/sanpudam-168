import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicContent } from "../cms/index.js";
import { buildHomepage, buildSiteChrome, loadHomepageSections } from "../review/homepage.js";
import { createSitePages } from "./service.js";

// Public site data, cached with "use cache" (Cache Components).
//
// Why cached instead of read per request: public content is published,
// approved, and placeholder-free, and changes only through the
// staging-to-production promotion (or, later, an approved CMS write). A
// short-lived cache lets every public page prerender as a static shell
// with its content, serves visitors without a database round trip, and lets
// a page check its slug before anything streams (real HTTP 404s). Draft and
// review data never pass through here: Client Review keeps its own
// request-time path (see src/server/site/index.js) and is unaffected.
//
// Lifetimes (one cacheLife call per invocation):
//   published results  revalidate every 5 minutes, expire after 1 day
//   degraded results   "minutes" profile (revalidate after 1 minute), so a
//                      database outage is retried soon; it is still long
//                      enough to stay part of a prerender
// Every entry carries PUBLIC_CONTENT_TAG for on-demand revalidation.
//
// Every function returns plain, serializable view data (strings, numbers,
// arrays, objects); repositories, media resolvers, and documents never
// leave the cached scope.

export const PUBLIC_CONTENT_TAG = "public-content";
const PUBLISHED_LIFE = Object.freeze({ stale: 300, revalidate: 300, expire: 86400 });

const pages = createSitePages({ review: async () => ({ status: "disabled" }), publicRepositories: getPublicContent });

export async function getPublicHomepage() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const view = buildHomepage(await loadHomepageSections(getPublicContent()), { scope: "public" });
  const degraded = view.status !== "ok" || Object.values(view.sections).includes("unavailable");
  if (degraded) cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return view;
}

export async function getPublicChrome() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const chrome = buildSiteChrome(await getPublicContent().siteSettings(), { scope: "public" });
  if (chrome.status !== "ok") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return chrome;
}

export async function getPublicHistoryPage() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.history();
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}

export async function getPublicSacredItemsPage() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.sacredItems();
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}

export async function getPublicSacredItemPage(slug) {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.sacredItem(slug);
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}

export async function getPublicNewsPage() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.news();
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}

export async function getPublicNewsArticlePage(slug) {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.newsArticle(slug);
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}

export async function getPublicVisitPage() {
  "use cache";
  cacheTag(PUBLIC_CONTENT_TAG);
  const page = await pages.visit();
  if (page.status === "unavailable") cacheLife("minutes");
  else cacheLife(PUBLISHED_LIFE);
  return page;
}
