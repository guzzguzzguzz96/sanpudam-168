import "server-only";
import { getContactActions, getLineUrl, getMapsUrl, getPhoneHref } from "../../lib/contact-actions.js";
import { normalizeSacredItem } from "../../lib/sacred-items.js";

// Adapters: CMS documents -> the props the existing homepage components
// already accept (the shape of src/data/homepage-preview.js). They:
// - output only whitelisted fields (no legacy, migration, or review data);
// - never invent values: a missing CMS value keeps the section's approved
//   fallback copy, or null where the component handles null;
// - take repository results ({ status, data, media }) and fall back as a
//   whole when a result is not "ok".
//
// routes: which public routes exist. Links are emitted only for routes that
// exist, matching the current preview behavior.

const DEFAULT_ROUTES = { sacredItems: false, sacredItemDetail: false, newsDetail: false };
const isOk = (result) => result?.status === "ok" && result.data;
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// "2026-10-29" -> "29 ตุลาคม 2569" (date-only; no timezone shift).
export function formatThaiDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

// LINE official account id ("@name") -> add-friend URL; full URLs are
// validated as-is. Anything else yields null.
export function lineUrlFromId(lineId) {
  const value = text(lineId);
  if (!value) return null;
  if (value.startsWith("https://")) return getLineUrl(value);
  if (!/^@?[A-Za-z0-9._-]{3,30}$/.test(value)) return null;
  const id = value.startsWith("@") ? value : `@${value}`;
  return getLineUrl(`https://line.me/R/ti/p/${encodeURIComponent(id)}`);
}

// Hero: first banner whose image resolves + site identity. CTAs and the
// eyebrow are interface copy and stay as approved.
export function adaptHeroBanner({ banners, siteSettings }, fallback) {
  const identity = isOk(siteSettings) ? siteSettings.data.identity : null;
  let desktopImage = null;
  let mobileImage = null;
  if (isOk(banners)) {
    for (const banner of banners.data) {
      desktopImage = banners.media.resolve(banner.image);
      if (desktopImage) {
        mobileImage = banners.media.resolve(banner.mobileImage);
        break;
      }
    }
  }
  return {
    ...fallback,
    title: text(identity?.name) ?? fallback.title,
    description: text(identity?.description) ?? fallback.description,
    desktopImage,
    mobileImage,
    desktopFocalPoint: desktopImage?.focalPoint ?? fallback.desktopFocalPoint,
    mobileFocalPoint: mobileImage?.focalPoint ?? desktopImage?.focalPoint ?? fallback.mobileFocalPoint,
  };
}

export function adaptFeaturedItems(result, fallback, { limit = 3, routes = DEFAULT_ROUTES } = {}) {
  if (!isOk(result)) return fallback;
  const items = result.data.slice(0, limit).map((doc) => {
    const category = doc.categoryId ? result.categories?.get(String(doc.categoryId)) : null;
    return normalizeSacredItem({
      id: String(doc._id),
      name: doc.name,
      summary: text(doc.excerpt),
      category: category ? { id: category.slug, label: category.name } : null,
      image: result.media.resolve(doc.primaryImage),
      href: routes.sacredItemDetail && doc.slug ? `/sakkara/${doc.slug}` : null,
    });
  });
  return items.length ? { catalogHref: routes.sacredItems ? "/sakkara" : fallback.catalogHref, items } : fallback;
}

export function adaptLatestNews(result, fallback, { limit = 3, routes = DEFAULT_ROUTES } = {}) {
  if (!isOk(result)) return fallback;
  const items = result.data.slice(0, limit).map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    publicationDate: formatThaiDate(doc.date),
    description: text(doc.excerpt) ?? "",
    image: result.media.resolve(doc.coverImage),
    href: routes.newsDetail && doc.slug ? `/news/${doc.slug}` : null,
  }));
  return items.length ? items : fallback;
}

// Gallery keeps the approved mosaic: layout classes follow the fallback
// pattern by position. Items without a resolvable image are skipped.
export function adaptGallery(result, fallback, { limit = fallback.length } = {}) {
  if (!isOk(result)) return fallback;
  const items = [];
  for (const doc of result.data) {
    const image = result.media.resolve(doc.image);
    if (!image) continue;
    items.push({
      id: String(doc._id),
      label: image.caption ?? image.alt,
      image,
      alt: image.alt,
      layout: fallback[items.length % fallback.length]?.layout ?? "",
    });
    if (items.length >= limit) break;
  }
  return items.length ? items : fallback;
}

export function adaptAbout(result, fallback) {
  if (!isOk(result)) return fallback;
  const page = result.data;
  const image = result.media.resolve(page.historyImage);
  return {
    ...fallback,
    title: text(page.homeIntroHeading) ?? text(page.title) ?? fallback.title,
    description: text(page.intro) ?? fallback.description,
    image,
    imageAlt: image?.alt ?? "",
  };
}

export function adaptWorshipGuide(result, fallback) {
  if (!isOk(result)) return fallback;
  const steps = [...(result.data.worshipSteps ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((step) => text(step.title))
    .map((step) => ({ id: step.key, title: step.title, description: text(step.detail) }));
  return steps.length ? steps : fallback;
}

export function adaptFaq(result, fallback) {
  if (!isOk(result)) return fallback;
  const items = result.data
    .filter((doc) => text(doc.question) && text(doc.answer))
    .map((doc) => ({ id: String(doc._id), question: doc.question, answer: doc.answer }));
  return items.length ? items : fallback;
}

// Contact channels come from site settings only when the owner verified
// them (contact.verified) and each value passes the same validation as
// src/config/site.js. Unverified values are never shown.
export function adaptContactConfig(result) {
  if (!isOk(result) || result.data.contact?.verified !== true) return null;
  const contact = result.data.contact;
  return {
    lineInquiryUrl: lineUrlFromId(contact.lineId),
    directionsUrl: getMapsUrl(contact.directionsUrl),
    phoneNumber: getPhoneHref(contact.phoneNumber) ? contact.phoneNumber.trim() : null,
  };
}

function replaceValue(items, id, value) {
  return items.map((item) => (item.id === id && value ? { ...item, value } : item));
}

// Quick information and visit details from site settings. Each missing
// value keeps the approved "pending" copy of the fallback item.
export function adaptVisitorInformation(result, fallback) {
  if (!isOk(result)) return { quickInformation: fallback.quickInformation, visit: fallback.visit, contactConfig: null };
  const settings = result.data;
  const hours = settings.openingHours
    ? [text(settings.openingHours.daysText), text(settings.openingHours.displayText)].filter(Boolean).join(" ") || null
    : null;
  const contactConfig = adaptContactConfig(result);
  const contactValue = contactConfig?.phoneNumber ?? null;

  let quickInformation = replaceValue(fallback.quickInformation, "hours", hours);
  quickInformation = replaceValue(quickInformation, "location", text(settings.contact?.locationShort));
  quickInformation = replaceValue(quickInformation, "contact", contactValue);

  let visit = replaceValue(fallback.visit, "hours", hours);
  visit = replaceValue(visit, "address", text(settings.contact?.address));
  visit = replaceValue(visit, "contact", contactValue);

  return { quickInformation, visit, contactConfig };
}

// Quick actions: in-page anchors stay; external contact actions appear only
// for verified, valid contact values.
export function adaptQuickActions(contactConfig, fallback) {
  if (!contactConfig) return fallback;
  const verified = Object.fromEntries(getContactActions(["line", "maps"], contactConfig).map((action) => [action.id, action]));
  const actions = fallback
    .filter((action) => action.id !== "line")
    .map((action) =>
      action.id === "directions" && verified.maps
        ? { id: "directions", href: verified.maps.href, icon: "route", label: "นำทางไปศาล", external: true }
        : action,
    );
  if (verified.line) actions.push({ id: "line", href: verified.line.href, icon: "chat", label: "สอบถามทาง LINE", external: true });
  return actions;
}

// content: the result of getPublicHomepageContent() (or null when not
// loaded). Returns the full homepage props object; with no usable content
// it returns the fallback unchanged.
export function composeHomepageData(content, fallback, options = {}) {
  if (!content) return { ...fallback, contactConfig: null };
  const visitor = adaptVisitorInformation(content.siteSettings, fallback);
  return {
    ...fallback,
    banner: adaptHeroBanner(content, fallback.banner),
    quickInformation: visitor.quickInformation,
    quickActions: adaptQuickActions(visitor.contactConfig, fallback.quickActions),
    about: adaptAbout(content.historyPage, fallback.about),
    featuredItems: adaptFeaturedItems(content.sacredItems, fallback.featuredItems, options),
    worshipGuide: adaptWorshipGuide(content.historyPage, fallback.worshipGuide),
    news: adaptLatestNews(content.news, fallback.news, options),
    gallery: adaptGallery(content.gallery, fallback.gallery),
    visit: visitor.visit,
    faq: adaptFaq(content.faqs, fallback.faq),
    // For VisitUs/getContactActions once integration is approved.
    contactConfig: visitor.contactConfig,
  };
}
