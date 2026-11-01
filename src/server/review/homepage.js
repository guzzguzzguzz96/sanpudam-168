import "server-only";
import { formatThaiDate, lineUrlFromId } from "../cms/adapters.js";
import { isValidSlug } from "../cms/policy.js";
import { getPhoneHref } from "../../lib/contact-actions.js";
import { normalizeSacredItem } from "../../lib/sacred-items.js";
import { REVIEW_CONFIRMED_OVERRIDES } from "./overrides.js";

// Client Review homepage: migrated MongoDB content -> plain view data for
// the existing homepage components (docs/client-review-mode.md).
//
// Rules:
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

// Same-section image layouts as the approved gallery mosaic.
const GALLERY_LAYOUTS = ["home-gallery__item--feature", "", "", "", "home-gallery__item--wide"];

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

export function reviewSocialLink(link) {
  const platform = SOCIAL_HOSTS[link?.platform];
  const url = parseHttps(link?.url);
  if (!platform || !url || !platform.hosts.includes(url.hostname)) return null;
  return { platform: link.platform, label: platform.label, value: `${url.hostname}${url.pathname}`.replace(/\/$/, ""), verified: link.verified === true };
}

function image(media, ref) {
  const resolved = media?.resolve(ref) ?? null;
  return resolved ? { src: resolved.src, width: resolved.width, height: resolved.height, alt: resolved.alt, caption: resolved.caption, focalPoint: resolved.focalPoint } : null;
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

function heroView(siteSettings, banners) {
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
    reviewStatus: isOk(siteSettings) ? describeReviewStatus(siteSettings.data, ["identity"]) : null,
  };
}

// Directions: an owner-confirmed override (overrides.js) wins; otherwise the
// imported link is used only if it passes validation and stays labeled.
// An invalid override is ignored (never silently swapped for the import).
function directionsView(contact, overrides, note) {
  const confirmedHref = reviewMapsUrl(overrides?.directionsUrl);
  if (confirmedHref) return { status: "confirmed", confirmed: true, href: confirmedHref, note: null };
  const importedHref = reviewMapsUrl(contact.directionsUrl);
  if (importedHref) return { status: "imported", confirmed: false, href: importedHref, note };
  return text(contact.directionsUrl) ? { status: "invalid", confirmed: false, href: null, note: REVIEW_LABELS.invalidDirections } : null;
}

// Contact values: validated, displayed as text, and labeled unless the
// owner has verified the contact block.
function contactView(settings, overrides) {
  const contact = settings?.contact ?? {};
  const verified = contact.verified === true;
  const note = verified ? null : REVIEW_LABELS.unverifiedContact;
  const phone = getPhoneHref(contact.phoneNumber) ? contact.phoneNumber.trim() : null;
  const lineId = lineUrlFromId(contact.lineId) && !text(contact.lineId)?.startsWith("https://") ? text(contact.lineId) : null;
  const parts = [phone ? `โทร ${phone}` : null, lineId ? `LINE ${lineId}` : null].filter(Boolean);
  return {
    verified,
    address: text(contact.address) ? { value: text(contact.address), note } : null,
    locationShort: text(contact.locationShort) ? { value: text(contact.locationShort), note } : null,
    channels: parts.length ? { value: parts.join(" · "), note } : null,
    phone,
    lineId,
    directions: directionsView(contact, overrides, note),
  };
}

function hoursView(settings) {
  const hours = settings?.openingHours;
  if (!hours) return null;
  const value = [text(hours.daysText), text(hours.displayText)].filter(Boolean).join(" ");
  if (!value) return null;
  const status = describeReviewStatus(settings, ["openingHours"]);
  return { value, note: status?.tone === "sample" ? `${REVIEW_LABELS.sample} (${status.fields.join(", ")})` : REVIEW_LABELS.unverifiedContact };
}

function visitorViews(result, overrides) {
  if (!isOk(result)) return { quickInformation: null, visit: null, footer: null };
  const settings = result.data;
  const hours = hoursView(settings);
  const contact = contactView(settings, overrides);

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

  const social = (settings.socialLinks ?? []).map(reviewSocialLink).filter(Boolean).map((link) => ({ ...link, note: link.verified ? null : REVIEW_LABELS.unverifiedContact }));

  return {
    quickInformation: quickInformation.length ? quickInformation : null,
    visit: details.length || contact.directions ? { details, directions: contact.directions } : null,
    footer: {
      details: [
        contact.address ? { id: "address", label: "ที่อยู่", ...contact.address } : null,
        contact.phone ? { id: "phone", label: "โทรศัพท์", value: contact.phone, note: contact.channels.note } : null,
        contact.lineId ? { id: "line", label: "LINE", value: contact.lineId, note: contact.channels.note } : null,
        ...social.map((link) => ({ id: `social-${link.platform}`, label: link.label, value: link.value, note: link.note })),
      ].filter(Boolean),
    },
  };
}

function aboutView(result) {
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
    reviewStatus: describeReviewStatus(page, ["homeIntroHeading", "title", "intro", "historyImage"]),
  };
}

function worshipView(result) {
  if (!isOk(result)) return null;
  const page = result.data;
  const steps = [...(page.worshipSteps ?? [])]
    .filter((step) => text(step?.title))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((step) => ({ id: String(step.key), title: step.title.trim(), description: text(step.detail) }));
  if (!steps.length) return null;
  return { steps, reviewStatus: describeReviewStatus(page, ["worshipSteps"]) };
}

function featuredView(result) {
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
      reviewStatus: describeReviewStatus(doc, ["name", "excerpt", "primaryImage", "categoryId"]),
    };
  });
  return { catalogHref: "/sakkara", items };
}

function newsView(result) {
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
    reviewStatus: describeReviewStatus(doc, ["title", "date", "excerpt", "coverImage"]),
  }));
}

function galleryView(result) {
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

function faqView(result) {
  const items = listOf(result)
    .filter((doc) => doc.showOnHome === true && text(doc.question) && text(doc.answer))
    .map((doc) => ({ id: String(doc._id), question: doc.question.trim(), answer: doc.answer.trim(), reviewStatus: describeReviewStatus(doc, ["question", "answer"]) }));
  return items.length ? items : null;
}

// Loads every section through review repositories (service.withReviewAccess).
export async function loadReviewHomepageContent(repositories) {
  const [siteSettings, banners, sacredItems, news, gallery, faqs, historyPage] = await Promise.all([
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

// content: result of loadReviewHomepageContent(). overrides: owner-confirmed
// values (overrides.js). Returns the view data.
export function buildReviewHomepage(content, { overrides = REVIEW_CONFIRMED_OVERRIDES } = {}) {
  const visitor = visitorViews(content.siteSettings, overrides);
  const view = {
    brand: brandView(content.siteSettings),
    banner: heroView(content.siteSettings, content.banners),
    quickInformation: visitor.quickInformation,
    about: aboutView(content.historyPage),
    featuredItems: featuredView(content.sacredItems),
    worshipGuide: worshipView(content.historyPage),
    news: newsView(content.news),
    gallery: galleryView(content.gallery),
    visit: visitor.visit,
    faq: faqView(content.faqs),
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
  // Owner-confirmed directions do not depend on the database read.
  const confirmedDirectionsHref = reviewMapsUrl(overrides?.directionsUrl);
  const quickActions = QUICK_ACTIONS.filter((action) => view[action.section] || (action.id === "directions" && confirmedDirectionsHref))
    .map(({ section: _section, ...action }) =>
      action.id === "directions" && confirmedDirectionsHref ? { id: "directions", href: confirmedDirectionsHref, icon: "route", label: "นำทางไปศาล", external: true } : action,
    );
  const allUnavailable = Object.values(sections).every((status) => status === "unavailable");
  return { status: allUnavailable ? "unavailable" : "ok", ...view, confirmedDirectionsHref, quickActions, sections, coverage };
}
