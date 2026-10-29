// Tests for the MongoDB importer. Fully offline: an in-memory adapter with
// the real Mongoose models stands in for the database.
//
//   node --test migration/scripts/tests/mongodb.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { buildMigrationPlan, loadPlanInputs, mediaImportId } from "../lib/mongo-plan.mjs";
import { applyPlan, countResults } from "../lib/mongo-apply.mjs";
import { createMemoryAdapter } from "../lib/mongo-adapters.mjs";
import { databaseInUri, resolveStagingTarget } from "../lib/db-target.mjs";
import { fromRoot, readJson } from "../lib/files.mjs";
import { Banner, News, SacredItem } from "../../../src/models/index.js";

const hex = (seed, length) => [...Array(length)].map((_, i) => "0123456789abcdef"[(seed * 7 + i * 13) % 16]).join("");
const CHECKSUM = hex(3, 64);

function legacy(module, id) {
  return { system: "sanpudam168-workers", module, id, key: `${module}:id:${id}`, keyStrength: "id", isPublished: true, isPlaceholder: false, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", checksum: CHECKSUM, sourceType: "admin_ui_capture" };
}
const common = (module, id, placeholders = []) => ({
  status: "draft",
  review: { status: "pending_review" },
  legacy: legacy(module, id),
  placeholderFields: placeholders.map((path) => ({ path, legacyPath: path, status: "placeholder", source: "legacy", flaggedAt: "2026-01-02T00:00:00.000Z" })),
  migration: { runId: null, preparedAt: "2026-10-19T00:00:00.000Z" },
});
const imageRef = (manifestId, sha, alt = "ภาพ") => ({ assetManifestId: manifestId, assetSha256: sha, alt, caption: null, focalPoint: null, mediaMapping: { status: "resolved", legacyUrl: `/img/${manifestId}.webp`, legacyMobileUrl: null, legacyWidth: 100, legacyHeight: 100 } });

// Minimal but schema-complete synthetic fixture.
function makeFixture() {
  const ids = { category: "aaaaaaaaaaaaaaaaaaaaaaa1", settings: "aaaaaaaaaaaaaaaaaaaaaaa2", sacred: "aaaaaaaaaaaaaaaaaaaaaaa3", news: "aaaaaaaaaaaaaaaaaaaaaaa4", video: "aaaaaaaaaaaaaaaaaaaaaaa5", review: "aaaaaaaaaaaaaaaaaaaaaaa6" };
  const shaA = hex(1, 64);
  const shaLogo = hex(2, 64);
  const asset = (manifestId, sha, associations) => ({
    manifestId, category: manifestId === "logo" ? "branding" : "shrine-place", resourceType: "image",
    cloudinary: { assetId: hex(manifestId.length, 32), publicId: `sanpudam168/staging/legacy/test/${manifestId}`, version: 1, secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${manifestId}.webp`, type: "upload", format: "webp", etag: hex(5, 32) },
    width: 100, height: 100, bytes: 1234, mimeType: "image/webp", contentHash: { sha256: sha, md5: hex(5, 32), dhash: "0f0f0f0f0f0f0f0f" },
    defaultAlt: "ภาพ", source: { type: "legacy-export", url: `https://legacy.example/img/${manifestId}.webp`, originalFilename: `${manifestId}.webp`, pages: ["/"] },
    legacy: { mediaUrls: [`/img/${manifestId}.webp`], references: [] },
    suggestedAssociations: associations, rights: { status: "approved", containsIdentifiablePeople: false, consent: { status: "not_required" }, notes: [] },
    approval: { status: "pending" }, importedAt: "2026-10-29T13:52:11.266Z", migration: { runId: "cloudinary-run", importRoot: "sanpudam168/staging/legacy" },
  });
  const mediaMapping = {
    assets: [
      asset("photo-a", shaA, [
        { collection: "sacred_items", importId: ids.sacred, legacyId: "s1", record: "item-one", field: "primaryImage", alt: "ภาพ" },
        { collection: "news", importId: ids.news, legacyId: "n1", record: "news-one", field: "coverImage", alt: "ภาพ" },
      ]),
      asset("logo", shaLogo, [{ collection: "site_settings", importId: ids.settings, legacyId: "st1", record: "default", field: "branding.logo", alt: "" }]),
    ],
  };
  const content = {
    categories: [{ importId: ids.category, ...common("categories", "c1"), name: "สถานที่ศักดิ์สิทธิ์", slug: "sacred-place", description: null, sortOrder: 1 }],
    site_settings: [{
      importId: ids.settings, ...common("settings", "st1", ["openingHours.daysText"]), key: "default",
      identity: { name: "ศาลทดสอบ", shortName: "ศาล", tagline: null, description: "คำอธิบาย" },
      branding: { logo: null, logoNote: "no legacy field" },
      contact: { address: "ที่อยู่", locationShort: "ทำเล", phoneNumber: null, lineId: null, directionsUrl: null, mapEmbedQuery: null, verified: false },
      openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
      socialLinks: [], contactTopics: [], seo: { defaultOgImage: null }, analytics: { enabled: false, excluded: true, legacyValuesPresent: [] },
    }],
    sacred_items: [{
      importId: ids.sacred, ...common("sacred", "s1", ["body"]), name: "รายการหนึ่ง", slug: "item-one", type: "sacred_object", categoryId: ids.category,
      categoryMapping: { status: "resolved", legacyValue: "c1", resolvedSlug: "sacred-place" }, primaryImage: imageRef("photo-a", shaA),
      excerpt: "สรุป", body: "เนื้อหา", bodyFormat: "legacy-text-v1", prayerTopics: null, offerings: null, inquiryText: "สอบถามราคาทางไลน์",
      variants: [{ key: "variant-01", sortOrder: 1, name: "เนื้อเงิน", quantity: 30, quantityText: null, note: null }], showVariantQuantities: false, sortOrder: 1, seo: { title: null, description: null },
    }],
    news: [{ importId: ids.news, ...common("news", "n1"), title: "ข่าว", slug: "news-one", date: "2026-03-16", coverImage: imageRef("photo-a", shaA), excerpt: "สรุป", body: "เนื้อหา", bodyFormat: "legacy-text-v1", images: [], seo: { title: null, description: null } }],
    videos: [{ importId: ids.video, ...common("videos", "v1", ["videoAssetId"]), title: "วิดีโอ", videoAssetId: null, videoMapping: { status: "missing", legacyValue: null }, posterMode: "auto", poster: null, description: null, sortOrder: 1 }],
    reviews: [{ importId: ids.review, ...common("reviews", "r1", ["displayName", "quote"]), displayName: "ชื่อตัวอย่าง", sourceLabel: null, quote: "ข้อความตัวอย่าง", rating: 5, consent: { status: "pending" }, sortOrder: 1 }],
  };
  return { mediaMapping, content, ids };
}

const clone = (value) => JSON.parse(JSON.stringify(value));

// --- plan ------------------------------------------------------------------

test("plan: deterministic identities, resolved references, drafts, placeholders, stable hash", async () => {
  const fixture = makeFixture();
  const plan = await buildMigrationPlan(fixture);
  assert.deepEqual(plan.totals, { media: 2, content: 6, all: 8 });
  assert.equal(plan.issues.filter((i) => i.severity === "error").length, 0, JSON.stringify(plan.issues));
  assert.equal(plan.resolvedUsages, 3);
  assert.equal(plan.placeholderFields, 5);
  const sacred = plan.records.find((r) => r.collection === "sacred_items").doc;
  assert.equal(String(sacred.primaryImage.assetId), mediaImportId("photo-a"));
  assert.equal(sacred.inquiryText, "สอบถามราคาทางไลน์", "offering text preserved verbatim");
  const settings = plan.records.find((r) => r.collection === "site_settings").doc;
  assert.equal(String(settings.branding.logo.assetId), mediaImportId("logo"), "logo association applied");
  assert.ok(plan.records.filter((r) => r.collection !== "media_assets").every((r) => r.doc.status === "draft" && r.doc.review.status === "pending_review"));
  assert.ok(plan.issues.some((i) => i.where.startsWith("videos:") && /video file missing/.test(i.message)), "missing video flagged");
  assert.equal((await buildMigrationPlan(makeFixture())).planHash, plan.planHash, "plan hash is stable");
  assert.equal(new Set(plan.records.map((r) => r.importId)).size, plan.records.length, "unique identities");
});

test("plan: real local data yields 17 media + 39 content, 31 usages, 32 placeholders", { skip: !existsSync(fromRoot("migration/manifests/media-assets-mapping.json")) }, async () => {
  const plan = await buildMigrationPlan(loadPlanInputs(readJson, fromRoot));
  assert.deepEqual(plan.totals, { media: 17, content: 39, all: 56 });
  assert.equal(plan.resolvedUsages, 31);
  assert.equal(plan.placeholderFields, 32);
  assert.equal(plan.issues.filter((i) => i.severity === "error").length, 0);
});

test("plan: duplicate media in the mapping is reported", async () => {
  const fixture = makeFixture();
  fixture.mediaMapping.assets.push(clone(fixture.mediaMapping.assets[0]));
  const plan = await buildMigrationPlan(fixture);
  assert.ok(plan.issues.some((i) => /duplicate manifest ID/.test(i.message)));
});

test("plan: missing media reference is reported, not invented", async () => {
  const fixture = makeFixture();
  fixture.mediaMapping.assets = fixture.mediaMapping.assets.filter((a) => a.manifestId !== "photo-a");
  const plan = await buildMigrationPlan(fixture);
  const errors = plan.issues.filter((i) => /photo-a cannot be resolved/.test(i.message));
  assert.ok(errors.length >= 2, JSON.stringify(plan.issues));
  const sacred = plan.records.find((r) => r.collection === "sacred_items").doc;
  assert.equal(sacred.primaryImage.assetId, null);
  assert.equal(sacred.primaryImage.mediaMapping.status, "missing");
});

test("plan: missing category reference is reported", async () => {
  const fixture = makeFixture();
  fixture.content.categories = [];
  const plan = await buildMigrationPlan(fixture);
  assert.ok(plan.issues.some((i) => /category reference .* does not resolve/.test(i.message)));
});

test("plan: invalid records fail schema validation", async () => {
  const fixture = makeFixture();
  fixture.content.news[0].slug = "Bad Slug";
  fixture.content.sacred_items[0].type = "unknown";
  const plan = await buildMigrationPlan(fixture);
  const schemaErrors = plan.issues.filter((i) => i.message.startsWith("schema:"));
  assert.ok(schemaErrors.some((i) => /slug/.test(i.message)));
  assert.ok(schemaErrors.some((i) => /type/.test(i.message)));
});

test("models: draft vs published rules", async () => {
  const fixture = makeFixture();
  const plan = await buildMigrationPlan(fixture);
  const sacredDoc = plan.records.find((r) => r.collection === "sacred_items").doc;
  await new SacredItem(sacredDoc).validate(); // draft with placeholders is fine
  await assert.rejects(new SacredItem({ ...sacredDoc, status: "published" }).validate(), /Cannot publish/);
  const newsDoc = plan.records.find((r) => r.collection === "news").doc;
  await assert.rejects(new News({ ...newsDoc, status: "published" }).validate(), /review.status must be approved/);
  await new News({ ...newsDoc, status: "published", review: { status: "approved" } }).validate();
  await assert.rejects(new Banner({ image: { assetId: null, alt: "", mediaMapping: { status: "missing" } }, legacy: legacy("banners", "b1") }).validate(), /caption is required/);
});

// --- apply -----------------------------------------------------------------

test("apply: idempotent, no duplicates on re-run", async () => {
  const plan = await buildMigrationPlan(makeFixture());
  const db = createMemoryAdapter();
  assert.deepEqual(countResults(await applyPlan(plan, db, { runId: "r1" })), { created: 8 });
  assert.deepEqual(countResults(await applyPlan(plan, db, { runId: "r2" })), { unchanged: 8 });
  assert.equal([...db.store.values()].reduce((t, rows) => t + rows.size, 0), 8);
});

test("apply: placeholder flags and legacy data preserved in stored records", async () => {
  const fixture = makeFixture();
  const plan = await buildMigrationPlan(fixture);
  const db = createMemoryAdapter();
  await applyPlan(plan, db, { runId: "r1" });
  const stored = db.store.get("reviews").get(fixture.ids.review);
  assert.deepEqual(stored.placeholderFields.map((p) => [p.path, p.status, p.source]), [["displayName", "placeholder", "legacy"], ["quote", "placeholder", "legacy"]]);
  assert.equal(stored.status, "draft");
  assert.equal(stored.legacy.isPublished, true, "legacy publication kept as metadata");
  assert.equal(db.store.get("videos").get(fixture.ids.video).videoMapping.status, "missing");
});

test("apply: an existing record with the same identity but another _id is a conflict", async () => {
  const plan = await buildMigrationPlan(makeFixture());
  const db = createMemoryAdapter();
  const sacred = plan.records.find((r) => r.collection === "sacred_items");
  const intruder = { ...clone(sacred.doc), _id: "bbbbbbbbbbbbbbbbbbbbbbb1", legacy: { ...sacred.doc.legacy, key: "other:key" } };
  db.store.set("sacred_items", new Map([[intruder._id, intruder]]));
  const results = await applyPlan(plan, db, { runId: "r1" });
  const result = results.find((r) => r.collection === "sacred_items");
  assert.equal(result.result, "conflict");
  assert.match(result.message, /slug already used/);
});

test("apply: references missing in the target block the record", async () => {
  const plan = await buildMigrationPlan(makeFixture());
  const withoutMedia = { ...plan, records: plan.records.filter((r) => r.collection !== "media_assets") };
  const results = await applyPlan(withoutMedia, createMemoryAdapter(), { runId: "r1" });
  assert.equal(results.find((r) => r.collection === "sacred_items").result, "blocked_missing_reference");
  assert.equal(results.find((r) => r.collection === "news").result, "blocked_missing_reference");
});

test("apply: preview mode counts records the same run would create", async () => {
  const plan = await buildMigrationPlan(makeFixture());
  assert.deepEqual(countResults(await applyPlan(plan, createMemoryAdapter(), { runId: "p1", write: false })), { would_create: 8 });
});

test("apply: recovers after a partial failure without duplicates", async () => {
  const plan = await buildMigrationPlan(makeFixture());
  const db = createMemoryAdapter({ failOnInsertNumber: 4 });
  const first = countResults(await applyPlan(plan, db, { runId: "r1" }));
  assert.equal(first.failed, 1);
  const second = countResults(await applyPlan(plan, db, { runId: "r2" }));
  assert.deepEqual(second, { unchanged: 7, created: 1 });
  assert.equal([...db.store.values()].reduce((t, rows) => t + rows.size, 0), 8);
});

test("apply: records edited after import are never overwritten", async () => {
  const fixture = makeFixture();
  const plan = await buildMigrationPlan(fixture);
  const db = createMemoryAdapter();
  await applyPlan(plan, db, { runId: "r1" });
  db.edit("news", fixture.ids.news, (doc) => {
    doc.title = "แก้ไขใน CMS ใหม่";
  });
  const unchangedSource = await applyPlan(plan, db, { runId: "r2", updateUnedited: true });
  assert.equal(unchangedSource.find((r) => r.collection === "news").result, "edited_in_cms");

  const changed = makeFixture();
  changed.content.news[0].excerpt = "สรุปที่เปลี่ยนจากต้นทาง";
  const changedPlan = await buildMigrationPlan(changed);
  const results = await applyPlan(changedPlan, db, { runId: "r3", updateUnedited: true });
  assert.equal(results.find((r) => r.collection === "news").result, "conflict");
  assert.equal(db.store.get("news").get(fixture.ids.news).title, "แก้ไขใน CMS ใหม่", "edited value kept");
});

test("apply: source changes are detected and only refreshed on request", async () => {
  const fixture = makeFixture();
  const db = createMemoryAdapter();
  await applyPlan(await buildMigrationPlan(fixture), db, { runId: "r1" });
  const changed = makeFixture();
  changed.content.faqs = [];
  changed.content.categories[0].description = "คำอธิบายใหม่จากต้นทาง";
  const changedPlan = await buildMigrationPlan(changed);
  assert.equal((await applyPlan(changedPlan, db, { runId: "r2" })).find((r) => r.collection === "categories").result, "source_changed");
  assert.equal(db.store.get("categories").get(fixture.ids.category).description, null, "not updated without the flag");
  assert.equal((await applyPlan(changedPlan, db, { runId: "r3", updateUnedited: true })).find((r) => r.collection === "categories").result, "updated");
  assert.equal(db.store.get("categories").get(fixture.ids.category).description, "คำอธิบายใหม่จากต้นทาง");
  assert.deepEqual(countResults(await applyPlan(changedPlan, db, { runId: "r4" })), { unchanged: 8 });
});

// --- target safety -----------------------------------------------------------

test("target: staging database name rules fail closed", () => {
  const uri = "mongodb+srv://user:pass@cluster.example.net/?retryWrites=true";
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: uri }), /MONGODB_DB_NAME must be set/);
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: uri, MONGODB_DB_NAME: "sanpudam168" }), /not a staging database/);
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: uri, MONGODB_DB_NAME: "sanpudam168_prod_staging" }), /production/);
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: uri, MONGODB_DB_NAME: "sanpudam168-live" }), /production/);
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: "mongodb+srv://u:p@c.example.net/sanpudam168?x=1", MONGODB_DB_NAME: "sanpudam168_staging" }), /ambiguous/);
  assert.throws(() => resolveStagingTarget({ MONGODB_URI: uri, MONGODB_DB_NAME: "sanpudam168_staging" }, { requireConfirmation: true, confirmDb: "sanpudam168" }), /confirm-db/);
  assert.deepEqual(resolveStagingTarget({ MONGODB_URI: uri, MONGODB_DB_NAME: "sanpudam168_staging" }, { requireConfirmation: true, confirmDb: "sanpudam168_staging" }), { dbName: "sanpudam168_staging" });
  assert.equal(databaseInUri(uri), null);
});

test("target: preflight without configuration exits before any connection", () => {
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.MONGODB_DB_NAME;
  const run = spawnSync(process.execPath, [fromRoot("migration/scripts/import-mongodb.mjs"), "--preflight"], { env, encoding: "utf8", timeout: 60000 });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /MONGODB_URI is not set/);
});

test("target: errors never contain the connection string", async () => {
  const { sanitizeError } = await import("../../../src/lib/db.js");
  const uri = "mongodb+srv://user:secret-pass@cluster.example.net/";
  assert.ok(!sanitizeError(new Error(`failed for ${uri}`), uri).message.includes("secret-pass"));
});
