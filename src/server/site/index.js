import "server-only";
import { connection } from "next/server";
import { getPublicContent } from "../cms/index.js";
import { createSitePages } from "./service.js";

// Next.js entry point for /history, /sakkara, and /sakkara/[slug]
// (docs/client-review-mode.md §12). Every loader waits for connection()
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
