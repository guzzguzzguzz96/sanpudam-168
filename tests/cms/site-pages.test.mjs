// /history, /sakkara, and /sakkara/[slug] (C2.1): scope selection, slug
// handling, public isolation, unavailable vs. not found, and view data.
// Offline: mock models only; MongoDB is never contacted.
//
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../../src/server/cms/content-service.js";
import { isValidSlug } from "../../src/server/cms/policy.js";
import { createReviewAccessPolicy } from "../../src/server/cms/review-access.js";
import { evaluateReviewMode } from "../../src/lib/review-mode.js";
import { REVIEW_LABELS } from "../../src/server/review/homepage.js";
import { parseLegacyText } from "../../src/server/site/pages.js";
import { createSitePages } from "../../src/server/site/service.js";
import { asset, draft, ids, imageRef, mockModels, published } from "./fixtures.mjs";

const silent = { error() {} };
const placeholder = (path) => ({ path, status: "placeholder", source: "legacy", note: "internal note", flaggedAt: "2026-10-17T10:27:20.515Z" });
const SLUGS = ["pu-dam-168", "tra-phaendin-siam", "luang-pu-sila", "coin-charoenlap-charoenyot", "shrine-gate"];

// The five migrated items, in a deliberately shuffled stored order.
function items(build = draft) {
  return [
    build({ _id: "i5", name: "ซุ้มประตูศาลปู่ดำ ตราแผ่นดิน", slug: "shrine-gate", excerpt: "มุมถ่ายรูป", categoryId: ids.draftCategory, primaryImage: imageRef(ids.approvedAsset), body: "ซุ้มประตู\n\nแสงเช้า", sortOrder: 5, placeholderFields: [placeholder("body")] }),
    build({ _id: "i1", name: "องค์ปู่ดำ 168", slug: "pu-dam-168", excerpt: "ที่พึ่งทางใจ", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), body: "ย่อหน้าแรก\n\n**ข้อความส่วนนี้เป็นตัวอย่าง** รอยืนยัน", prayerTopics: "เลื่อนขั้น", offerings: "พวงมาลัย", sortOrder: 1, placeholderFields: [placeholder("body"), placeholder("offerings")] }),
    build({ _id: "i2", name: "ตราแผ่นดินสยาม", slug: "tra-phaendin-siam", excerpt: "ตราประจำประเทศ", categoryId: ids.category, primaryImage: imageRef(ids.missingAsset), body: "ตราแผ่นดิน", sortOrder: 2 }),
    build({ _id: "i3", name: "รูปเหมือนหลวงปู่ศิลา", slug: "luang-pu-sila", excerpt: "สรุปตัวอย่าง", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), sortOrder: 3, placeholderFields: [placeholder("excerpt"), placeholder("body")] }),
    build({
      _id: "i4", name: "เหรียญปู่ดำ 168", slug: "coin-charoenlap-charoenyot", excerpt: "", categoryId: ids.draftCategory, primaryImage: imageRef(ids.approvedAsset),
      body: "เหรียญ\n\nสอบถามทางไลน์", inquiryText: "สอบถามราคาและสั่งจองทางไลน์", showVariantQuantities: false, sortOrder: 4,
      variants: [{ key: "v2", sortOrder: 2, name: "เนื้อนวะ", quantity: 400 }, { key: "v1", sortOrder: 1, name: "เนื้อเงิน", quantity: 30 }],
      placeholderFields: [placeholder("inquiryText")],
    }),
  ];
}

function collections({ build = draft } = {}) {
  return {
    SacredItem: items(build),
    Category: [build({ _id: ids.category, name: "สถานที่ศักดิ์สิทธิ์", slug: "sacred-place", sortOrder: 1 }), build({ _id: ids.draftCategory, name: "สายมู", slug: "saimu", sortOrder: 2 })],
    Page: [build({
      _id: "p1", key: "history", title: "ประวัติความเป็นมาของศาลปู่ดำ168", intro: "บทนำ", historyBody: "ย่อหน้าหนึ่ง\n\nย่อหน้าสอง\n\n**ข้อความในส่วนนี้เป็นตัวอย่าง** รอประวัติจริง",
      historyImage: imageRef(ids.approvedAsset, { alt: "องค์ปู่ดำ" }), quote: "คาถา", homeIntroHeading: "ศรัทธา",
      coatOfArms: { heading: "ตราแผ่นดิน", body: "ตรา\n\nคาถา **พระนิพนธ์**", image: imageRef(ids.approvedAsset), parts: [{ key: "b", sortOrder: 2, part: "ฉัตร", meaning: "ราชาธิปไตย" }, { key: "a", sortOrder: 1, part: "มงกุฎ", meaning: "จักรี" }] },
      wishTopics: [{ key: "w1", sortOrder: 1, topic: "เลื่อนขั้น", description: null, icon: "briefcase" }],
      worshipSteps: [{ key: "s1", sortOrder: 1, title: "ตั้งจิต", detail: "จุดธูป" }],
      placeholderFields: [placeholder("historyBody"), placeholder("worshipSteps")],
    })],
    MediaAsset: [asset(ids.approvedAsset)],
  };
}
ids.missingAsset = "aaaaaaaaaaaaaaaaaaaaaaa8";

// Mock models ignore filters (the in-memory publication re-check is what is
// under test). Here the item list is sorted like MongoDB would, and
// findOne honors the lookup key (slug, _id, or key) so detail lookups
// return the requested record.
function sortedModels(data, options) {
  const models = mockModels(data, options);
  const find = models.SacredItem.find.bind(models.SacredItem);
  models.SacredItem.find = (filter, projection, opts) => {
    const query = find(filter, projection, opts);
    return { exec: async () => (await query.exec()).sort((a, b) => a.sortOrder - b.sortOrder) };
  };
  for (const [name, model] of Object.entries(models)) {
    const findOne = model.findOne.bind(model);
    model.findOne = (filter, projection, opts) => {
      const query = findOne(filter, projection, opts);
      const key = ["slug", "_id", "key"].find((k) => typeof filter?.[k] === "string");
      return {
        exec: async () => {
          await query.exec();
          const match = key ? data[name].find((doc) => String(doc[key]) === filter[key]) : data[name][0];
          return match ? structuredClone(match) : null;
        },
      };
    };
  }
  return models;
}

function setup({ data = collections(), mode = "review", fail } = {}) {
  const models = sortedModels(data, fail ? { fail } : undefined);
  const service = createContentService({ models, connect: async () => {}, logger: silent });
  const grant = createReviewAccessPolicy({ evaluate: () => evaluateReviewMode({ CLIENT_REVIEW_LOCAL: "true" }) }).requestGrant();
  let publicCalls = 0;
  const pages = createSitePages({
    review: async () => (mode === "review" ? { status: "ok", repositories: service.withReviewAccess(grant) } : mode === "review-down" ? { status: "unavailable", reason: "connection_failed" } : { status: "disabled" }),
    publicRepositories: () => (publicCalls++, service.public),
  });
  return { pages, models, publicCalls: () => publicCalls };
}

// --- Slugs -------------------------------------------------------------------

test("slugs: only lowercase route slugs are accepted", () => {
  for (const slug of SLUGS) assert.equal(isValidSlug(slug), true, slug);
  for (const slug of ["", "Pu-Dam", "pu_dam", "pu--dam", "-pu", "pu-", "../etc", "pu dam", "pu%2Fdam", "a".repeat(101), { $ne: null }, ["pu-dam-168"], null, 168]) {
    assert.equal(isValidSlug(slug), false, JSON.stringify(slug));
  }
});

test("slugs: invalid values never reach the database; valid ones are literal matches", async () => {
  const { pages, models } = setup();
  for (const slug of [{ $ne: null }, { $regex: ".*" }, "../../history", "PU-DAM-168", "pu-dam-168'", ["pu-dam-168"]]) {
    const result = await pages.sacredItem(slug);
    assert.equal(result.status, "not_found", JSON.stringify(slug));
  }
  assert.equal(models.SacredItem.calls.length, 0, "no query ran for invalid slugs");

  await pages.sacredItem("pu-dam-168");
  const [call] = models.SacredItem.calls;
  assert.equal(call.method, "findOne");
  assert.equal(call.filter.slug, "pu-dam-168", "the slug is a plain string equality");
  assert.equal(typeof call.filter.slug, "string");
});

// --- Review scope ------------------------------------------------------------

test("review: all five items in sortOrder with categories, links, and labels", async () => {
  const { pages, models, publicCalls } = setup();
  const result = await pages.sacredItems();
  assert.equal(result.scope, "review");
  assert.equal(result.status, "ok");
  assert.deepEqual(result.view.map((i) => i.href), SLUGS.map((s) => `/sakkara/${s}`));
  assert.deepEqual(models.SacredItem.calls[0].options.sort, { sortOrder: 1, _id: 1 });
  assert.equal(result.view[0].category.label, "สถานที่ศักดิ์สิทธิ์");
  assert.equal(result.view[3].category.label, "สายมู");
  assert.equal(result.view[2].reviewStatus.tone, "sample", "excerpt placeholder is labeled on the card");
  assert.equal(result.view[0].reviewStatus.tone, "pending");
  assert.equal(result.view[1].image, null, "missing media keeps the card without an image");
  assert.equal(result.view[3].summary, null, "an empty excerpt is omitted, not filled");
  assert.equal(publicCalls(), 0, "review mode never touches the public scope");
});

test("review: each detail page resolves its own record", async () => {
  const { pages } = setup();
  for (const slug of SLUGS) {
    const result = await pages.sacredItem(slug);
    assert.equal(result.status, "ok", slug);
    assert.equal(result.view.slug, slug);
  }
  const unknown = await pages.sacredItem("not-a-real-item");
  assert.equal(unknown.status, "not_found");
});

test("review: detail view shows existing fields only, with per-field labels", async () => {
  const { pages } = setup();
  const pu = (await pages.sacredItem("pu-dam-168")).view;
  assert.equal(pu.category.label, "สถานที่ศักดิ์สิทธิ์");
  assert.equal(pu.prayerTopics, "เลื่อนขั้น");
  assert.equal(pu.offerings, "พวงมาลัย");
  assert.equal(pu.status.offerings.tone, "sample");
  assert.equal(pu.status.body.tone, "sample");
  assert.equal(pu.status.prayerTopics, null);
  assert.equal(pu.status.summary, null);
  assert.deepEqual(pu.body, [[{ text: "ย่อหน้าแรก", strong: false }], [{ text: "ข้อความส่วนนี้เป็นตัวอย่าง", strong: true }, { text: " รอยืนยัน", strong: false }]]);

  const coin = (await pages.sacredItem("coin-charoenlap-charoenyot")).view;
  assert.deepEqual(coin.variants, [{ id: "v1", name: "เนื้อเงิน", quantity: null }, { id: "v2", name: "เนื้อนวะ", quantity: null }], "quantities hidden when showVariantQuantities is false");
  assert.equal(coin.summary, null);
  const json = JSON.stringify(coin);
  assert.ok(!json.includes("สอบถามราคาและสั่งจอง"), "the legacy price note (inquiryText) is not shown");
  for (const key of ["inquiryText", "price", "stock", "\"slugs\""]) assert.ok(!json.includes(key), key);
});

test("review: history renders source paragraphs, ordered lists, and section labels", async () => {
  const { pages } = setup();
  const result = await pages.history();
  assert.equal(result.status, "ok");
  const view = result.view;
  assert.equal(view.title, "ประวัติความเป็นมาของศาลปู่ดำ168");
  assert.equal(view.body.length, 3);
  assert.deepEqual(view.coatOfArms.parts.map((p) => p.part), ["มงกุฎ", "ฉัตร"]);
  assert.deepEqual(view.coatOfArms.body[1], [{ text: "คาถา ", strong: false }, { text: "พระนิพนธ์", strong: true }]);
  assert.equal(view.status.body.tone, "sample");
  assert.equal(view.status.body.label, REVIEW_LABELS.sample);
  assert.equal(view.status.worshipSteps.tone, "sample");
  assert.equal(view.status.intro, null, "blocks without their own placeholders carry no label");
  assert.equal(view.status.coatOfArms, null);
  assert.equal(view.wishTopics[0].description, null);
  assert.equal(view.image.alt, "องค์ปู่ดำ");
});

test("review: an unavailable review connection never falls back to public data", async () => {
  const { pages, publicCalls } = setup({ mode: "review-down" });
  assert.deepEqual(await pages.history(), { scope: "review", status: "unavailable", view: null });
  assert.equal((await pages.sacredItems()).status, "unavailable");
  assert.equal((await pages.sacredItem("pu-dam-168")).status, "unavailable");
  assert.equal(publicCalls(), 0);
});

// --- Public scope ------------------------------------------------------------

test("public: draft records are never shown (empty list, not found)", async () => {
  const { pages, models } = setup({ mode: "disabled" });
  const list = await pages.sacredItems();
  assert.deepEqual(list, { scope: "public", status: "empty", view: [] });
  assert.equal((await pages.history()).status, "not_found");
  for (const slug of SLUGS) assert.equal((await pages.sacredItem(slug)).status, "not_found", slug);
  for (const call of [...models.SacredItem.calls, ...models.Page.calls]) {
    assert.equal(call.filter.status, "published");
    assert.equal(call.filter["review.status"], "approved");
    assert.deepEqual(call.filter["placeholderFields.status"], { $ne: "placeholder" });
  }
});

test("public: only published, approved, placeholder-free records appear", async () => {
  const data = collections({ build: published });
  // Records with open placeholders stay hidden even when published.
  const { pages } = setup({ mode: "disabled", data });
  const list = await pages.sacredItems();
  assert.equal(list.status, "ok");
  assert.deepEqual(list.view.map((i) => i.href), ["/sakkara/tra-phaendin-siam"]);
  assert.equal(list.view[0].reviewStatus, null);
  assert.equal((await pages.sacredItem("tra-phaendin-siam")).status, "ok");
  assert.equal((await pages.sacredItem("pu-dam-168")).status, "not_found");
  assert.equal((await pages.history()).status, "not_found", "the history page has open placeholders");
});

test("public: a database failure is unavailable, not a 404", async () => {
  const { pages } = setup({ mode: "disabled", fail: new Error("connection refused") });
  assert.equal((await pages.history()).status, "unavailable");
  assert.equal((await pages.sacredItems()).status, "unavailable");
  assert.equal((await pages.sacredItem("pu-dam-168")).status, "unavailable");
});

// --- Text and DTO safety -----------------------------------------------------

test("text: legacy-text-v1 paragraphs and bold only; markup stays literal", () => {
  assert.deepEqual(parseLegacyText(null), []);
  assert.deepEqual(parseLegacyText("  "), []);
  assert.deepEqual(parseLegacyText("a\nb\r\n\r\nc"), [[{ text: "a b", strong: false }], [{ text: "c", strong: false }]]);
  assert.deepEqual(parseLegacyText("<script>alert(1)</script> **x**"), [[{ text: "<script>alert(1)</script> ", strong: false }, { text: "x", strong: true }]]);
  assert.deepEqual(parseLegacyText("**unclosed bold"), [[{ text: "**unclosed bold", strong: false }]]);
});

test("dto: page data carries no raw documents or internal fields", async () => {
  const { pages } = setup();
  const views = [await pages.history(), await pages.sacredItems(), ...(await Promise.all(SLUGS.map((s) => pages.sacredItem(s))))];
  const json = JSON.stringify(views);
  for (const marker of ["legacy raw", "\"legacy\"", "\"migration\"", "\"runId\"", "mediaMapping", "assetId", "rights", "placeholderFields", "pending_review", "internal note", "\"_id\"", "flaggedAt", "categoryId", "publicId", "\"review\":{"]) {
    assert.ok(!json.includes(marker), `${marker} leaked into page data`);
  }
  assert.deepEqual(JSON.parse(json), views, "plain JSON");
});
