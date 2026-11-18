import "server-only";
import { connection } from "next/server";
import { getPublicContent } from "../cms/index.js";
import { getReviewChrome, getReviewHomepage, getReviewRepositories, isClientReviewEnabled } from "../review/index.js";
import {
  getPublicChrome,
  getPublicHistoryPage,
  getPublicHomepage,
  getPublicNewsArticlePage,
  getPublicNewsPage,
  getPublicSacredItemPage,
  getPublicSacredItemsPage,
  getPublicVisitPage,
} from "./public.js";
import { createSitePages } from "./service.js";

// Next.js entry point for every content page: /, /history, /sakkara,
// /sakkara/[slug], /news, /news/[slug], /visit, and the header and footer.
//
// The scope is chosen only by the environment-based review policy:
//   review mode on  -> Client Review: connection() first, so draft data is
//                      read per request and never prerendered, cached, or
//                      part of a static shell or build artifact. The
//                      repositories (and the site-settings read) are shared
//                      with the header and footer within one request.
//   review mode off -> the public site: published data through the cached
//                      loaders in public.js (see there for the lifetimes).
// Request data never selects the scope.

const reviewPages = createSitePages({ review: getReviewRepositories, publicRepositories: getPublicContent });

export { isClientReviewEnabled };

export async function getHomepage() {
  if (isClientReviewEnabled()) return getReviewHomepage();
  return getPublicHomepage();
}

export async function getSiteChrome() {
  if (isClientReviewEnabled()) return getReviewChrome();
  return getPublicChrome();
}

export async function getHistoryPage() {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.history();
  }
  return getPublicHistoryPage();
}

export async function getSacredItemsPage() {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.sacredItems();
  }
  return getPublicSacredItemsPage();
}

export async function getSacredItemPage(slug) {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.sacredItem(slug);
  }
  return getPublicSacredItemPage(slug);
}

export async function getNewsPage() {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.news();
  }
  return getPublicNewsPage();
}

export async function getNewsArticlePage(slug) {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.newsArticle(slug);
  }
  return getPublicNewsArticlePage(slug);
}

export async function getVisitPage() {
  if (isClientReviewEnabled()) {
    await connection();
    return reviewPages.visit();
  }
  return getPublicVisitPage();
}
