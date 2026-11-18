// Tests for the staging-to-production promotion. Fully offline: synthetic
// staging documents and an in-memory target.
//
//   node --import ./tests/support/register.mjs --test migration/scripts/tests/promotion.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { buildPromotionPlan, removeSampleParagraphs, validateConfirmation } from "../lib/promotion-plan.mjs";
import { applyPromotion, countResults, createMemoryPromotionAdapter, verifyPromotion } from "../lib/promotion-apply.mjs";
import { assertProductionWriter, assertStagingReader, resolvePromotionSource, resolvePromotionTarget } from "../lib/promotion-target.mjs";
import { fromRoot } from "../lib/files.mjs";

const { ObjectId } = mongoose.Types;
const oid = (n) => new ObjectId(String(n).padStart(24, "0"));
const ids = { photo: oid(1), people: oid(2), category: oid(3), settings: oid(4), page: oid(5), item: oid(6), news: oid(7), faq: oid(8) };
const hex = (seed) => [...Array(64)].map((_, i) => "0123456789abcdef"[(seed * 7 + i * 13) % 16]).join("");
const flaggedAt = new Date("2026-10-19T00:00:00Z");
const flag = (path) => ({ path, status: "placeholder", source: "legacy", legacyPath: path, note: null, flaggedAt, resolvedAt: null, resolvedBy: null });
const imageRef = (assetId) => ({ assetId, alt: "ภาพ", caption: null, focalPoint: null, mediaMapping: { status: "resolved" } });
const draft = (fields) => ({ status: "draft", review: { status: "pending_review" }, placeholderFields: [], legacy: { system: "sanpudam168-workers", module: "m", key: `m:${fields._id}`, keyStrength: "id", checksum: hex(1), sourceType: "admin_ui_capture", raw: { leftover: true } }, ...fields });

function media(_id, manifestId, people = false) {
  return {
    _id, manifestId, category: "shrine-place", resourceType: "image",
    cloudinary: { assetId: "a".repeat(32), publicId: `sanpudam168/staging/legacy/test/${manifestId}`, version: 1, secureUrl: `https://res.cloudinary.com/demo/image/upload/v1/sanpudam168/staging/legacy/test/${manifestId}.webp`, type: "upload", format: "webp" },
    width: 1600, height: 1066, bytes: 100, mimeType: "image/webp", contentHash: { sha256: hex(manifestId.length) },
    source: { type: "legacy-export" }, legacy: { key: `media:${manifestId}` },
    rights: { status: "approved", containsIdentifiablePeople: people, consent: { status: people ? "pending" : "not_required" } },
    approval: { status: "pending" },
  };
}

function staging() {
  return {
    media_assets: [media(ids.photo, "photo"), media(ids.people, "people", true)],
    categories: [draft({ _id: ids.category, name: "สถานที่ศักดิ์สิทธิ์", slug: "sacred-place", sortOrder: 1 })],
    site_settings: [draft({
      _id: ids.settings, key: "default",
      identity: { name: "ศาลปู่ดำ168 และตราแผ่นดิน", shortName: "ศาลปู่ดำ168", description: "คำอธิบาย" },
      contact: { address: "79 ถนนมหาราช", locationShort: "หลัง สน.พระราชวัง", phoneNumber: "0823686168", lineId: "@sanpudam168", directionsUrl: "https://share.google/abc", verified: false },
      openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
      socialLinks: [{ platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/?mibextid=wwXIfr", verified: false }],
      placeholderFields: [flag("openingHours.daysText")],
    })],
    pages: [draft({
      _id: ids.page, key: "history", title: "ประวัติ", intro: "บทนำ", homeIntroHeading: "ศรัทธา",
      historyBody: "ย่อหน้าจริง\n\n**ข้อความในส่วนนี้เป็นตัวอย่าง** รอทางศาลส่งประวัติจริง",
      coatOfArms: { heading: "ตราแผ่นดิน", body: "เนื้อหา" },
      placeholderFields: [flag("historyBody")],
    })],
    sacred_items: [draft({ _id: ids.item, name: "องค์ปู่ดำ 168", slug: "pu-dam-168", type: "shrine_worship", categoryId: ids.category, primaryImage: imageRef(ids.photo), excerpt: "สรุป", offerings: "พวงมาลัย", sortOrder: 1, placeholderFields: [flag("offerings")] })],
    news: [draft({ _id: ids.news, title: "ข่าว", slug: "news-one", date: "2026-03-16", coverImage: imageRef(ids.people), excerpt: "ย่อ", body: "เนื้อหาข่าว" })],
    banners: [],
    gallery_items: [],
    faqs: [draft({ _id: ids.faq, question: "คำถาม", answer: "คำตอบ", showOnHome: true, sortOrder: 1 })],
  };
}

function confirmation() {
  const all = staging();
  const records = Object.entries(all).flatMap(([collection, docs]) => docs.map((d) => ({ collection, id: d._id.toHexString() })));
  return {
    schemaVersion: 1,
    confirmedAt: "2026-11-18",
    confirmedBy: "Shrine owner (test)",
    targetDatabase: "sanpudam168_production",
    records,
    placeholders: [
      { collection: "site_settings", id: ids.settings.toHexString(), path: "openingHours.daysText", action: "confirm", value: "ทุกวัน" },
      { collection: "pages", id: ids.page.toHexString(), path: "historyBody", action: "remove_sample_paragraph" },
      { collection: "sacred_items", id: ids.item.toHexString(), path: "offerings", action: "confirm", value: "พวงมาลัย" },
    ],
    media: [{ manifestId: "photo", consent: "not_required" }, { manifestId: "people", consent: "obtained", note: "ภาพพิธีของศาล" }],
    contact: {
      address: "79 ถนนมหาราช", phoneNumber: "0823686168", lineId: "@sanpudam168",
      openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
      directionsUrl: "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7",
      socialLinks: [{ platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/", verified: true }],
    },
  };
}

const errorsOf = (plan) => plan.issues.filter((i) => i.severity === "error");
const find = (plan, collection) => plan.docs.find((d) => d.collection === collection).doc;

test("plan: confirmed records become published, approved, and placeholder-free", async () => {
  const plan = await buildPromotionPlan(staging(), confirmation());
  assert.deepEqual(errorsOf(plan), []);
  assert.equal(plan.docs.length, 8);
  for (const { collection, doc } of plan.docs) {
    if (collection === "media_assets") continue;
    assert.equal(doc.status, "published");
    assert.equal(doc.review.status, "approved");
    assert.equal(doc.review.reviewedAt.toISOString(), "2026-11-18T00:00:00.000Z");
    assert.ok(doc.placeholderFields.every((f) => f.status !== "placeholder"));
    assert.equal(doc.legacy.raw, null, "legacy.raw is not promoted");
    assert.ok(doc.legacy.key, "legacy keys are kept");
  }
  const page = find(plan, "pages");
  assert.equal(page.historyBody, "ย่อหน้าจริง");
  assert.equal(page.placeholderFields[0].status, "replaced");
  assert.equal(find(plan, "sacred_items").placeholderFields[0].status, "confirmed_correct");
  assert.deepEqual(plan.edits.map((e) => [e.path, e.before.includes("ตัวอย่าง"), e.after]), [["historyBody", true, "ย่อหน้าจริง"]]);
  assert.ok(find(plan, "news")._id.equals(ids.news), "_id is kept");
});

test("plan: contact verified with the confirmed Maps link and clean social links", async () => {
  const settings = find(await buildPromotionPlan(staging(), confirmation()), "site_settings");
  assert.equal(settings.contact.verified, true);
  assert.equal(settings.contact.directionsUrl, "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7");
  assert.deepEqual(settings.socialLinks, [{ platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/", verified: true }]);
});

test("plan: media approved; people photos carry recorded consent", async () => {
  const plan = await buildPromotionPlan(staging(), confirmation());
  const people = plan.docs.find((d) => d.label === "people").doc;
  assert.equal(people.approval.status, "approved");
  assert.equal(people.rights.consent.status, "obtained");
  assert.equal(plan.docs.find((d) => d.label === "photo").doc.rights.consent.status, "not_required");
});

test("plan: the hash binds the content and the confirmation", async () => {
  const a = await buildPromotionPlan(staging(), confirmation());
  const b = await buildPromotionPlan(staging(), confirmation());
  assert.equal(a.planHash, b.planHash);
  const changed = staging();
  changed.faqs[0].answer = "คำตอบใหม่";
  assert.notEqual((await buildPromotionPlan(changed, confirmation())).planHash, a.planHash);
  const manifest = confirmation();
  assert.notEqual((await buildPromotionPlan(staging(), manifest, { manifestText: JSON.stringify(manifest) + " " })).planHash, (await buildPromotionPlan(staging(), manifest, { manifestText: JSON.stringify(manifest) })).planHash);
});

async function rejected(mutate) {
  const source = staging();
  const manifest = confirmation();
  mutate(source, manifest);
  return errorsOf(await buildPromotionPlan(source, manifest)).map((e) => e.message);
}

test("reject: the whole batch is refused on any problem", async () => {
  const cases = {
    "open placeholder flag has no decision": (s) => s.faqs[0].placeholderFields.push(flag("answer")),
    "the stored value differs from the confirmed value": (s) => { s.sacred_items[0].offerings = "แก้แล้ว"; },
    "staging record is not in the confirmation file": (s) => s.faqs.push(draft({ _id: oid(99), question: "ใหม่", answer: "ใหม่", sortOrder: 2 })),
    "confirmed record does not exist in staging": (s) => { s.faqs = []; },
    "sample text marker remains": (s) => { s.faqs[0].answer = "ข้อความตัวอย่าง รอยืนยัน"; },
    "media reference does not resolve to a promoted asset": (s, m) => { s.news[0].coverImage = imageRef(oid(77)); },
    "needs consent \"obtained\"": (s, m) => { m.media[1].consent = "not_required"; },
    "expected exactly one sample paragraph": (s) => { s.pages[0].historyBody = "ไม่มีย่อหน้าตัวอย่าง"; },
    "decision does not match an open placeholder flag": (s, m) => m.placeholders.push({ collection: "faqs", id: ids.faq.toHexString(), path: "answer", action: "confirm", value: "คำตอบ" }),
    "stored value differs from the confirmed value": (s, m) => { m.contact.phoneNumber = "0800000000"; },
    "must be stored without tracking parameters": (s, m) => { m.contact.socialLinks[0].url = "https://www.facebook.com/share/19YGRfMnnS/?mibextid=x"; },
    "confirmed Maps link does not pass validation": (s, m) => { m.contact.directionsUrl = "https://share.google/abc"; },
    "category reference does not resolve": (s) => { s.categories = []; },
    "rights.status is pending_owner_confirmation": (s) => { s.media_assets[0].rights.status = "pending_owner_confirmation"; },
    "videos must not be promoted": (s, m) => m.records.push({ collection: "videos", id: oid(50).toHexString() }),
  };
  for (const [expected, mutate] of Object.entries(cases)) {
    const messages = await rejected(mutate);
    assert.ok(messages.some((m) => m.includes(expected)), `${expected}: got ${JSON.stringify(messages)}`);
  }
});

test("apply: created, then unchanged on re-run; verification passes", async () => {
  const plan = await buildPromotionPlan(staging(), confirmation());
  const target = createMemoryPromotionAdapter();
  assert.deepEqual(countResults(await applyPromotion(plan, target)), { created: 8 });
  assert.deepEqual(countResults(await applyPromotion(plan, target)), { unchanged: 8 });
  const verification = await verifyPromotion(plan, target);
  assert.equal(verification.passed, true, verification.problems.join("; "));
  assert.equal(target.store.has("videos"), false);
});

test("apply: unedited production records update; edited ones are never overwritten", async () => {
  const target = createMemoryPromotionAdapter();
  await applyPromotion(await buildPromotionPlan(staging(), confirmation()), target);
  const changed = staging();
  changed.faqs[0].answer = "คำตอบที่แก้ใน staging";
  const next = await buildPromotionPlan(changed, confirmation());
  // Edited in production after the first promotion.
  const edited = await target.findById("news", ids.news);
  edited.excerpt = "แก้บน production";
  await target.replace("news", edited);
  const counts = countResults(await applyPromotion(next, target));
  assert.deepEqual(counts, { unchanged: 6, updated: 1, conflict: 1 });
  assert.equal((await target.findById("news", ids.news)).excerpt, "แก้บน production");
  assert.equal((await target.findById("faqs", ids.faq)).answer, "คำตอบที่แก้ใน staging");
});

test("dry run: write=false never writes", async () => {
  const plan = await buildPromotionPlan(staging(), confirmation());
  const target = createMemoryPromotionAdapter();
  assert.deepEqual(countResults(await applyPromotion(plan, target, { write: false })), { created: 8 });
  assert.equal((await target.list("faqs")).length, 0);
});

test("targets: staging is read-only; only sanpudam168_production is written", () => {
  const reader = { CLIENT_REVIEW_MONGODB_URI: "mongodb+srv://r:x@cluster.example.invalid/", CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_staging" };
  assert.equal(resolvePromotionSource(reader).dbName, "sanpudam168_staging");
  assert.throws(() => resolvePromotionSource({ ...reader, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_production" }), /exactly sanpudam168_staging/);
  const writer = { ...reader, PROMOTION_MONGODB_URI: "mongodb+srv://w:y@cluster.example.invalid/", PROMOTION_MONGODB_DB_NAME: "sanpudam168_production" };
  assert.equal(resolvePromotionTarget(writer).dbName, "sanpudam168_production");
  assert.equal(resolvePromotionTarget(reader, { required: false }), null);
  for (const name of ["sanpudam168_staging", "sanpudam168", "sanpudam168_production2", ""]) {
    assert.throws(() => resolvePromotionTarget({ ...writer, PROMOTION_MONGODB_DB_NAME: name }), /exactly sanpudam168_production/, name);
  }
  assert.throws(() => resolvePromotionTarget({ ...writer, PROMOTION_MONGODB_URI: "mongodb+srv://w:y@cluster.example.invalid/sanpudam168_staging" }), /different database/);
  assert.throws(() => resolvePromotionTarget({ ...writer, PROMOTION_MONGODB_URI: reader.CLIENT_REVIEW_MONGODB_URI }), /different account/);
  assert.throws(() => resolvePromotionTarget(writer, { requireConfirmation: true, confirmDb: "sanpudam168_staging" }), /--confirm-db/);
  assert.doesNotThrow(() => assertStagingReader([{ role: "read", db: "sanpudam168_staging" }]));
  assert.throws(() => assertStagingReader([{ role: "readWrite", db: "sanpudam168_staging" }]), /only read/);
  assert.doesNotThrow(() => assertProductionWriter([{ role: "readWrite", db: "sanpudam168_production" }]));
  assert.throws(() => assertProductionWriter([{ role: "readWrite", db: "sanpudam168_production" }, { role: "read", db: "sanpudam168_staging" }]), /production only/);
  assert.throws(() => assertProductionWriter([{ role: "readWriteAnyDatabase", db: "admin" }]), /production only/);
});

test("confirmation file: valid, complete for this launch, and free of secrets", () => {
  const text = readFileSync(fromRoot("migration/confirmations/owner-launch-confirmation.json"), "utf8");
  const manifest = JSON.parse(text);
  assert.deepEqual(validateConfirmation(manifest), []);
  assert.doesNotMatch(text, /mongodb(\+srv)?:\/\/|password|secret|api[_-]?key/i);
  assert.ok(!manifest.records.some((r) => ["videos", "reviews", "team_members"].includes(r.collection)));
  assert.equal(manifest.placeholders.filter((p) => p.action === "remove_sample_paragraph").length, 4);
  assert.equal(manifest.contact.directionsUrl, "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7");
});

test("sample paragraphs: only paragraphs that start with the marker are removed", () => {
  assert.deepEqual(removeSampleParagraphs("ก\n\n**ข้อความส่วนนี้เป็นตัวอย่าง** รอ\n\nข"), { value: "ก\n\nข", removed: ["**ข้อความส่วนนี้เป็นตัวอย่าง** รอ"] });
  assert.deepEqual(removeSampleParagraphs("ข้อความในส่วนนี้เป็นตัวอย่าง x").removed.length, 1);
  assert.deepEqual(removeSampleParagraphs("ย่อหน้าที่พูดถึงข้อความส่วนนี้เป็นตัวอย่าง กลางประโยค").removed, []);
});
