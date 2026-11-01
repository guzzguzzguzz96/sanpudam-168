import "server-only";
import { formatThaiDate, lineUrlFromId } from "../cms/adapters.js";
import { isValidSlug } from "../cms/policy.js";
import { REVIEW_LABELS, describeReviewStatus, reviewMapsUrl, reviewSocialLink } from "../review/homepage.js";
import { getPhoneHref } from "../../lib/contact-actions.js";

// View data for /history, /sakkara, /sakkara/[slug], /news, /news/[slug],
// and /visit (docs/client-review-mode.md §12–§13). The same builders serve both scopes:
// public repositories only return published, approved, placeholder-free
// records (so no labels appear), and review repositories return the
// migrated drafts with their placeholder labels.
//
// Rules: explicit field selection, string ids, no raw documents or
// legacy/migration/review metadata, nothing invented. Long text stays in
// its stored legacy-text-v1 form until parseLegacyText() turns it into
// plain paragraph data (no HTML is produced or accepted).

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const byOrder = (list) => [...(list ?? [])].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));

// legacy-text-v1 (docs/legacy-data-mapping.md §8): a blank line starts a
// paragraph and **text** is bold. Anything else, including HTML-looking
// text, stays literal text. Returns [[{ text, strong }], ...].
export function parseLegacyText(value) {
  const source = text(value);
  if (!source) return [];
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => {
      const segments = [];
      const pattern = /\*\*(.+?)\*\*/g;
      let last = 0;
      for (const match of paragraph.matchAll(pattern)) {
        if (match.index > last) segments.push({ text: paragraph.slice(last, match.index), strong: false });
        segments.push({ text: match[1], strong: true });
        last = match.index + match[0].length;
      }
      if (last < paragraph.length) segments.push({ text: paragraph.slice(last), strong: false });
      return segments;
    });
}

function image(media, ref) {
  const resolved = media?.resolve(ref) ?? null;
  return resolved ? { src: resolved.src, width: resolved.width, height: resolved.height, alt: resolved.alt, focalPoint: resolved.focalPoint } : null;
}

function categoryView(category) {
  return category && text(category.name) ? { id: String(category.slug ?? category._id), label: category.name.trim() } : null;
}

// --- /history ------------------------------------------------------------

export function buildHistoryPage(result) {
  const page = result.data;
  const media = result.media;
  const coat = page.coatOfArms ?? null;
  return {
    title: text(page.title),
    intro: text(page.intro),
    image: image(media, page.historyImage),
    body: parseLegacyText(page.historyBody),
    quote: text(page.quote),
    coatOfArms: coat && text(coat.heading)
      ? {
          heading: coat.heading.trim(),
          body: parseLegacyText(coat.body),
          image: image(media, coat.image),
          parts: byOrder(coat.parts)
            .filter((part) => text(part?.part))
            .map((part) => ({ id: String(part.key), part: part.part.trim(), meaning: text(part.meaning) })),
        }
      : null,
    wishTopics: byOrder(page.wishTopics)
      .filter((topic) => text(topic?.topic))
      .map((topic) => ({ id: String(topic.key), topic: topic.topic.trim(), description: text(topic.description) })),
    worshipSteps: byOrder(page.worshipSteps)
      .filter((step) => text(step?.title))
      .map((step) => ({ id: String(step.key), title: step.title.trim(), description: text(step.detail) })),
    // Sample labels next to the affected parts of the page.
    status: {
      intro: onlyShown(describeReviewStatus(page, ["title", "intro", "historyImage"])),
      body: onlyShown(describeReviewStatus(page, ["historyBody"])),
      coatOfArms: onlyShown(describeReviewStatus(page, ["coatOfArms", "quote"])),
      wishTopics: onlyShown(describeReviewStatus(page, ["wishTopics"])),
      worshipSteps: onlyShown(describeReviewStatus(page, ["worshipSteps"])),
    },
  };
}

// A block shows a label only for its own placeholder fields ("sample"),
// not for placeholders elsewhere in the record ("pending").
export function onlyShown(status) {
  return status?.tone === "sample" ? status : null;
}

// --- /sakkara ------------------------------------------------------------

export function buildSacredItemsPage(result) {
  return result.data.map((doc) => {
    const category = doc.categoryId ? result.categories?.get(String(doc.categoryId)) : null;
    return {
      id: String(doc._id),
      name: doc.name,
      summary: text(doc.excerpt),
      category: categoryView(category),
      image: image(result.media, doc.primaryImage),
      href: `/sakkara/${doc.slug}`,
      reviewStatus: describeReviewStatus(doc, ["name", "excerpt", "primaryImage", "categoryId"]),
    };
  });
}

// --- /sakkara/[slug] -----------------------------------------------------

export function buildSacredItemPage(result) {
  const doc = result.data;
  const shown = (path) => onlyShown(describeReviewStatus(doc, [path]));
  return {
    name: doc.name,
    slug: doc.slug,
    category: categoryView(result.category),
    image: image(result.media, doc.primaryImage),
    summary: text(doc.excerpt),
    body: parseLegacyText(doc.body),
    prayerTopics: text(doc.prayerTopics),
    offerings: text(doc.offerings),
    // Variant names only. Quantities appear only when the record allows
    // it; inquiryText (legacy price note) is deliberately not shown.
    variants: byOrder(doc.variants)
      .filter((variant) => text(variant?.name))
      .map((variant) => ({
        id: String(variant.key),
        name: variant.name.trim(),
        quantity: doc.showVariantQuantities === true && Number.isFinite(variant.quantity) ? variant.quantity : null,
      })),
    status: {
      summary: shown("excerpt"),
      body: shown("body"),
      prayerTopics: shown("prayerTopics"),
      offerings: shown("offerings"),
    },
  };
}

// --- /news ---------------------------------------------------------------

// Ordering comes from the repository: `date` descending, then `_id`
// (docs/frontend-data-integration.md §5). `date` is the article's own
// date-only field, never a migration or createdAt timestamp.
export function buildNewsListPage(result) {
  return result.data.map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    publicationDate: formatThaiDate(doc.date),
    description: text(doc.excerpt) ?? "",
    image: image(result.media, doc.coverImage),
    href: isValidSlug(doc.slug) ? `/news/${doc.slug}` : null,
    reviewStatus: describeReviewStatus(doc, ["title", "date", "excerpt", "coverImage"]),
  }));
}

// --- /news/[slug] --------------------------------------------------------

export function buildNewsArticlePage(result) {
  const doc = result.data;
  const shown = (path) => onlyShown(describeReviewStatus(doc, [path]));
  return {
    title: doc.title,
    slug: doc.slug,
    publicationDate: formatThaiDate(doc.date),
    image: image(result.media, doc.coverImage),
    summary: text(doc.excerpt),
    body: parseLegacyText(doc.body),
    // Article images in stored order; no captions exist, none are added.
    images: (doc.images ?? []).map((ref) => image(result.media, ref)).filter(Boolean),
    status: {
      title: shown("title"),
      date: shown("date"),
      summary: shown("excerpt"),
      body: shown("body"),
    },
  };
}

// --- /visit --------------------------------------------------------------

// scope "review": imported values are shown as text with their labels;
// only an owner-confirmed directions override becomes an action (an
// imported link that passes validation is shown labeled).
// scope "public": the published record only. Phone, LINE, directions, and
// social links appear only when the owner has verified them; the
// review-only override is never used.
export function buildVisitPage(result, { scope, overrides = null }) {
  const settings = result.data;
  const contact = settings.contact ?? {};
  const isReview = scope === "review";
  const verified = contact.verified === true;
  const unverifiedNote = isReview && !verified ? REVIEW_LABELS.unverifiedContact : null;

  const hoursValue = [text(settings.openingHours?.daysText), text(settings.openingHours?.displayText)].filter(Boolean).join(" ") || null;
  const hoursStatus = isReview ? onlyShown(describeReviewStatus(settings, ["openingHours"])) : null;
  const phone = getPhoneHref(contact.phoneNumber) ? contact.phoneNumber.trim() : null;
  const lineId = lineUrlFromId(contact.lineId) && !text(contact.lineId)?.startsWith("https://") ? text(contact.lineId) : null;
  const showContacts = isReview || verified;

  let directions = null;
  if (isReview) {
    const confirmed = reviewMapsUrl(overrides?.directionsUrl);
    const imported = reviewMapsUrl(contact.directionsUrl);
    if (confirmed) directions = { href: confirmed, confirmed: true, note: null };
    else if (imported) directions = { href: imported, confirmed: false, note: unverifiedNote };
    else if (text(contact.directionsUrl)) directions = { href: null, confirmed: false, note: REVIEW_LABELS.invalidDirections };
  } else if (verified && reviewMapsUrl(contact.directionsUrl)) {
    directions = { href: reviewMapsUrl(contact.directionsUrl), confirmed: true, note: null };
  }

  return {
    name: text(settings.identity?.name),
    hours: hoursValue ? { value: hoursValue, note: hoursStatus ? `${hoursStatus.label} (${hoursStatus.fields.join(", ")})` : unverifiedNote } : null,
    address: text(contact.address) ? { value: text(contact.address), note: unverifiedNote } : null,
    locationShort: text(contact.locationShort) ? { value: text(contact.locationShort), note: unverifiedNote } : null,
    contacts: showContacts
      ? [
          phone ? { id: "phone", label: "โทรศัพท์", value: phone, note: unverifiedNote } : null,
          lineId ? { id: "line", label: "LINE", value: lineId, note: unverifiedNote } : null,
        ].filter(Boolean)
      : [],
    social: (settings.socialLinks ?? [])
      .map(reviewSocialLink)
      .filter((link) => link && (isReview || link.verified))
      .map((link) => ({ id: `social-${link.platform}`, label: link.label, value: link.value, note: isReview && !link.verified ? REVIEW_LABELS.unverifiedContact : null })),
    directions,
    // Clickable phone/LINE actions: public and owner-verified only.
    verifiedContact: !isReview && verified ? { phoneNumber: phone, lineInquiryUrl: lineUrlFromId(contact.lineId) } : null,
  };
}
