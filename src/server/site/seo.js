import "server-only";
import { isValidSlug } from "../cms/policy.js";

// SEO data for the public site (metadata, sitemap, JSON-LD), built from the
// published records only. Nothing is invented:
//   - a record's own seo.title / seo.description wins (migrated from the
//     legacy site where it had one);
//   - otherwise the title is the record's name/title and the description is
//     composed from its own text (excerpt, intro, identity, location), cut
//     at the SEO limit with an ellipsis, as the legacy site did;
//   - images come from the record's approved media (already filtered by the
//     public media rule), shaped to 1200x630 by a Cloudinary crop.
// Short interface strings (page names such as "ข่าวสาร") are UI copy, not
// content.

export const SEO_LIMITS = Object.freeze({ title: 60, description: 155 });
export const OG_SIZE = Object.freeze({ width: 1200, height: 630 });
// Until a dedicated og-default file exists, the default social image falls
// back to the shrine gate photo (matched by its Cloudinary path, so it works
// in every environment).
const OG_FALLBACK_PUBLIC_ID_SUFFIX = "shrine/exterior/front-entrance";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null);

// Cuts at a word boundary when possible and marks the cut with "…".
export function clip(value, limit) {
  const clean = text(value);
  if (!clean) return null;
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const join = (...parts) => parts.map(text).filter(Boolean).join(" ");

// Plain text of a legacy-text-v1 body (bold markers removed).
export function plainText(value) {
  return text(String(value ?? "").replace(/\*\*(.+?)\*\*/g, "$1"));
}

// Cloudinary delivery URL cropped to the Open Graph size. Accepts only
// res.cloudinary.com upload URLs; anything else returns null.
export function ogImageUrl(secureUrl) {
  if (typeof secureUrl !== "string") return null;
  let url;
  try {
    url = new URL(secureUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/image/upload/")) return null;
  url.pathname = url.pathname.replace("/image/upload/", `/image/upload/c_fill,g_auto,w_${OG_SIZE.width},h_${OG_SIZE.height},f_jpg,q_auto/`);
  return url.href;
}

function ogImage(media, ref) {
  const resolved = media?.resolve(ref) ?? null;
  if (!resolved) return null;
  const exact = resolved.width === OG_SIZE.width && resolved.height === OG_SIZE.height;
  const url = exact ? resolved.src : ogImageUrl(resolved.src);
  return url ? { url, width: OG_SIZE.width, height: OG_SIZE.height, alt: resolved.alt || "" } : null;
}

const listOf = (result) => (result?.status === "ok" && Array.isArray(result.data) ? result.data : []);
const docOf = (result) => (result?.status === "ok" && result.data && !Array.isArray(result.data) ? result.data : null);

function defaultImage({ siteSettings, banners }) {
  const settings = docOf(siteSettings);
  const configured = settings ? ogImage(siteSettings.media, settings.seo?.defaultOgImage) : null;
  if (configured) return configured;
  const gate = listOf(banners).find((banner) => banners.media.resolve(banner.image)?.publicId?.endsWith(OG_FALLBACK_PUBLIC_ID_SUFFIX));
  return gate ? ogImage(banners.media, gate.image) : null;
}

// content: { siteSettings, historyPage, sacredItems, news, banners }
// repository results (public scope). Returns plain data only.
export function buildSeoIndex(content) {
  const settings = docOf(content.siteSettings);
  const identity = settings?.identity ?? {};
  const contact = settings?.contact ?? {};
  const hours = settings?.openingHours ?? {};
  const siteName = text(identity.name);
  const shortName = text(identity.shortName) ?? siteName;
  const place = text(contact.locationShort);
  const image = defaultImage(content);
  const site = {
    available: Boolean(settings),
    name: siteName,
    shortName,
    title: siteName ? clip(join(siteName, text(identity.tagline) ? `| ${identity.tagline}` : null), SEO_LIMITS.title) : null,
    description: clip(identity.description, SEO_LIMITS.description),
    image,
  };

  const history = docOf(content.historyPage);
  const items = listOf(content.sacredItems).filter((doc) => isValidSlug(doc.slug));
  const news = listOf(content.news).filter((doc) => isValidSlug(doc.slug));
  const verified = contact.verified === true;

  return {
    site,
    pages: {
      history: history
        ? {
            title: clip(history.seo?.title ?? history.title, SEO_LIMITS.title),
            description: clip(history.seo?.description ?? join(history.intro, plainText(history.historyBody)), SEO_LIMITS.description),
            image: ogImage(content.historyPage.media, history.historyImage) ?? image,
          }
        : null,
      sacredItems: items.length
        ? { description: clip(join(shortName ? `สิ่งศักดิ์สิทธิ์ภายใน${shortName}` : null, items.map((doc) => doc.name).join(" "), shortName, place), SEO_LIMITS.description), image }
        : null,
      news: news.length ? { description: clip(join(siteName ? `ข่าวสารและกิจกรรมของ${siteName}` : null, news.map((doc) => doc.title).join(" ")), SEO_LIMITS.description), image } : null,
      visit: settings
        ? {
            description: clip(
              join(siteName ? `การเดินทางมา${siteName}` : null, place, text(hours.daysText) || text(hours.displayText) ? `เวลาเปิด ${join(hours.daysText, hours.displayText)}` : null, verified ? join(contact.phoneNumber ? `โทร ${contact.phoneNumber}` : null, contact.lineId ? `LINE ${contact.lineId}` : null) : null),
              SEO_LIMITS.description,
            ),
            image,
          }
        : null,
    },
    sacredItems: Object.fromEntries(
      items.map((doc) => [
        doc.slug,
        {
          title: clip(doc.seo?.title ?? doc.name, SEO_LIMITS.title),
          description: clip(doc.seo?.description ?? join(doc.name, doc.excerpt, shortName, place), SEO_LIMITS.description),
          image: ogImage(content.sacredItems.media, doc.primaryImage) ?? image,
        },
      ]),
    ),
    news: Object.fromEntries(
      news.map((doc) => [
        doc.slug,
        {
          title: clip(doc.seo?.title ?? doc.title, SEO_LIMITS.title),
          headline: clip(doc.title, 110),
          description: clip(doc.seo?.description ?? doc.excerpt, SEO_LIMITS.description),
          date: /^\d{4}-\d{2}-\d{2}$/.test(doc.date ?? "") ? doc.date : null,
          image: ogImage(content.news.media, doc.coverImage) ?? image,
          hasOwnImage: Boolean(content.news.media?.resolve(doc.coverImage)),
        },
      ]),
    ),
    slugs: { sacredItems: items.map((doc) => doc.slug), news: news.map((doc) => doc.slug) },
  };
}

// Metadata object for one page. path: canonical path ("/news/x").
// type: "website" | "article". entry: { title, description, image }.
export function pageMetadata({ path, title = null, absoluteTitle = false, description = null, image = null, type = "website", publishedTime = null }) {
  const openGraph = {
    type,
    url: path,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { images: [image] } : {}),
    ...(publishedTime ? { publishedTime } : {}),
  };
  return {
    ...(title ? { title: absoluteTitle ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    openGraph,
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

// JSON-LD: FAQPage from the FAQs shown on the page (question + answer).
export function faqPageJsonLd(faqs) {
  const items = (faqs ?? []).filter((faq) => text(faq?.question) && text(faq?.answer));
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({ "@type": "Question", name: text(faq.question), acceptedAnswer: { "@type": "Answer", text: text(faq.answer) } })),
  };
}

// JSON-LD: NewsArticle for one published article. siteUrl: URL or null.
export function newsArticleJsonLd(entry, { slug, siteUrl, siteName }) {
  if (!entry?.headline || !entry.date) return null;
  const url = siteUrl ? new URL(`/news/${slug}`, siteUrl).href : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: entry.headline,
    ...(entry.description ? { description: entry.description } : {}),
    datePublished: entry.date,
    ...(entry.image ? { image: [entry.image.url] } : {}),
    ...(url ? { url, mainEntityOfPage: url } : {}),
    ...(siteName ? { publisher: { "@type": "Organization", name: siteName } } : {}),
  };
}
