import "server-only";
import { connection } from "next/server";
import { getPublicContent } from "../cms/index.js";
import { evaluateSiteLaunch, readSiteUrl } from "../../lib/site-launch.js";
import { getReviewChrome, getReviewHomepage, getReviewRepositories, isClientReviewEnabled } from "../review/index.js";
import {
  getPublicChrome,
  getPublicHistoryPage,
  getPublicHomepage,
  getPublicNewsArticlePage,
  getPublicNewsPage,
  getPublicSacredItemPage,
  getPublicSacredItemsPage,
  getPublicSeoIndex,
  getPublicVisitPage,
} from "./public.js";
import { faqPageJsonLd, newsArticleJsonLd, pageMetadata } from "./seo.js";
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

// --- SEO -----------------------------------------------------------------
//
// Review mode never reads content for metadata, the sitemap, or static
// params: it keeps generic titles and noindex (src/lib/site-launch.js).

// Param value used when no published slug exists yet: Cache Components
// needs at least one param to validate a dynamic route at build time. It is
// not a valid slug, so it renders the 404 page.
export const STATIC_PARAM_PLACEHOLDER = "__none__";

// generateStaticParams for /sakkara/[slug] ("sacredItems") and /news/[slug]
// ("news"): every published slug, so unknown slugs never match a prerender.
export async function getStaticSlugs(kind) {
  if (isClientReviewEnabled()) return [{ slug: STATIC_PARAM_PLACEHOLDER }];
  const index = await getPublicSeoIndex();
  const slugs = index.slugs[kind] ?? [];
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: STATIC_PARAM_PLACEHOLDER }];
}

// Root metadata defaults (title template, description, default image).
export async function getSiteMetadataDefaults() {
  if (isClientReviewEnabled()) return null;
  const { site } = await getPublicSeoIndex();
  if (!site.available) return null;
  return { shortName: site.shortName, title: site.title, description: site.description, image: site.image };
}

// Metadata for one public page. fallback: the generic metadata the page
// uses in review mode or when the record is not available. title: the
// page's own heading (interface copy) for list pages.
export async function getPageMetadata(route, { slug = null, title = null, fallback = {} } = {}) {
  if (isClientReviewEnabled()) return fallback;
  const index = await getPublicSeoIndex();
  const { site, pages } = index;
  switch (route) {
    case "home":
      return pageMetadata({ path: "/", title: site.title, absoluteTitle: true, description: site.description, image: site.image });
    case "history":
      return pages.history ? pageMetadata({ path: "/history", ...pages.history }) : { ...fallback, alternates: { canonical: "/history" } };
    case "sakkara":
      return pageMetadata({ path: "/sakkara", title: title ?? fallback.title, description: pages.sacredItems?.description, image: pages.sacredItems?.image ?? site.image });
    case "news":
      return pageMetadata({ path: "/news", title: title ?? fallback.title, description: pages.news?.description, image: pages.news?.image ?? site.image });
    case "visit":
      return pageMetadata({ path: "/visit", title: title ?? fallback.title, description: pages.visit?.description, image: pages.visit?.image ?? site.image });
    case "sakkaraItem": {
      const entry = index.sacredItems[slug];
      return entry ? pageMetadata({ path: `/sakkara/${slug}`, ...entry }) : fallback;
    }
    case "newsArticle": {
      const entry = index.news[slug];
      // Article titles stand alone (no site suffix), as on the legacy site.
      return entry ? pageMetadata({ path: `/news/${slug}`, title: entry.title, absoluteTitle: true, description: entry.description, image: entry.image, type: "article", publishedTime: entry.date }) : fallback;
    }
    default:
      return fallback;
  }
}

// JSON-LD for the public homepage (FAQPage of the FAQs it shows).
export async function getHomepageJsonLd() {
  if (isClientReviewEnabled()) return null;
  const view = await getPublicHomepage();
  return view.status === "ok" ? faqPageJsonLd(view.faq) : null;
}

// JSON-LD for one published news article.
export async function getNewsArticleJsonLd(slug) {
  if (isClientReviewEnabled()) return null;
  const index = await getPublicSeoIndex();
  return newsArticleJsonLd(index.news[slug], { slug, siteUrl: readSiteUrl(process.env), siteName: index.site.name });
}

// sitemap.xml: published public pages only, and only on the launched site.
export async function getSitemapEntries() {
  const siteUrl = readSiteUrl(process.env);
  if (isClientReviewEnabled() || !evaluateSiteLaunch(process.env).indexable || !siteUrl) return [];
  const index = await getPublicSeoIndex();
  const url = (path) => new URL(path, siteUrl).href;
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    ...(index.pages.history ? [{ url: url("/history"), changeFrequency: "monthly", priority: 0.8 }] : []),
    { url: url("/sakkara"), changeFrequency: "monthly", priority: 0.8 },
    ...index.slugs.sacredItems.map((slug) => ({ url: url(`/sakkara/${slug}`), changeFrequency: "monthly", priority: 0.7 })),
    { url: url("/news"), changeFrequency: "weekly", priority: 0.8 },
    ...index.slugs.news.map((slug) => ({ url: url(`/news/${slug}`), lastModified: index.news[slug].date ?? undefined, changeFrequency: "yearly", priority: 0.6 })),
    { url: url("/visit"), changeFrequency: "monthly", priority: 0.8 },
  ];
}
