// Read-only admin content detail: access, URL validation, exact lookup,
// explicit fields, images, placeholder flags, and failure states. Offline:
// filter-aware mock models and test-only configuration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminAccessDeniedError, getAdminAccess } from "../../src/server/auth/admin-access.js";
import { CONTENT_DETAIL_FIELD_MAPS, contentListHref, loadContentDetail } from "../../src/server/admin/content-detail.js";
import { CONTENT_TYPES } from "../../src/server/admin/content-inventory.js";
import { SECRET_URI } from "./fixtures.mjs";

const AUTH = {
  AUTH_SECRET: "test-only-secret-0123456789abcdefghijklmnop",
  AUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "test-client-id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-client-secret",
  ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:owner,editor@example.test:editor",
};
const DB = { CLIENT_REVIEW_MONGODB_URI: SECRET_URI, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_staging" };
const NOW = Date.UTC(2026, 10, 12, 9, 0, 0);
const silent = { error() {} };
const oid = (n) => n.toString(16).padStart(24, "0");

async function principalFor(email = "owner@example.test") {
  const session = { user: { name: "Test", email }, identity: { provider: "google", subject: "1000001", email, authTime: Math.floor(NOW / 1000) - 60 } };
  const access = await getAdminAccess({ env: AUTH, readSession: async () => session, now: NOW, waitForRequest: async () => {} });
  return access.principal;
}

// Filter-aware read-only mock: exact _id lookups and $in lists.
function models(collections) {
  const out = {};
  for (const [name, docs] of Object.entries(collections)) {
    const calls = [];
    out[name] = {
      calls,
      findOne(filter, projection, options) {
        calls.push({ method: "findOne", filter, projection, options });
        return { exec: async () => structuredClone(docs.find((doc) => String(doc._id) === String(filter._id)) ?? null) };
      },
      find(filter, projection, options) {
        calls.push({ method: "find", filter, projection, options });
        const ids = filter?._id?.$in ?? [];
        return { exec: async () => structuredClone(docs.filter((doc) => ids.includes(String(doc._id)))) };
      },
    };
  }
  return out;
}

const internal = {
  legacy: { key: "legacy-key-secret", raw: { password: "legacy raw secret" }, sourceUrl: "https://old.example/admin" },
  migration: { runId: "run-secret-123", importChecksum: "c".repeat(64) },
  createdBy: oid(900),
  updatedBy: oid(901),
};
const content = (fields) => ({ status: "draft", review: { status: "pending_review", note: null }, placeholderFields: [], ...internal, ...fields });
const asset = (n, overrides = {}) => ({
  _id: oid(n),
  resourceType: "image",
  width: 1200,
  height: 800,
  cloudinary: { secureUrl: `https://res.cloudinary.com/demo/image/upload/v7/sanpudam168/staging/a${n}.webp`, publicId: `sanpudam168/staging/a${n}`, version: 7, format: "webp", assetId: "cloud-asset-secret" },
  rights: { status: "approved", owner: "private owner name", notes: ["private rights note"] },
  approval: { status: "pending" },
  deletedAt: null,
  legacy: { key: "media-legacy-secret" },
  ...overrides,
});
const ref = (n, overrides = {}) => ({ assetId: n ? oid(n) : null, alt: "ข้อความแทนภาพ", caption: "คำบรรยาย", focalPoint: null, mediaMapping: { status: "resolved", legacyUrl: "https://old.example/legacy.jpg", note: "mapping note secret" }, ...overrides });

const IDS = { settings: oid(1), page: oid(2), item: oid(3), category: oid(4), news: oid(5), banner: oid(6), gallery: oid(7), faq: oid(8), video: oid(9), review: oid(10), team: oid(11) };

function stagingSite() {
  return {
    SiteSettings: [content({
      _id: IDS.settings, key: "default",
      identity: { name: "ศาลปู่ดำ168", shortName: "ปู่ดำ", tagline: null, description: "คำอธิบาย" },
      branding: { logo: ref(100), logoNote: "internal note" },
      contact: { address: "ที่อยู่\nบรรทัดสอง", locationShort: "ถนนมหาราช", phoneNumber: "0800000000", lineId: "@line", directionsUrl: "https://share.google/x", mapEmbedQuery: null, verified: false },
      openingHours: { opens: "08:00", closes: "20:00", daysOfWeek: ["mon", "sun"], daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
      socialLinks: [{ platform: "facebook", url: "https://facebook.com/x", verified: false }],
      contactTopics: [{ key: "b", sortOrder: 2, label: "หัวข้อสอง" }, { key: "a", sortOrder: 1, label: "หัวข้อหนึ่ง" }],
      analytics: { enabled: false, legacyValuesPresent: ["UA-SECRET"] },
      placeholderFields: [
        { path: "openingHours.daysText", status: "placeholder", source: "legacy", legacyPath: "secret.legacy.path", note: "รอยืนยันวันเปิด", flaggedAt: new Date("2026-10-17T10:00:00Z") },
        { path: "contact.address", status: "confirmed_correct", source: "legacy", note: null, flaggedAt: new Date("2026-10-17T10:00:00Z") },
      ],
    })],
    Page: [content({
      _id: IDS.page, key: "history", title: "ประวัติ", intro: "บทนำ", historyBody: "<script>alert(1)</script>\n**ตัวหนา**", quote: null, homeIntroHeading: "หัวข้อ",
      historyImage: ref(101, { mediaMapping: { status: "missing" }, assetId: null }),
      coatOfArms: { heading: "ตรา", body: "เนื้อหา", image: ref(102), parts: [{ key: "p2", sortOrder: 2, part: "ข", meaning: "ความหมาย ข" }, { key: "p1", sortOrder: 1, part: "ก", meaning: "ความหมาย ก" }] },
      wishTopics: [{ key: "w", sortOrder: 1, topic: "การงาน", description: null, icon: "briefcase" }],
      worshipSteps: [{ key: "s", sortOrder: 1, title: "ขั้นหนึ่ง", detail: "รายละเอียด" }],
      seo: { title: null, description: null },
      placeholderFields: [{ path: "worshipSteps", status: "placeholder", source: "legacy", note: null, flaggedAt: new Date("2026-10-17T10:00:00Z") }],
    })],
    SacredItem: [content({ _id: IDS.item, name: "องค์ปู่ดำ", slug: "pu-dam-168", type: "sacred_object", categoryId: IDS.category, primaryImage: ref(103), excerpt: "ย่อ", body: null, prayerTopics: "การงาน", offerings: null, inquiryText: null, variants: [{ key: "v", sortOrder: 1, name: "เนื้อทองคำ", quantity: 99, quantityText: null, note: null }], showVariantQuantities: false, sortOrder: 1 })],
    Category: [content({ _id: IDS.category, name: "สถานที่ศักดิ์สิทธิ์", slug: "sacred-place", description: null, sortOrder: 1 })],
    News: [content({ _id: IDS.news, title: "ข่าวหนึ่ง", slug: "news-one", date: "2026-03-20", coverImage: ref(104), excerpt: "ย่อ", body: "เนื้อหา", images: [ref(105), ref(106)] })],
    Banner: [content({ _id: IDS.banner, image: ref(107, { caption: "โถงสักการะ" }), mobileImage: null, sortOrder: 1 })],
    GalleryItem: [content({ _id: IDS.gallery, galleryKey: "shrine-main", image: ref(108), sortOrder: 1 })],
    Faq: [content({ _id: IDS.faq, question: "คำถาม?", answer: "คำตอบ", showOnHome: true, sortOrder: 1 })],
    Video: [content({ _id: IDS.video, title: "วิดีโอ", videoAssetId: null, videoMapping: { status: "missing", legacyValue: { url: "https://old.example/v.mp4" } }, posterMode: "auto", poster: null, description: null, sortOrder: 1 })],
    Review: [content({ _id: IDS.review, displayName: "ผู้ศรัทธา", sourceLabel: null, quote: "ข้อความ", rating: 5, consent: { status: "pending", note: "consent note secret" }, sortOrder: 1 })],
    TeamMember: [content({ _id: IDS.team, name: "ทีมงาน", roleTitle: "ผู้ดูแล", photo: null, bio: null, consent: { status: "mystery_value" }, sortOrder: 1 })],
    MediaAsset: [
      asset(100), asset(102, { rights: {} }), asset(103, { rights: { status: "rejected" } }), asset(104), asset(105, { deletedAt: new Date() }),
      asset(107, { rights: { status: "pending_owner_confirmation" }, approval: {} }), asset(108),
    ],
  };
}

const SECRETS = ["legacy-key-secret", "legacy raw secret", "old.example", "run-secret-123", "cloud-asset-secret", "private owner name", "private rights note", "media-legacy-secret", "mapping note secret", "consent note secret", "secret.legacy.path", "UA-SECRET", "internal note", oid(900), oid(901)];
const load = async (type, id, options = {}) => loadContentDetail(await principalFor(), { type, id }, { env: DB, connect: async () => ({ models: options.models ?? models(stagingSite()) }), logger: silent, ...options });

test("access: an issued admin principal is required before anything else", async () => {
  let connects = 0;
  const connect = async () => (connects++, { models: models(stagingSite()) });
  for (const principal of [null, {}, { role: "owner", subject: "1000001", email: "owner@example.test" }]) {
    await assert.rejects(loadContentDetail(principal, { type: "news", id: IDS.news }, { env: { ...DB, CLIENT_REVIEW_LOCAL: "true" }, connect, logger: silent }), AdminAccessDeniedError);
  }
  assert.equal(connects, 0);
});

test("urls: type and id are validated before configuration, connection, or query", async () => {
  let connects = 0;
  const connect = async () => (connects++, { models: models(stagingSite()) });
  const principal = await principalFor("editor@example.test");
  for (const type of ["media", "media-assets", "migration-runs", "NEWS", "__proto__", "constructor", "", null, undefined, ["news"], { $ne: null }]) {
    assert.deepEqual(await loadContentDetail(principal, { type, id: IDS.news }, { env: DB, connect, logger: silent }), { status: "not_found", reason: "invalid_type" }, String(type));
  }
  for (const id of ["s1", "123", "z".repeat(24), oid(0xabcdef).toUpperCase(), `${IDS.news}0`, ` ${IDS.news}`, "", null, { $ne: null }, [IDS.news], `${IDS.news.slice(0, 23)}'`]) {
    assert.deepEqual(await loadContentDetail(principal, { type: "news", id }, { env: DB, connect, logger: silent }), { status: "not_found", reason: "invalid_id" }, String(id));
  }
  assert.equal(connects, 0);
});

test("lookup: exact id in the requested collection only; a missing record is not found", async () => {
  const site = models(stagingSite());
  const found = await load("news", IDS.news, { models: site });
  assert.equal(found.status, "ok");
  assert.deepEqual(site.News.calls[0].filter, { _id: IDS.news });
  assert.equal(site.News.calls[0].method, "findOne");
  // A news id under another type, and an unknown id, are both "missing".
  assert.deepEqual(await load("faqs", IDS.news), { status: "not_found", reason: "missing" });
  assert.deepEqual(await load("news", oid(999)), { status: "not_found", reason: "missing" });
});

test("fields: every supported type loads with explicit fields only", async () => {
  const typeIds = { "site-settings": IDS.settings, pages: IDS.page, "sacred-items": IDS.item, categories: IDS.category, news: IDS.news, banners: IDS.banner, gallery: IDS.gallery, faqs: IDS.faq, videos: IDS.video, reviews: IDS.review, team: IDS.team };
  assert.deepEqual(Object.keys(typeIds).sort(), CONTENT_TYPES.map((type) => type.key).sort());
  for (const type of CONTENT_TYPES) assert.ok(CONTENT_DETAIL_FIELD_MAPS[type.model], type.model);

  for (const [type, id] of Object.entries(typeIds)) {
    const site = models(stagingSite());
    const result = await load(type, id, { models: site });
    assert.equal(result.status, "ok", type);
    const json = JSON.stringify(result);
    for (const secret of SECRETS) assert.ok(!json.includes(secret), `${type}: ${secret} leaked`);
    for (const call of Object.values(site).flatMap((model) => model.calls)) {
      for (const field of Object.keys(call.projection ?? {})) {
        // Only content notes are read: review and placeholder notes, and the
        // sacred-item variant note (part of the item's content).
        const otherNote = field.endsWith(".note") && !["review.note", "placeholderFields.note", "variants.note"].includes(field);
        assert.ok(!otherNote, `${type}: ${field}`);
        assert.doesNotMatch(field, /^(legacy|migration|createdBy|updatedBy|analytics|cloudinaryImport|source|contentHash)\b|legacyUrl|legacyValue|rights\.(owner|notes)|placeholderFields\.legacyPath|cloudinary\.assetId/, `${type}: ${field}`);
      }
      if (call.method === "find") assert.equal(Object.keys(call.filter).join(), "_id");
    }
    assert.ok(result.detail.sections.length > 0);
    assert.ok(result.detail.title && result.detail.title !== "(ไม่มีชื่อ)", type);
  }
});

test("detail: statuses, labels, lists, and migrated text exactly as stored", async () => {
  const { detail } = await load("site-settings", IDS.settings);
  assert.equal(detail.title, "ศาลปู่ดำ168");
  assert.deepEqual(detail.type, { key: "site-settings", label: "การตั้งค่าเว็บไซต์" });
  assert.deepEqual(detail.publication, { label: "ฉบับร่าง", known: true });
  assert.deepEqual(detail.review, { label: "รอตรวจทาน", known: true });
  const field = (label) => detail.sections.flatMap((section) => section.fields).find((entry) => entry.label === label);
  assert.equal(field("ที่อยู่").value, "ที่อยู่\nบรรทัดสอง");
  assert.equal(field("ที่อยู่").kind, "longtext");
  assert.equal(field("ยืนยันข้อมูลติดต่อแล้ว").value, "ไม่ใช่");
  assert.equal(field("วันในสัปดาห์").value, "จันทร์, อาทิตย์");
  assert.deepEqual(field("หัวข้อการติดต่อ").value.map((item) => item.primary), ["หัวข้อหนึ่ง", "หัวข้อสอง"]);
  assert.equal(field("ลิงก์โซเชียลมีเดีย").value[0].secondary, "https://facebook.com/x · ยังไม่ยืนยัน");
  assert.equal(field("คำโปรย").value, "");

  const page = (await load("pages", IDS.page)).detail;
  const body = page.sections.flatMap((section) => section.fields).find((entry) => entry.label === "เนื้อหาประวัติ");
  assert.equal(body.value, "<script>alert(1)</script>\n**ตัวหนา**", "stored text is returned as a plain string");
  assert.deepEqual(page.sections[1].fields.find((entry) => entry.label === "ส่วนประกอบและความหมาย").value.map((item) => item.primary), ["ก", "ข"]);

  const item = (await load("sacred-items", IDS.item)).detail.sections[0].fields;
  assert.equal(item.find((entry) => entry.label === "หมวดหมู่").value, "สถานที่ศักดิ์สิทธิ์");
  assert.equal(item.find((entry) => entry.label === "ที่อยู่หน้า").value, "/sakkara/pu-dam-168");
  assert.equal(item.find((entry) => entry.label === "ประเภทรายการ").value, "วัตถุมงคล");

  const team = (await load("team", IDS.team)).detail.sections[0].fields;
  assert.equal(team.find((entry) => entry.label === "ความยินยอมในการเผยแพร่").value, "ยังไม่ยืนยัน (ค่าที่บันทึก: mystery_value)");
  const video = (await load("videos", IDS.video)).detail.sections[0].fields;
  assert.equal(video.find((entry) => entry.label === "ไฟล์วิดีโอ").value, "ยังไม่มีไฟล์วิดีโอ");
});

test("placeholders: open flags with labels and notes; fields are marked", async () => {
  const { detail } = await load("site-settings", IDS.settings);
  assert.deepEqual(detail.placeholders.open, [{ path: "openingHours.daysText", label: "วันเปิดทำการ", status: "ยังเป็นข้อความตัวอย่าง", note: "รอยืนยันวันเปิด", flaggedAt: "2026-10-17" }]);
  assert.equal(detail.placeholders.resolvedCount, 1);
  const fields = detail.sections.flatMap((section) => section.fields);
  assert.equal(fields.find((entry) => entry.label === "วันเปิดทำการ").placeholder, true);
  assert.equal(fields.find((entry) => entry.label === "ที่อยู่").placeholder, false, "resolved flags do not mark fields");
  const page = (await load("pages", IDS.page)).detail;
  assert.equal(page.placeholders.open[0].label, "ขั้นตอนการสักการะ");
  assert.equal((await load("faqs", IDS.faq)).detail.placeholders.open.length, 0);

  // A flag on the video file id belongs to the "video file" field.
  const site = stagingSite();
  site.Video[0].placeholderFields = [{ path: "videoAssetId", status: "placeholder", source: "legacy", note: "ยังไม่มีไฟล์", flaggedAt: new Date("2026-10-17T10:00:00Z") }];
  const video = (await load("videos", IDS.video, { models: models(site) })).detail;
  assert.equal(video.placeholders.open[0].label, "ไฟล์วิดีโอ");
  assert.equal(video.sections[0].fields.find((entry) => entry.label === "ไฟล์วิดีโอ").placeholder, true);
});

test("images: thumbnails when usable; rights and approval only as recorded, otherwise unconfirmed", async () => {
  const fields = async (type, id) => (await load(type, id)).detail.sections.flatMap((section) => section.fields);
  const logo = (await fields("site-settings", IDS.settings)).find((entry) => entry.label === "โลโก้").value;
  assert.match(logo.thumbnail.src, /^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/f_auto,q_auto,c_limit,w_480\/v7\/sanpudam168\/staging\/a100\.webp$/);
  assert.deepEqual({ width: logo.thumbnail.width, height: logo.thumbnail.height }, { width: 480, height: 320 });
  assert.deepEqual(logo.rights, { label: "อนุมัติสิทธิ์แล้ว", known: true });
  assert.deepEqual(logo.approval, { label: "รออนุมัติภาพ", known: true });
  assert.equal(logo.file, null);
  assert.equal(logo.mapping.label, "เชื่อมไฟล์ภาพแล้ว");

  const page = await fields("pages", IDS.page);
  const missing = page.find((entry) => entry.label === "ภาพประกอบประวัติ").value;
  assert.equal(missing.thumbnail, null);
  assert.equal(missing.file, "ไม่มีการอ้างอิงไฟล์ภาพ");
  assert.equal(missing.mapping.label, "ไม่มีไฟล์ภาพ");
  assert.equal(missing.rights, null, "no asset, no rights claim");
  const unrecorded = page.find((entry) => entry.label === "ภาพตราแผ่นดิน").value;
  assert.deepEqual(unrecorded.rights, { label: "ยังไม่ยืนยัน", known: false });

  const rejected = (await fields("sacred-items", IDS.item)).find((entry) => entry.label === "ภาพหลัก").value;
  assert.equal(rejected.thumbnail, null, "rejected rights: no preview");
  assert.equal(rejected.rights.label, "ไม่อนุมัติสิทธิ์");

  const news = (await fields("news", IDS.news)).find((entry) => entry.label === "ภาพประกอบในข่าว").value;
  assert.equal(news[0].file, "ไฟล์ภาพถูกลบแล้ว");
  assert.equal(news[0].thumbnail, null);
  assert.equal(news[1].file, "ไม่พบไฟล์ภาพในคลังสื่อ");

  const banner = (await fields("banners", IDS.banner)).find((entry) => entry.label === "ภาพหลัก (เดสก์ท็อป)").value;
  assert.equal(banner.rights.label, "รอเจ้าของยืนยันสิทธิ์");
  assert.deepEqual(banner.approval, { label: "ยังไม่ยืนยัน", known: false });
  assert.equal((await fields("banners", IDS.banner)).find((entry) => entry.label === "ภาพสำหรับมือถือ").value, null);
});

test("failures: environment, configuration, connection, and query are unavailable, not missing", async () => {
  const principal = await principalFor();
  let connects = 0;
  const connect = async () => (connects++, { models: models(stagingSite()) });
  assert.deepEqual(await loadContentDetail(principal, { type: "news", id: IDS.news }, { env: { ...DB, VERCEL: "1", VERCEL_ENV: "production" }, connect, logger: silent }), { status: "unavailable", reason: "environment" });
  assert.deepEqual(await loadContentDetail(principal, { type: "news", id: IDS.news }, { env: { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main", ...DB }, connect, logger: silent }), { status: "unavailable", reason: "environment" });
  assert.deepEqual(await loadContentDetail(principal, { type: "news", id: IDS.news }, { env: {}, connect, logger: silent }), { status: "unavailable", reason: "not_configured" });
  assert.equal(connects, 0);

  const logs = [];
  const logger = { error: (line) => logs.push(line) };
  const failingConnect = async () => { throw Object.assign(new Error(`cannot reach ${SECRET_URI}`), { name: "MongoNetworkError" }); };
  assert.deepEqual(await loadContentDetail(principal, { type: "news", id: IDS.news }, { env: DB, connect: failingConnect, logger }), { status: "unavailable", reason: "connection_failed" });
  const broken = models(stagingSite());
  broken.News.findOne = () => ({ exec: async () => { throw new Error(`query failed ${SECRET_URI}`); } });
  assert.deepEqual(await loadContentDetail(principal, { type: "news", id: IDS.news }, { env: DB, connect: async () => ({ models: broken }), logger }), { status: "unavailable", reason: "query_failed" });
  for (const line of logs) assert.ok(!line.includes("pa55-w0rd") && !line.includes("cluster9"));
});

test("back link: keeps a valid type filter only", () => {
  assert.equal(contentListHref("news"), "/admin/content?type=news");
  assert.equal(contentListHref("site-settings"), "/admin/content?type=site-settings");
  for (const value of [undefined, "", "media", "news&x=1", "//evil.example", "https://evil.example", ["news"], "__proto__"]) assert.equal(contentListHref(value), "/admin/content", String(value));
});
