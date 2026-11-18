import { getSitemapEntries } from "@/server/site";

// sitemap.xml: published public pages only (home, history, sacred items,
// news, visit), and only on the launched production site; empty otherwise.
export default async function sitemap() {
  return getSitemapEntries();
}
