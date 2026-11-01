import "server-only";
import { describeReviewStatus } from "../review/homepage.js";

// View data for /history, /sakkara, and /sakkara/[slug]
// (docs/client-review-mode.md §12). The same builders serve both scopes:
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
