import "server-only";
import { formatThaiDate, lineUrlFromId } from "../cms/adapters.js";
import { mediaPresentation } from "../cms/media-presentation.js";
import { isValidSlug } from "../cms/policy.js";
import { getPhoneHref } from "../../lib/contact-actions.js";
import { normalizeSacredItem } from "../../lib/sacred-items.js";
import { cleanSocialUrl } from "../../lib/social-links.js";
import { OWNER_CONFIRMED_MAP_EMBED_URL, isAllowedMapEmbedUrl } from "../../config/map-embed.js";
import { REVIEW_CONFIRMED_OVERRIDES } from "./overrides.js";

// Homepage and header/footer view data: MongoDB content -> plain view data
// for the existing homepage components. One builder serves two scopes:
//
//   scope "review" (default, docs/client-review-mode.md): migrated drafts
//     with visible placeholder labels, imported contact values as labeled
//     text, and the owner-confirmed overrides (overrides.js).
//   scope "public": published records only (the repositories enforce the
//     publication and media rules). No review label, note, or override is
//     ever produced. Phone, LINE, Maps, and social links appear only when
//     the owner verified them (contact.verified / link.verified) and the
//     value passes validation; nothing falls back to another value.
//
// Review-scope rules:
// - Explicit field selection only. No MongoDB document, ObjectId, review
//   record, placeholder record, rights record, or legacy/migration value is
//   passed on; ids become strings.
// - Nothing is invented. A missing value omits the field or the section
//   (null); there is no fallback to sample or prototype copy.
// - Every value is still unverified: placeholder flags from the migration
//   become visible "sample text" labels next to the affected content, and
//   contact details are labeled as imported and unconfirmed.
// - Contact values are shown as text, never as tel:/LINE actions.

export const HOMEPAGE_LIMITS = Object.freeze({ featuredItems: 3, news: 3, gallery: 5 });

// Upper bounds for review queries. All migrated collections are smaller,
// so "available" counts are complete.
export const REVIEW_QUERY_LIMITS = Object.freeze({ banners: 20, sacredItems: 50, news: 50, gallery: 50, faqs: 50 });

export const REVIEW_LABELS = Object.freeze({
  sample: "ข้อความตัวอย่าง · รอเจ้าของยืนยัน",
  pending: "บางรายละเอียดรอเจ้าของยืนยัน",
  unverifiedContact: "นำเข้าจากระบบเดิม · ยังไม่ยืนยัน",
  invalidDirections: "ลิงก์แผนที่จากระบบเดิมใช้งานไม่ได้ · รอลิงก์ Google Maps ที่เจ้าของยืนยัน",
});

// Placeholder paths from the migration -> Thai field names.
const FIELD_LABELS = {
  title: "หัวข้อ",
  date: "วันที่",
  excerpt: "คำอธิบายย่อ",
  body: "รายละเอียด",
  offerings: "ของไหว้",
  prayerTopics: "เรื่องที่ขอพร",
  inquiryText: "ข้อความสอบถาม",
  historyBody: "เนื้อหาประวัติ",
  worshipSteps: "ขั้นตอนการสักการะ",
  answer: "คำตอบ",
  question: "คำถาม",
  "openingHours.daysText": "วันเปิดทำการ",
  contactTopics: "หัวข้อการติดต่อ",
};

// Gallery composition (Step G): the first image is the feature tile; the
// other four fill the grid in DOM order.
const GALLERY_LAYOUTS = ["home-gallery__item--feature", "", "", "", ""];

// Approved shortcuts (history and sacred items open their pages since C2.1);
// each appears only when its section renders.
const QUICK_ACTIONS = [
  { id: "history", href: "/history", icon: "book", label: "ประวัติศาล", section: "about" },
  { id: "worship", href: "#worship-guide", icon: "lotus", label: "การสักการะ", section: "worshipGuide" },
  { id: "sacred-items", href: "/sakkara", icon: "gem", label: "วัตถุมงคล", section: "featuredItems" },
  { id: "directions", href: "#visit", icon: "route", label: "การเดินทาง", section: "visit" },
];

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const isOk = (result) => result?.status === "ok" && result.data != null;
const sectionStatus = (result) => (result?.status === "unavailable" ? "unavailable" : isOk(result) ? "ok" : "empty");
const listOf = (result) => (isOk(result) && Array.isArray(result.data) ? result.data : []);

function openPlaceholderPaths(doc) {
  return (doc?.placeholderFields ?? []).filter((flag) => flag?.status === "placeholder" && typeof flag.path === "string").map((flag) => flag.path);
}

const coversPath = (paths, path) => paths.some((shown) => path === shown || path.startsWith(`${shown}.`));
const fieldLabel = (path) => FIELD_LABELS[path] ?? "ข้อมูลบางส่วน";

// Visible status for one record. shown: the paths this section displays.
// "sample" when a displayed value is a migration placeholder; "pending" when
// only details not displayed here are; null otherwise.
export function describeReviewStatus(doc, shown) {
  const open = openPlaceholderPaths(doc);
  if (!open.length) return null;
  const sample = open.filter((path) => coversPath(shown, path));
  const fields = [...new Set((sample.length ? sample : open).map(fieldLabel))];
  return sample.length
    ? { tone: "sample", label: REVIEW_LABELS.sample, fields }
    : { tone: "pending", label: REVIEW_LABELS.pending, fields };
}

// Google Maps share links only: HTTPS and exactly maps.app.goo.gl (no
// suffix matching, no other Google hosts). share.google and other
// short-link services are rejected.
const MAPS_HOST = "maps.app.goo.gl";

function parseHttps(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

export function reviewMapsUrl(value) {
  const url = parseHttps(value);
  if (!url || url.hostname !== MAPS_HOST || !/^\/[A-Za-z0-9]+$/.test(url.pathname)) return null;
  return url.href;
}

const SOCIAL_HOSTS = {
  facebook: { label: "Facebook", hosts: ["www.facebook.com", "facebook.com", "m.facebook.com"] },
  tiktok: { label: "TikTok", hosts: ["www.tiktok.com", "tiktok.com"] },
  youtube: { label: "YouTube", hosts: ["www.youtube.com", "youtube.com"] },
};

// href: the link without tracking parameters (src/lib/social-links.js).
// Only the public scope turns
// it into a clickable link, and only for verified links.
export function reviewSocialLink(link) {
  const platform = SOCIAL_HOSTS[link?.platform];
  const url = parseHttps(link?.url);
  if (!platform || !url || !platform.hosts.includes(url.hostname)) return null;
  return { platform: link.platform, label: platform.label, value: `${url.hostname}${url.pathname}`.replace(/\/$/, ""), href: cleanSocialUrl(url), verified: link.verified === true };
}

export const PUBLIC_SCOPE_NAME = "public";
const isPublic = (scope) => scope === PUBLIC_SCOPE_NAME;
// Review labels never appear in the public scope.
const statusOf = (scope, doc, shown) => (isPublic(scope) ? null : describeReviewStatus(doc, shown));

function image(media, ref) {
  const resolved = media?.resolve(ref) ?? null;
  return resolved ? { src: resolved.src, width: resolved.width, height: resolved.height, alt: resolved.alt, caption: resolved.caption, focalPoint: resolved.focalPoint, ...mediaPresentation(resolved.publicId) } : null;
}

function brandView(result) {
  if (!isOk(result)) return null;
  const settings = result.data;
  const logo = image(result.media, settings.branding?.logo);
  return {
    name: text(settings.identity?.name),
    shortName: text(settings.identity?.shortName),
    // The only logo source is the legacy 192x192 PNG: icon size only.
    logo: logo ? { ...logo, alt: "" } : null,
    logoIsLowResolution: Boolean(logo && Math.max(logo.width ?? 0, logo.height ?? 0) < 512),
  };
}

function heroView(siteSettings, banners, scope) {
  const identity = isOk(siteSettings) ? siteSettings.data.identity : null;
  // Ordering: sortOrder ascending (query). Banners have no enabled flag;
  // archived records are excluded by the review scope.
  let chosen = null;
  for (const banner of listOf(banners)) {
    const desktopImage = image(banners.media, banner.image);
    if (desktopImage) {
      chosen = { id: String(banner._id), desktopImage, mobileImage: image(banners.media, banner.mobileImage) };
      break;
    }
  }
  const title = text(identity?.name);
  if (!title && !chosen) return null;
  return {
    title,
    // The tagline is the short identity line; the full description is long
    // copy for the about/meta context.
    description: text(identity?.tagline) ?? text(identity?.description),
    desktopImage: chosen?.desktopImage ?? null,
    mobileImage: chosen?.mobileImage ?? null,
    desktopFocalPoint: chosen?.desktopImage?.focalPoint ?? "50% 50%",
    mobileFocalPoint: chosen?.mobileImage?.focalPoint ?? chosen?.desktopImage?.focalPoint ?? "50% 50%",
    reviewStatus: isOk(siteSettings) ? statusOf(scope, siteSettings.data, ["identity"]) : null,
  };
}

// Directions, review scope: an owner-confirmed override (overrides.js) wins;
// otherwise the imported link is used only if it passes validation and stays
// labeled. An invalid override is ignored (never silently swapped for the
// import).
// Public scope: only the stored link, only when the contact block is
// verified and the link passes validation. No override, no fallback.
function directionsView(contact, overrides, note, scope) {
  if (isPublic(scope)) {
    const href = contact.verified === true ? reviewMapsUrl(contact.directionsUrl) : null;
    return href ? { status: "confirmed", confirmed: true, href, note: null } : null;
  }
  const confirmedHref = reviewMapsUrl(overrides?.directionsUrl);
  if (confirmedHref) return { status: "confirmed", confirmed: true, href: confirmedHref, note: null };
  const importedHref = reviewMapsUrl(contact.directionsUrl);
  if (importedHref) return { status: "imported", confirmed: false, href: importedHref, note };
  return text(contact.directionsUrl) ? { status: "invalid", confirmed: false, href: null, note: REVIEW_LABELS.invalidDirections } : null;
}

// Contact values: validated, displayed as text, and labeled unless the
// owner has verified the contact block.
// Public scope: phone and LINE only when verified; no notes.
function contactView(settings, overrides, scope) {
  const contact = settings?.contact ?? {};
  const verified = contact.verified === true;
  const showChannels = !isPublic(scope) || verified;
  const note = verified || isPublic(scope) ? null : REVIEW_LABELS.unverifiedContact;
  const phone = showChannels && getPhoneHref(contact.phoneNumber) ? contact.phoneNumber.trim() : null;
  const lineId = showChannels && lineUrlFromId(contact.lineId) && !text(contact.lineId)?.startsWith("https://") ? text(contact.lineId) : null;
  const parts = [phone ? `โทร ${phone}` : null, lineId ? `LINE ${lineId}` : null].filter(Boolean);
  return {
    verified,
    address: text(contact.address) ? { value: text(contact.address), note } : null,
    locationShort: text(contact.locationShort) ? { value: text(contact.locationShort), note } : null,
    channels: parts.length ? { value: parts.join(" · "), note } : null,
    phone,
    lineId,
    directions: directionsView(contact, overrides, note, scope),
    // Verified, validated values for clickable actions (public scope only).
    actionConfig: isPublic(scope) && verified ? { phoneNumber: phone, lineInquiryUrl: lineUrlFromId(contact.lineId) } : null,
  };
}

function hoursView(settings, scope) {
  const hours = settings?.openingHours;
  if (!hours) return null;
  const value = [text(hours.daysText), text(hours.displayText)].filter(Boolean).join(" ");
  if (!value) return null;
  if (isPublic(scope)) return { value, note: null };
  const status = describeReviewStatus(settings, ["openingHours"]);
  return { value, note: status?.tone === "sample" ? `${REVIEW_LABELS.sample} (${status.fields.join(", ")})` : REVIEW_LABELS.unverifiedContact };
}

function visitorViews(result, overrides, scope) {
  if (!isOk(result)) return { quickInformation: null, visit: null, footer: null, contact: null };
  const settings = result.data;
  const hours = hoursView(settings, scope);
  const contact = contactView(settings, overrides, scope);

  const quickInformation = [
    hours ? { id: "hours", icon: "clock", label: "เวลาเปิดทำการ", ...hours } : null,
    contact.locationShort ? { id: "location", icon: "mapPin", label: "สถานที่", ...contact.locationShort } : null,
    contact.channels ? { id: "contact", icon: "chat", label: "ช่องทางติดต่อ", ...contact.channels } : null,
  ].filter(Boolean);

  const details = [
    hours ? { id: "hours", icon: "clock", label: "เวลาเปิดทำการ", ...hours } : null,
    contact.address ? { id: "address", icon: "mapPin", label: "สถานที่", ...contact.address } : null,
    contact.channels ? { id: "contact", icon: "chat", label: "ช่องทางติดต่อ", ...contact.channels } : null,
  ].filter(Boolean);

  // Review: every valid link, as text, labeled unless verified (no href).
  // Public: verified links only, with their cleaned href.
  const social = (settings.socialLinks ?? [])
    .map(reviewSocialLink)
    .filter((link) => link && (!isPublic(scope) || link.verified))
    .map(({ href, ...link }) => (isPublic(scope) ? { ...link, href, note: null } : { ...link, note: link.verified ? null : REVIEW_LABELS.unverifiedContact }));

  return {
    quickInformation: quickInformation.length ? quickInformation : null,
    // Public scope adds the owner-confirmed map embed while the contact block
    // is verified; the review shape is unchanged (placeholder box).
    visit: details.length || contact.directions
      ? { details, directions: contact.directions, ...(isPublic(scope) ? { mapEmbedUrl: contact.verified && isAllowedMapEmbedUrl(OWNER_CONFIRMED_MAP_EMBED_URL) ? OWNER_CONFIRMED_MAP_EMBED_URL : null } : {}) }
      : null,
    // Compact summary (Step G): full values, including the full address and
    // social URLs, are on /visit. Short values come from their own fields
    // (locationShort, platform names), never by cutting a longer value. One
    // shared note marks the group while any value is unverified.
    footer: {
      details: [
        (contact.locationShort ?? contact.address) ? { id: "location", label: "ที่ตั้ง", value: (contact.locationShort ?? contact.address).value } : null,
        contact.phone || contact.lineId
          ? { id: "contact", label: "โทรศัพท์ / LINE", value: [contact.phone, contact.lineId].filter(Boolean).join(" · ") }
          : null,
        social.length ? { id: "social", label: "โซเชียลมีเดีย", value: social.map((link) => link.label).join(" · ") } : null,
      ].filter(Boolean),
      note: !isPublic(scope) && (!contact.verified || social.some((link) => !link.verified)) ? REVIEW_LABELS.unverifiedContact : null,
      moreHref: "/visit",
    },
    contact,
  };
}

function aboutView(result, scope) {
  if (!isOk(result)) return null;
  const page = result.data;
  const title = text(page.homeIntroHeading) ?? text(page.title);
  const description = text(page.intro);
  if (!title && !description) return null;
  const historyImage = image(result.media, page.historyImage);
  return {
    title,
    description,
    image: historyImage,
    imageAlt: historyImage?.alt ?? "",
    href: "/history",
    reviewStatus: statusOf(scope, page, ["homeIntroHeading", "title", "intro", "historyImage"]),
  };
}

function worshipView(result, scope) {
  if (!isOk(result)) return null;
  const page = result.data;
  const steps = [...(page.worshipSteps ?? [])]
    .filter((step) => text(step?.title))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((step) => ({ id: String(step.key), title: step.title.trim(), description: text(step.detail) }));
  if (!steps.length) return null;
  return { steps, reviewStatus: statusOf(scope, page, ["worshipSteps"]) };
}

function featuredView(result, scope) {
  const docs = listOf(result);
  if (!docs.length) return null;
  const items = docs.slice(0, HOMEPAGE_LIMITS.featuredItems).map((doc) => {
    const category = doc.categoryId ? result.categories?.get(String(doc.categoryId)) : null;
    return {
      ...normalizeSacredItem({
        id: String(doc._id),
        name: doc.name,
        summary: text(doc.excerpt),
        category: category ? { id: category.slug, label: category.name } : null,
        image: image(result.media, doc.primaryImage),
        // Detail pages exist (C2.1); slugs come from the record.
        href: isValidSlug(doc.slug) ? `/sakkara/${doc.slug}` : null,
      }),
      reviewStatus: statusOf(scope, doc, ["name", "excerpt", "primaryImage", "categoryId"]),
    };
  });
  return { catalogHref: "/sakkara", items };
}

// Featured sacred object (the dark-blue coin section of the legacy
// homepage): the first sacred item of type "sacred_object" in sortOrder,
// from the same scoped query as the featured items. Only stored values are
// used: name, excerpt, primary image (with its alt and presentation hint),
// and slug. Variants, quantities, and the price note are never shown here.
// The name is split before " รุ่น " into a lead and a rest line for the
// two-line title; a name without it stays one line.
export function featuredObjectView(result, scope) {
  const doc = listOf(result).find((item) => item?.type === "sacred_object" && isValidSlug(item.slug) && text(item.name));
  if (!doc) return null;
  const name = text(doc.name);
  const split = name.indexOf(" รุ่น ");
  return {
    id: String(doc._id),
    name,
    titleLead: split > 0 ? name.slice(0, split) : name,
    titleRest: split > 0 ? name.slice(split + 1) : null,
    summary: text(doc.excerpt),
    image: image(result.media, doc.primaryImage),
    href: `/sakkara/${doc.slug}`,
    reviewStatus: statusOf(scope, doc, ["name", "excerpt", "primaryImage"]),
  };
}

function newsView(result, scope) {
  const docs = listOf(result);
  if (!docs.length) return null;
  return docs.slice(0, HOMEPAGE_LIMITS.news).map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    publicationDate: formatThaiDate(doc.date),
    description: text(doc.excerpt) ?? "",
    image: image(result.media, doc.coverImage),
    // Article pages exist (C2.2); slugs come from the record.
    href: isValidSlug(doc.slug) ? `/news/${doc.slug}` : null,
    reviewStatus: statusOf(scope, doc, ["title", "date", "excerpt", "coverImage"]),
  }));
}

// Images that fail the scope's media rule do not resolve; the next eligible
// image takes their place, so the grid never shows an empty tile.
export function galleryView(result) {
  const items = [];
  for (const doc of listOf(result)) {
    const resolved = image(result.media, doc.image);
    if (!resolved) continue;
    items.push({
      id: String(doc._id),
      label: resolved.caption ?? resolved.alt,
      image: resolved,
      alt: resolved.alt,
      layout: GALLERY_LAYOUTS[items.length % GALLERY_LAYOUTS.length],
    });
    if (items.length >= HOMEPAGE_LIMITS.gallery) break;
  }
  return items.length ? items : null;
}

function faqView(result, scope) {
  const items = listOf(result)
    .filter((doc) => doc.showOnHome === true && text(doc.question) && text(doc.answer))
    .map((doc) => ({ id: String(doc._id), question: doc.question.trim(), answer: doc.answer.trim(), reviewStatus: statusOf(scope, doc, ["question", "answer"]) }));
  return items.length ? items : null;
}

// Loads every homepage section in parallel. The limits are upper bounds
// (every migrated collection is smaller), so a record whose media fails the
// scope's rule is simply skipped and the next one takes its place.
export async function loadHomepageSections(repositories) {
  const [siteSettings, banners, sacredItems, news, gallery, faqs, historyPage] = await Promise.all([
    // Shared with the header and footer within one request (index.js).
    repositories.siteSettings(),
    repositories.banners({ limit: REVIEW_QUERY_LIMITS.banners }),
    repositories.sacredItems({ limit: REVIEW_QUERY_LIMITS.sacredItems }),
    repositories.news({ limit: REVIEW_QUERY_LIMITS.news }),
    repositories.gallery({ limit: REVIEW_QUERY_LIMITS.gallery }),
    repositories.faqs({ limit: REVIEW_QUERY_LIMITS.faqs }),
    repositories.historyPage(),
  ]);
  return { siteSettings, banners, sacredItems, news, gallery, faqs, historyPage };
}

// Review repositories (service.withReviewAccess).
export const loadReviewHomepageContent = loadHomepageSections;

// Overrides are review-only; the public scope never reads them.
const overridesFor = (scope, overrides) => (isPublic(scope) ? null : overrides);

// Header and footer data from the site settings alone (brand, compact
// contact summary, confirmed directions). Used on every page, so it never
// loads the homepage sections. Same view rules as the homepage.
// Public scope adds contactConfig: verified, validated values for
// getContactActions() (phone, LINE, Maps), or null.
export function buildSiteChrome(siteSettings, { scope = "review", overrides = REVIEW_CONFIRMED_OVERRIDES } = {}) {
  if (!siteSettings || siteSettings.status === "unavailable") return { status: "unavailable" };
  const visitor = visitorViews(siteSettings, overridesFor(scope, overrides), scope);
  if (isPublic(scope)) {
    const directionsHref = visitor.contact?.directions?.href ?? null;
    return {
      status: "ok",
      brand: brandView(siteSettings),
      footer: visitor.footer,
      confirmedDirectionsHref: directionsHref,
      contactConfig: visitor.contact?.actionConfig ? { ...visitor.contact.actionConfig, directionsUrl: directionsHref } : null,
    };
  }
  return {
    status: "ok",
    brand: brandView(siteSettings),
    footer: visitor.footer,
    confirmedDirectionsHref: reviewMapsUrl(overrides?.directionsUrl),
  };
}

export function buildReviewChrome(siteSettings, { overrides = REVIEW_CONFIRMED_OVERRIDES } = {}) {
  return buildSiteChrome(siteSettings, { scope: "review", overrides });
}

// content: result of loadHomepageSections(). scope: "review" | "public".
// overrides: owner-confirmed values (overrides.js), review scope only.
export function buildHomepage(content, { scope = "review", overrides = REVIEW_CONFIRMED_OVERRIDES } = {}) {
  const scopedOverrides = overridesFor(scope, overrides);
  const visitor = visitorViews(content.siteSettings, scopedOverrides, scope);
  const view = {
    brand: brandView(content.siteSettings),
    banner: heroView(content.siteSettings, content.banners, scope),
    quickInformation: visitor.quickInformation,
    about: aboutView(content.historyPage, scope),
    featuredItems: featuredView(content.sacredItems, scope),
    featuredObject: featuredObjectView(content.sacredItems, scope),
    worshipGuide: worshipView(content.historyPage, scope),
    news: newsView(content.news, scope),
    gallery: galleryView(content.gallery),
    visit: visitor.visit,
    faq: faqView(content.faqs, scope),
    footer: visitor.footer,
  };
  const sections = {
    siteSettings: sectionStatus(content.siteSettings),
    banners: sectionStatus(content.banners),
    about: sectionStatus(content.historyPage),
    worshipGuide: sectionStatus(content.historyPage),
    featuredItems: sectionStatus(content.sacredItems),
    news: sectionStatus(content.news),
    gallery: sectionStatus(content.gallery),
    faq: sectionStatus(content.faqs),
  };
  const coverage = {
    banners: { available: listOf(content.banners).length, rendered: view.banner?.desktopImage ? 1 : 0 },
    sacredItems: { available: listOf(content.sacredItems).length, rendered: view.featuredItems?.items.length ?? 0 },
    news: { available: listOf(content.news).length, rendered: view.news?.length ?? 0 },
    gallery: { available: listOf(content.gallery).length, rendered: view.gallery?.length ?? 0 },
    faqs: { available: listOf(content.faqs).length, rendered: view.faq?.length ?? 0 },
    worshipSteps: { available: view.worshipGuide?.steps.length ?? 0, rendered: view.worshipGuide?.steps.length ?? 0 },
  };
  // Review: owner-confirmed directions do not depend on the database read.
  // Public: the verified, validated stored link only.
  const confirmedDirectionsHref = isPublic(scope) ? (visitor.contact?.directions?.href ?? null) : reviewMapsUrl(overrides?.directionsUrl);
  const quickActions = QUICK_ACTIONS.filter((action) => view[action.section] || (action.id === "directions" && confirmedDirectionsHref))
    .map(({ section: _section, ...action }) =>
      action.id === "directions" && confirmedDirectionsHref ? { id: "directions", href: confirmedDirectionsHref, icon: "route", label: "นำทางไปศาล", external: true } : action,
    );
  const allUnavailable = Object.values(sections).every((status) => status === "unavailable");
  const result = { status: allUnavailable ? "unavailable" : "ok", ...view, confirmedDirectionsHref, quickActions, sections, coverage };
  if (isPublic(scope)) {
    result.contactConfig = visitor.contact?.actionConfig ? { ...visitor.contact.actionConfig, directionsUrl: confirmedDirectionsHref } : null;
  }
  return result;
}

export function buildReviewHomepage(content, { overrides = REVIEW_CONFIRMED_OVERRIDES } = {}) {
  return buildHomepage(content, { scope: "review", overrides });
}
