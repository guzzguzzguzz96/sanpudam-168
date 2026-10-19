// Builds the migration dry-run report from local files only. It never
// connects to MongoDB or Cloudinary; every content record is reported as
// "create" against an empty target, keyed by its deterministic identity.
//
//   node migration/scripts/dry-run-report.mjs
//
// Output: migration/reports/dry-run.json and migration/reports/dry-run.md
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { hamming } from "./lib/media.mjs";
import { fromRoot, readJson, writeJson } from "./lib/files.mjs";

const COLLECTIONS = ["media_assets", "categories", "sacred_items", "news", "gallery_items", "banners", "videos", "reviews", "faqs", "team_members", "pages", "site_settings"];
const media = readJson(fromRoot("migration/manifests/media-manifest.json"));
const content = Object.fromEntries(COLLECTIONS.slice(1).map((c) => [c, readJson(fromRoot("migration/content", `${c}.json`))?.records ?? []]));

// Limits from docs/mongodb-schema-spec.md (legacy UI maximum lengths).
const LIMITS = {
  categories: { name: 40, description: 300 },
  sacred_items: { name: 80, excerpt: 220, body: 8000, prayerTopics: 160, offerings: 400, inquiryText: 120 },
  news: { title: 120, excerpt: 220, body: 15000 },
  videos: { title: 80, description: 300 },
  reviews: { displayName: 40, sourceLabel: 60, quote: 500 },
  faqs: { question: 140, answer: 800 },
  team_members: { name: 60, roleTitle: 60, bio: 300 },
  pages: { title: 80, intro: 500, historyBody: 8000, quote: 140, homeIntroHeading: 40 },
};
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Same host rules as getMapsUrl()/getLineUrl() in src/lib/contact-actions.js.
const mapsAccepted = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    const on = (d) => h === d || h.endsWith(`.${d}`);
    return ((on("google.com") || on("google.co.th")) && u.pathname.startsWith("/maps")) || on("maps.app.goo.gl") || on("maps.google.com") || (h === "goo.gl" && u.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
};

// --- media -----------------------------------------------------------------
const masters = media.entries.filter((e) => e.role === "master");
const bySha = Object.groupBy(masters.filter((e) => e.sha256), (e) => e.sha256);
const exactDuplicates = Object.values(bySha).filter((g) => g.length > 1).map((g) => g.map((e) => e.id));
const near = [];
for (let i = 0; i < masters.length; i++) {
  for (let j = i + 1; j < masters.length; j++) {
    const d = hamming(masters[i].dhash, masters[j].dhash);
    if (d <= 8) near.push({ a: masters[i].id, b: masters[j].id, distance: d });
  }
}
const missingFiles = masters.filter((e) => e.status === "failed" || !existsSync(fromRoot(e.localPath))).map((e) => e.id);
const altVariants = masters
  .map((e) => ({ id: e.id, alts: [...new Set((e.adminUsages ?? []).length ? collectAlts(e.id) : e.sourceAltTexts ?? [])] }))
  .filter((x) => x.alts.length > 1);

function collectAlts(assetId) {
  const alts = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (value.assetManifestId === assetId) alts.push(value.alt);
      Object.values(value).forEach(visit);
    }
  };
  Object.values(content).forEach(visit);
  return alts;
}

const mediaPlan = masters.map((e) => ({
  id: e.id,
  localPath: e.localPath,
  bytes: e.bytes,
  dimensions: `${e.width}x${e.height}`,
  sha256: e.sha256,
  cloudinaryPublicId: e.cloudinaryPublicId,
  usedBy: (e.adminUsages ?? []).length,
  action: missingFiles.includes(e.id) ? "missing" : "upload",
}));

// --- content ---------------------------------------------------------------
const issues = [];
const add = (severity, collection, record, message) => issues.push({ severity, collection, record, message });
const label = (doc) => doc.slug ?? doc.key ?? doc.legacy?.id;

const importIds = new Map();
for (const [collection, docs] of Object.entries(content)) {
  const slugs = new Set();
  for (const doc of docs) {
    const prior = importIds.get(doc.importId);
    if (prior) add("error", collection, label(doc), `importId collides with ${prior}`);
    importIds.set(doc.importId, `${collection}:${label(doc)}`);
    if (doc.slug !== undefined) {
      if (!SLUG.test(doc.slug)) add("error", collection, label(doc), `slug "${doc.slug}" does not match the allowed pattern`);
      if (slugs.has(doc.slug)) add("error", collection, label(doc), `duplicate slug "${doc.slug}"`);
      slugs.add(doc.slug);
    }
    for (const [field, max] of Object.entries(LIMITS[collection] ?? {})) {
      if (typeof doc[field] === "string" && doc[field].length > max) add("error", collection, label(doc), `${field} is ${doc[field].length} characters (max ${max})`);
    }
    if (doc.legacy?.isPublished && doc.placeholderFields.length) {
      add("warning", collection, label(doc), `published in the legacy CMS but has ${doc.placeholderFields.length} placeholder field(s): ${doc.placeholderFields.map((p) => p.path).join(", ")}`);
    }
    const refs = [];
    const visit = (value, path) => {
      if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}[${i}]`));
      else if (value && typeof value === "object") {
        if ("assetManifestId" in value) refs.push({ path, ref: value });
        else Object.entries(value).forEach(([k, v]) => visit(v, path ? `${path}.${k}` : k));
      }
    };
    visit(doc, "");
    for (const { path, ref } of refs) {
      if (ref.mediaMapping.status !== "resolved") add("error", collection, label(doc), `${path} media is ${ref.mediaMapping.status} (${ref.mediaMapping.legacyUrl})`);
      if (!ref.alt) add("warning", collection, label(doc), `${path} has no alt text`);
    }
  }
}

for (const doc of content.sacred_items) {
  if (doc.categoryMapping.status !== "resolved") add("error", "sacred_items", doc.slug, `category unresolved (legacy value ${doc.categoryMapping.legacyValue})`);
  if (doc.inquiryText && /\d/.test(doc.inquiryText)) add("warning", "sacred_items", doc.slug, `inquiryText contains digits, possibly a price: "${doc.inquiryText}"`);
  if (doc.variants.length) add("info", "sacred_items", doc.slug, `${doc.variants.length} variants (total ${doc.variants.reduce((t, v) => t + (v.quantity ?? 0), 0)}); quantities hidden until owner confirms`);
}
for (const doc of content.videos) if (!doc.videoAssetId) add("error", "videos", doc.legacy.id, `no video file (${doc.videoMapping.status}); cannot be published`);
for (const doc of content.team_members) if (!doc.photo) add("info", "team_members", doc.legacy.id, "no photo in the legacy CMS");
for (const collection of ["reviews", "team_members"]) {
  for (const doc of content[collection]) add("info", collection, doc.legacy.id, "consent pending (personal data)");
}
for (const doc of content.site_settings) {
  const c = doc.contact;
  if (c.directionsUrl && !mapsAccepted(c.directionsUrl)) add("warning", "site_settings", "default", `directionsUrl "${c.directionsUrl}" is not accepted by getMapsUrl(); the directions button would stay hidden`);
  if (c.lineId && !/^@?[a-z0-9._-]+$/i.test(c.lineId)) add("warning", "site_settings", "default", `lineId "${c.lineId}" has an unexpected format`);
  if (c.phoneNumber && !/^\+?\d{9,15}$/.test(c.phoneNumber.replace(/[\s().-]/g, ""))) add("warning", "site_settings", "default", "phoneNumber is not a plausible number");
  const h = doc.openingHours;
  if (!h.displayText.includes(h.opens) || !h.displayText.includes(h.closes)) add("warning", "site_settings", "default", `openingHours.displayText "${h.displayText}" does not match ${h.opens}–${h.closes}`);
  if (!doc.branding.logo) add("info", "site_settings", "default", "no logo field in the legacy CMS; link brand-logo-mark at import");
}

const placeholderByCollection = Object.fromEntries(Object.entries(content).map(([c, docs]) => [c, docs.reduce((t, d) => t + d.placeholderFields.length, 0)]));

const plan = {
  generatedAt: new Date().toISOString(),
  target: "none (dry run, no database or Cloudinary connection)",
  media: {
    filesToUpload: mediaPlan.filter((m) => m.action === "upload").length,
    uniqueFiles: Object.keys(bySha).length,
    totalBytes: masters.reduce((t, e) => t + (e.bytes ?? 0), 0),
    exactDuplicates,
    nearDuplicates: near,
    missingFiles,
    derivativesSkipped: 17,
    altTextVariants: altVariants,
    plan: mediaPlan,
  },
  content: {
    recordsToInsert: Object.fromEntries(Object.entries(content).map(([c, d]) => [c, d.length])),
    total: Object.values(content).reduce((t, d) => t + d.length, 0),
    defaultStatus: "draft / pending_review",
    placeholderFields: placeholderByCollection,
    unresolvedRelationships: issues.filter((i) => /unresolved|no video|media is/.test(i.message)),
  },
  issues,
};
plan.planHash = createHash("sha256").update(JSON.stringify({ media: plan.media, content: plan.content, issues: plan.issues })).digest("hex");
writeJson(fromRoot("migration/reports/dry-run.json"), plan);

const count = (s) => issues.filter((i) => i.severity === s).length;
const md = [
  "# Migration dry run",
  "",
  `Generated: ${plan.generatedAt}  `,
  `Plan hash: \`${plan.planHash}\`  `,
  "Target: none. No MongoDB or Cloudinary connection was made.",
  "",
  "## Media",
  "",
  `- Files to upload: ${plan.media.filesToUpload} (unique by SHA-256: ${plan.media.uniqueFiles}, ${(plan.media.totalBytes / 1024 / 1024).toFixed(2)} MB)`,
  `- Exact duplicates: ${exactDuplicates.length}`,
  `- Near duplicates (dHash ≤ 8): ${near.map((n) => `${n.a} ~ ${n.b} (${n.distance})`).join("; ") || "none"}`,
  `- Missing files: ${missingFiles.length ? missingFiles.join(", ") : "none"}`,
  "- Derivatives skipped: 17 (800px resizes and icons; generate with Cloudinary)",
  "",
  "| Asset | Size | Public ID | Used by |",
  "|---|---|---|---:|",
  ...mediaPlan.map((m) => `| ${m.id} | ${m.dimensions} | \`${m.cloudinaryPublicId}\` | ${m.usedBy} |`),
  "",
  "## Content",
  "",
  "| Collection | Records | Placeholder fields |",
  "|---|---:|---:|",
  ...Object.entries(plan.content.recordsToInsert).map(([c, n]) => `| ${c} | ${n} | ${placeholderByCollection[c]} |`),
  `| **total** | **${plan.content.total}** | **${Object.values(placeholderByCollection).reduce((a, b) => a + b, 0)}** |`,
  "",
  `All records: ${plan.content.defaultStatus}.`,
  "",
  `## Issues (${count("error")} errors, ${count("warning")} warnings, ${count("info")} info)`,
  "",
  "| Severity | Collection | Record | Message |",
  "|---|---|---|---|",
  ...issues.map((i) => `| ${i.severity} | ${i.collection} | ${i.record} | ${i.message.replaceAll("|", "\\|")} |`),
  "",
];
writeFileSync(fromRoot("migration/reports/dry-run.md"), md.join("\n"));
console.log(JSON.stringify({ planHash: plan.planHash, media: { upload: plan.media.filesToUpload, unique: plan.media.uniqueFiles, near: near.length, missing: missingFiles.length }, content: plan.content.total, errors: count("error"), warnings: count("warning"), info: count("info") }));
