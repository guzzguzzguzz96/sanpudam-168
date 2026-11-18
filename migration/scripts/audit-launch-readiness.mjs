// Launch-readiness audit of the staging database (read-only).
//
//   node --env-file=.env.local --import ./tests/support/register.mjs \
//     migration/scripts/audit-launch-readiness.mjs
//
// Reads sanpudam168_staging with the Client Review read-only account
// (CLIENT_REVIEW_MONGODB_URI / CLIENT_REVIEW_MONGODB_DB_NAME) through the
// native driver with a command allowlist (lib/mongo-readonly.mjs). The run
// fails unless the authenticated user holds only read@sanpudam168_staging.
// Nothing is written to any database. The report (content text only, no
// connection details) goes to migration/reports/launch-readiness-audit.*,
// which is git-ignored.
//
// The --import hook stubs "server-only" so the app's own validators
// (contact-actions, review homepage helpers) are reused unchanged.
import { writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { openReadOnlyDatabase } from "./lib/mongo-readonly.mjs";
import { configureMongoDns } from "./lib/dns-config.mjs";
import { fromRoot, writeJson } from "./lib/files.mjs";
import { SLUG_PATTERN, collectImageRefs, publishIssues } from "../../src/models/shared.js";
import { modelsByCollection } from "../../src/models/index.js";
import { sanitizeError } from "../../src/lib/db.js";
import { getLineUrl, getMapsUrl, getPhoneHref } from "../../src/lib/contact-actions.js";
import { lineUrlFromId } from "../../src/server/cms/adapters.js";
import { reviewMapsUrl, reviewSocialLink } from "../../src/server/review/homepage.js";
import { REVIEW_CONFIRMED_OVERRIDES } from "../../src/server/review/overrides.js";

const STAGING_DB = "sanpudam168_staging";
const BASELINE = {
  news: 3, gallery_items: 10, banners: 4, sacred_items: 5, categories: 3, videos: 1,
  reviews: 3, faqs: 6, team_members: 2, pages: 1, site_settings: 1, media_assets: 17,
};
const CONTENT_COLLECTIONS = Object.keys(BASELINE).filter((c) => c !== "media_assets");
// Not published in this launch (owner decision).
const NOT_LAUNCHED = new Set(["videos", "reviews", "team_members"]);
const SKIP_TEXT_KEYS = new Set(["_id", "legacy", "migration", "placeholderFields", "review", "mediaMapping", "createdBy", "updatedBy", "createdAt", "updatedAt", "__v", "status", "bodyFormat", "key", "slug", "icon", "galleryKey", "platform"]);
const WORD_MARKERS = [/ตัวอย่าง/, /placeholder/i, /lorem/i, /\bTODO\b/i, /\bTBD\b/i, /xxx/i];
// "รอ" is also a syllable of many words (รอบ, ครอบ ...). Only flag it as a
// standalone word: start of text or after a space/punctuation, and not
// followed by "บ" (รอบ).
const WAIT_MARKER = /(^|[\s(（"“'‘:：,，/\-])รอ(?!บ)/;

const uri = process.env.CLIENT_REVIEW_MONGODB_URI?.trim();
const dbName = process.env.CLIENT_REVIEW_MONGODB_DB_NAME?.trim();
if (!uri || !dbName) throw new Error("CLIENT_REVIEW_MONGODB_URI and CLIENT_REVIEW_MONGODB_DB_NAME must be set.");
if (dbName !== STAGING_DB) throw new Error(`CLIENT_REVIEW_MONGODB_DB_NAME must be ${STAGING_DB}.`);

const dnsEnv = { MONGODB_DNS_SERVERS: process.env.CLIENT_REVIEW_DNS_SERVERS || process.env.MONGODB_DNS_SERVERS };
configureMongoDns(dnsEnv);

const idOf = (value) => (value == null ? null : String(value));
const getPath = (doc, path) => path.split(".").reduce((value, part) => (value == null ? undefined : value[part]), doc);
const labelOf = (collection, doc) => doc.slug ?? doc.key ?? doc.manifestId ?? (collection === "faqs" ? `faq#${doc.sortOrder}` : collection === "gallery_items" || collection === "banners" ? `${collection}#${doc.sortOrder}` : idOf(doc._id));

function walkStrings(value, path, out) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object" && !(value instanceof Date) && !mongoose.isObjectIdOrHexString(value) && value._bsontype !== "ObjectId") {
    for (const [key, inner] of Object.entries(value)) if (!SKIP_TEXT_KEYS.has(key)) walkStrings(inner, path ? `${path}.${key}` : key, out);
  }
  return out;
}

function snippet(value, index, radius = 30) {
  return value.slice(Math.max(0, index - radius), index + radius).replace(/\s+/g, " ");
}

function textIssues(strings) {
  const issues = [];
  for (const { path, value } of strings) {
    if (value.includes("�")) issues.push({ path, kind: "replacement_char", context: snippet(value, value.indexOf("�")) });
    const html = /<\/?[a-z!][^>]*>|&[a-z]+;|&#\d+;/i.exec(value);
    if (html) issues.push({ path, kind: "raw_html", context: snippet(value, html.index) });
    if (value !== value.trim()) issues.push({ path, kind: "surrounding_whitespace", context: JSON.stringify(value.slice(0, 20) + (value.length > 40 ? "…" : "") + value.slice(-20)) });
    if (/ {2,}|\t/.test(value.replace(/\n/g, ""))) issues.push({ path, kind: "double_space_or_tab", context: snippet(value, value.search(/ {2,}|\t/)) });
    for (const marker of WORD_MARKERS) {
      const match = marker.exec(value);
      if (match) issues.push({ path, kind: `marker:${marker.source}`, context: snippet(value, match.index) });
    }
    const wait = WAIT_MARKER.exec(value);
    if (wait) issues.push({ path, kind: "marker:รอ", context: snippet(value, wait.index) });
  }
  return issues;
}

// Mongoose validation (maxlength, enum, required, match) without a
// connection. Banner caption rules are path validators, so they run too.
async function schemaIssues(collection, doc) {
  const Model = modelsByCollection[collection];
  if (!Model) return [];
  try {
    await new Model(doc).validate();
    return [];
  } catch (error) {
    if (!error?.errors) throw error;
    return Object.values(error.errors).map((e) => ({ path: e.path, kind: e.kind, message: e.message }));
  }
}

// What would still block publishing once review is approved and every
// placeholder flag is confirmed (media resolution, category).
function residualPublishIssues(collection, doc) {
  const simulated = { ...doc, status: "published", review: { ...doc.review, status: "approved" }, placeholderFields: (doc.placeholderFields ?? []).map((f) => ({ ...f, status: "confirmed_correct" })) };
  const extra = collection === "sacred_items"
    ? (plain) => (!plain.categoryId || plain.categoryMapping?.status === "unresolved" ? ["category is not resolved"] : [])
    : () => [];
  return publishIssues(simulated, extra);
}

const startedAt = new Date();
let ro;
try {
  ro = await openReadOnlyDatabase(uri, dbName);
} catch (error) {
  throw sanitizeError(error, uri);
}

try {
  if (ro.databaseName !== STAGING_DB) throw new Error("Connected database is not the staging database.");
  const status = await ro.connectionStatus();
  const badRoles = status.roles.filter((r) => r.role !== "read" || r.db !== STAGING_DB);
  if (!status.roles.length || badRoles.length) throw new Error(`Audit refuses to run: the account must hold only read@${STAGING_DB}.`);

  const collections = (await ro.listCollections()).map((c) => c.name).sort();
  const data = {};
  for (const name of [...CONTENT_COLLECTIONS, "media_assets"]) data[name] = await ro.find(name, {}, { limit: 1000 });

  // 1. Counts
  const counts = Object.fromEntries(Object.keys(BASELINE).map((name) => [name, { baseline: BASELINE[name], actual: data[name].length, match: data[name].length === BASELINE[name] }]));
  const statusSummary = Object.fromEntries(CONTENT_COLLECTIONS.map((name) => {
    const tally = {};
    for (const doc of data[name]) {
      const key = `${doc.status}/${doc.review?.status}`;
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return [name, tally];
  }));

  // 2. Placeholder flags with the current value in full
  const placeholders = [];
  for (const name of CONTENT_COLLECTIONS) {
    for (const doc of data[name]) {
      for (const flag of doc.placeholderFields ?? []) {
        placeholders.push({
          collection: name,
          id: idOf(doc._id),
          record: labelOf(name, doc),
          path: flag.path,
          status: flag.status,
          source: flag.source,
          legacyPath: flag.legacyPath ?? null,
          note: flag.note ?? null,
          launched: !NOT_LAUNCHED.has(name),
          currentValue: getPath(doc, flag.path) ?? null,
        });
      }
    }
  }

  // 3. Media and usages
  const mediaById = new Map(data.media_assets.map((m) => [idOf(m._id), m]));
  const usages = new Map(data.media_assets.map((m) => [idOf(m._id), []]));
  const refProblems = [];
  for (const name of CONTENT_COLLECTIONS) {
    for (const doc of data[name]) {
      for (const { path, ref } of collectImageRefs(doc)) {
        const assetId = idOf(ref.assetId);
        const entry = { collection: name, record: labelOf(name, doc), path };
        if (!assetId) {
          refProblems.push({ ...entry, problem: "no assetId", mappingStatus: ref.mediaMapping?.status ?? null });
          continue;
        }
        if (!mediaById.has(assetId)) refProblems.push({ ...entry, assetId, problem: "assetId not found in media_assets" });
        else usages.get(assetId).push(entry);
        if (ref.mediaMapping?.status !== "resolved") refProblems.push({ ...entry, assetId, problem: `mediaMapping.status=${ref.mediaMapping?.status}` });
        if (!ref.alt?.trim()) refProblems.push({ ...entry, assetId, problem: "empty alt" });
      }
    }
  }
  const media = data.media_assets.map((m) => {
    const used = usages.get(idOf(m._id));
    const launchedUses = used.filter((u) => !NOT_LAUNCHED.has(u.collection));
    return {
      id: idOf(m._id),
      manifestId: m.manifestId,
      category: m.category,
      resourceType: m.resourceType,
      publicId: m.cloudinary?.publicId ?? null,
      secureUrlHostPath: m.cloudinary?.secureUrl ? new URL(m.cloudinary.secureUrl).pathname : null,
      size: `${m.width}x${m.height}`,
      rightsStatus: m.rights?.status ?? null,
      approvalStatus: m.approval?.status ?? null,
      containsIdentifiablePeople: m.rights?.containsIdentifiablePeople ?? null,
      consent: m.rights?.consent?.status ?? null,
      rightsNotes: m.rights?.notes ?? [],
      defaultAlt: m.defaultAlt ?? null,
      deletedAt: m.deletedAt ?? null,
      usedBy: used,
      orphan: used.length === 0,
      onlyUsedByNotLaunched: used.length > 0 && launchedUses.length === 0,
    };
  });

  // 4. Relationships and slugs
  const categoryIds = new Set(data.categories.map((c) => idOf(c._id)));
  const categoryProblems = data.sacred_items
    .filter((item) => !item.categoryId || !categoryIds.has(idOf(item.categoryId)) || item.categoryMapping?.status === "unresolved")
    .map((item) => ({ slug: item.slug, categoryId: idOf(item.categoryId), mapping: item.categoryMapping?.status ?? null }));
  const slugProblems = [];
  for (const name of ["sacred_items", "news", "categories"]) {
    const seen = new Map();
    for (const doc of data[name]) {
      if (!SLUG_PATTERN.test(doc.slug ?? "") || doc.slug.length > 100) slugProblems.push({ collection: name, slug: doc.slug ?? null, problem: "invalid format" });
      if (seen.has(doc.slug)) slugProblems.push({ collection: name, slug: doc.slug, problem: "duplicate" });
      seen.set(doc.slug, true);
    }
  }

  // 5. Text quality and schema validation
  const records = [];
  for (const name of CONTENT_COLLECTIONS) {
    for (const doc of data[name]) {
      records.push({
        collection: name,
        id: idOf(doc._id),
        record: labelOf(name, doc),
        launched: !NOT_LAUNCHED.has(name),
        status: doc.status,
        reviewStatus: doc.review?.status ?? null,
        openPlaceholders: (doc.placeholderFields ?? []).filter((f) => f.status === "placeholder").map((f) => f.path),
        schemaIssues: await schemaIssues(name, doc),
        residualPublishIssues: residualPublishIssues(name, doc),
        textIssues: textIssues(walkStrings(doc, "", [])),
      });
    }
  }
  const mediaTextIssues = data.media_assets.flatMap((m) => textIssues(m.defaultAlt ? [{ path: "defaultAlt", value: m.defaultAlt }] : []).map((i) => ({ manifestId: m.manifestId, ...i })));
  const mediaSchemaIssues = [];
  for (const m of data.media_assets) for (const i of await schemaIssues("media_assets", m)) mediaSchemaIssues.push({ manifestId: m.manifestId, ...i });

  // 6. Site settings and contact validators
  const settings = data.site_settings[0] ?? null;
  const contact = settings?.contact ?? {};
  const siteSettings = settings && {
    identity: settings.identity,
    branding: { logoAssetId: idOf(settings.branding?.logo?.assetId), logoNote: settings.branding?.logoNote ?? null },
    contact: {
      address: contact.address ?? null,
      locationShort: contact.locationShort ?? null,
      phoneNumber: contact.phoneNumber ?? null,
      lineId: contact.lineId ?? null,
      directionsUrl: contact.directionsUrl ?? null,
      mapEmbedQuery: contact.mapEmbedQuery ?? null,
      verified: contact.verified ?? null,
    },
    openingHours: settings.openingHours ?? null,
    socialLinks: settings.socialLinks ?? [],
    contactTopics: settings.contactTopics ?? [],
    seoDefaultOgImageAssetId: idOf(settings.seo?.defaultOgImage?.assetId),
    validators: {
      phone_getPhoneHref: getPhoneHref(contact.phoneNumber),
      line_lineUrlFromId: lineUrlFromId(contact.lineId),
      line_getLineUrl_raw: getLineUrl(contact.lineId),
      directions_getMapsUrl: getMapsUrl(contact.directionsUrl),
      directions_reviewMapsUrl: reviewMapsUrl(contact.directionsUrl),
      ownerConfirmedMaps: {
        value: REVIEW_CONFIRMED_OVERRIDES.directionsUrl,
        getMapsUrl: getMapsUrl(REVIEW_CONFIRMED_OVERRIDES.directionsUrl),
        reviewMapsUrl: reviewMapsUrl(REVIEW_CONFIRMED_OVERRIDES.directionsUrl),
      },
      socialLinks: (settings.socialLinks ?? []).map((link) => ({ platform: link.platform, url: link.url, verified: link.verified ?? false, reviewSocialLink: reviewSocialLink(link) })),
    },
  };

  // 7. Route preview after publication (assuming every launched record is
  // approved and its open placeholders are resolved).
  const bySort = (list) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || idOf(a._id).localeCompare(idOf(b._id)));
  const categoryName = new Map(data.categories.map((c) => [idOf(c._id), c.name]));
  const page = data.pages.find((p) => p.key === "history") ?? null;
  const routes = {
    "/": {
      heroBanner: bySort(data.banners).map((b) => ({ sortOrder: b.sortOrder, caption: b.image?.caption ?? null, hasMobileImage: Boolean(b.mobileImage?.assetId) })),
      heroTitle: settings?.identity?.name ?? null,
      heroDescription: settings?.identity?.tagline ?? settings?.identity?.description ?? null,
      aboutHeading: page?.homeIntroHeading ?? page?.title ?? null,
      featuredItems: bySort(data.sacred_items).slice(0, 3).map((i) => i.name),
      worshipSteps: bySort(page?.worshipSteps ?? []).map((s) => s.title),
      news: [...data.news].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3).map((n) => `${n.date} ${n.title}`),
      gallery: bySort(data.gallery_items.filter((g) => g.galleryKey === "shrine-main" || !g.galleryKey)).slice(0, 5).map((g) => g.image?.caption ?? g.image?.alt ?? null),
      faqOnHome: bySort(data.faqs.filter((f) => f.showOnHome === true)).map((f) => f.question),
      faqNotOnHome: bySort(data.faqs.filter((f) => f.showOnHome !== true)).map((f) => f.question),
    },
    "/history": page && {
      title: page.title,
      hasImage: Boolean(page.historyImage?.assetId),
      bodyChars: page.historyBody?.length ?? 0,
      quote: page.quote ?? null,
      coatOfArms: page.coatOfArms ? { heading: page.coatOfArms.heading, parts: (page.coatOfArms.parts ?? []).length, hasImage: Boolean(page.coatOfArms.image?.assetId) } : null,
      wishTopics: bySort(page.wishTopics ?? []).map((t) => t.topic),
      worshipSteps: (page.worshipSteps ?? []).length,
    },
    "/sakkara": bySort(data.sacred_items).map((i) => ({ slug: i.slug, name: i.name, category: categoryName.get(idOf(i.categoryId)) ?? null, type: i.type, variants: (i.variants ?? []).length, inquiryText: i.inquiryText ?? null })),
    "/news": [...data.news].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((n) => ({ slug: n.slug, date: n.date, title: n.title, images: (n.images ?? []).length, bodyChars: n.body?.length ?? 0 })),
    "/visit": settings && {
      address: contact.address ?? null,
      hours: [settings.openingHours?.daysText, settings.openingHours?.displayText].filter(Boolean).join(" "),
      phone: contact.phoneNumber ?? null,
      lineId: contact.lineId ?? null,
      contactTopics: bySort(settings.contactTopics ?? []).map((t) => t.label),
      social: (settings.socialLinks ?? []).map((l) => l.platform),
    },
  };

  const violations = ro.violations();
  if (violations.length) throw new Error(`Non-read commands were observed: ${violations.join(", ")}`);

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    database: STAGING_DB,
    account: { roles: status.roles },
    readOnly: { observedCommands: [...new Set(ro.observedCommands())].sort(), violations },
    collections,
    counts,
    statusSummary,
    placeholders,
    media,
    refProblems,
    categoryProblems,
    slugProblems,
    records,
    mediaTextIssues,
    mediaSchemaIssues,
    siteSettings,
    routes,
  };
  writeJson(fromRoot("migration/reports/launch-readiness-audit.json"), report);

  const summary = {
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, `${v.actual}/${v.baseline}${v.match ? "" : " MISMATCH"}`])),
    placeholders: placeholders.length,
    openPlaceholders: placeholders.filter((p) => p.status === "placeholder").length,
    recordsWithOpenPlaceholders: new Set(placeholders.filter((p) => p.status === "placeholder").map((p) => p.id)).size,
    mediaOrphans: media.filter((m) => m.orphan).map((m) => m.manifestId),
    refProblems: refProblems.length,
    categoryProblems: categoryProblems.length,
    slugProblems: slugProblems.length,
    schemaIssues: records.reduce((n, r) => n + r.schemaIssues.length, 0) + mediaSchemaIssues.length,
    textIssues: records.reduce((n, r) => n + r.textIssues.length, 0) + mediaTextIssues.length,
    readOnlyViolations: violations.length,
  };
  writeFileSync(fromRoot("migration/reports/launch-readiness-audit.summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log("Full report: migration/reports/launch-readiness-audit.json");
} catch (error) {
  console.error(sanitizeError(error, uri).message);
  process.exitCode = 1;
} finally {
  await ro.close();
}
