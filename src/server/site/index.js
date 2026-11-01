import "server-only";
import { connection } from "next/server";
import { getPublicContent } from "../cms/index.js";
import { createSitePages } from "./service.js";

// Next.js entry point for the content pages: /history, /sakkara,
// /sakkara/[slug] (docs/client-review-mode.md §12), /news, /news/[slug],
// and /visit (§13). Every loader waits for connection()
// first, so content is read per request and never prerendered into a
// static shell or build artifact. Nothing is cached across requests.

const pages = createSitePages({ publicRepositories: getPublicContent });

export async function getHistoryPage() {
  await connection();
  return pages.history();
}

export async function getSacredItemsPage() {
  await connection();
  return pages.sacredItems();
}

export async function getSacredItemPage(slug) {
  await connection();
  return pages.sacredItem(slug);
}

export async function getNewsPage() {
  await connection();
  return pages.news();
}

export async function getNewsArticlePage(slug) {
  await connection();
  return pages.newsArticle(slug);
}

export async function getVisitPage() {
  await connection();
  return pages.visit();
}
