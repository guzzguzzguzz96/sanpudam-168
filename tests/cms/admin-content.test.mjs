// Read-only admin content inventory: access, environment gate, minimal
// fields, labels, unavailable states, and the type filter. Offline: mock
// models and test-only configuration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminAccessDeniedError, getAdminAccess } from "../../src/server/auth/admin-access.js";
import { CONTENT_TYPES, applyTypeFilter, evaluateInventoryEnvironment, loadContentInventory } from "../../src/server/admin/content-inventory.js";
import { SECRET_URI, draft, mockModels, publishedSite, published } from "./fixtures.mjs";

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

async function principalFor(email) {
  const session = { user: { name: "Test", email }, identity: { provider: "google", subject: "1000001", email, authTime: Math.floor(NOW / 1000) - 60 } };
  const access = await getAdminAccess({ env: AUTH, readSession: async () => session, now: NOW, waitForRequest: async () => {} });
  assert.equal(access.status, "ok");
  return access.principal;
}

// Every content collection, plus records that must never be listed.
function stagingSite() {
  const site = publishedSite();
  return {
    ...site,
    SiteSettings: [{ ...site.SiteSettings[0], status: "draft", review: { status: "pending_review" } }],
    Banner: [draft({ _id: "b1", image: { caption: "โถงสักการะ" }, sortOrder: 1 }), draft({ _id: "b2", image: { caption: "" }, sortOrder: 2 })],
    Video: [draft({ _id: "v1", title: "วิดีโอแนะนำ" })],
    Review: [draft({ _id: "r1", displayName: "ผู้ศรัทธา", quote: "ข้อความรีวิว" })],
    TeamMember: [{ _id: "t1", name: "ทีมงาน", status: "mystery", review: {} }],
    MediaAsset: [{ _id: "m1", status: "draft" }],
    MigrationRun: [{ _id: "run1" }],
  };
}

test("environment: local and the dev Preview only; Production and other hosts are refused", () => {
  assert.deepEqual(evaluateInventoryEnvironment({}), { enabled: true, mode: "local", reason: null });
  assert.equal(evaluateInventoryEnvironment({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev" }).mode, "vercel-preview");
  const refused = [
    { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev", VERCEL_TARGET_ENV: "production" },
    { VERCEL_ENV: "production" },
    { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature-x" },
    { VERCEL: "1", VERCEL_ENV: "development" },
    { CI: "true" },
    { NETLIFY: "true" },
    undefined,
  ];
  for (const env of refused) assert.equal(evaluateInventoryEnvironment(env).enabled, false, JSON.stringify(env));
  // Client Review flags change nothing.
  assert.equal(evaluateInventoryEnvironment({ VERCEL: "1", VERCEL_ENV: "production", CLIENT_REVIEW_ENABLED: "true", CLIENT_REVIEW_LOCAL: "true" }).enabled, false);
  assert.equal(evaluateInventoryEnvironment({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main", CLIENT_REVIEW_ENABLED: "true" }).enabled, false);
});

test("access: no issued admin principal, no configuration read and no connection", async () => {
  let connects = 0;
  const connect = async () => (connects++, { models: mockModels(stagingSite()) });
  const forged = [null, undefined, {}, { subject: "1000001", email: "owner@example.test", role: "owner" }, Object.freeze({ role: "owner" })];
  for (const principal of forged) {
    await assert.rejects(loadContentInventory(principal, { env: DB, connect, logger: silent }), AdminAccessDeniedError);
  }
  // Review flags without a principal grant nothing either.
  await assert.rejects(loadContentInventory(null, { env: { ...DB, CLIENT_REVIEW_LOCAL: "true", CLIENT_REVIEW_ENABLED: "true" }, connect, logger: silent }), AdminAccessDeniedError);
  assert.equal(connects, 0);
});

test("inventory: every content collection, minimal fields, Thai labels for stored values", async () => {
  const models = mockModels(stagingSite());
  const inventory = await loadContentInventory(await principalFor("editor@example.test"), { env: DB, connect: async () => ({ models }), logger: silent });
  assert.equal(inventory.status, "ok");

  const expectedModels = CONTENT_TYPES.map((type) => type.model).sort();
  const touched = Object.entries(models).filter(([, model]) => model.calls.length).map(([name]) => name).sort();
  assert.deepEqual(touched, expectedModels, "media assets and migration runs are never read");
  for (const name of touched) {
    for (const call of models[name].calls) {
      assert.equal(call.method, "find");
      assert.deepEqual(call.filter, {});
      assert.ok(Object.keys(call.projection).every((field) => ["status", "review.status", "identity.name", "title", "name", "sortOrder", "date", "image.caption", "image.alt", "question", "displayName"].includes(field)), `${name} projection`);
      assert.equal(call.options.lean, true);
    }
  }

  const counts = Object.fromEntries(inventory.types.map((type) => [type.key, type.count]));
  assert.deepEqual(counts, { "site-settings": 1, pages: 1, "sacred-items": 2, categories: 1, news: 1, banners: 2, gallery: 2, faqs: 1, videos: 1, reviews: 1, team: 1 });
  assert.equal(inventory.total, 14);

  for (const item of inventory.items) assert.deepEqual(Object.keys(item).sort(), ["id", "publication", "review", "title", "type", "typeLabel"]);
  const byTitle = (title) => inventory.items.find((item) => item.title === title);
  assert.deepEqual(byTitle("ศาลปู่ดำ168 และตราแผ่นดิน").publication, { value: "draft", label: "ฉบับร่าง", known: true });
  assert.deepEqual(byTitle("ศาลปู่ดำ168 และตราแผ่นดิน").review, { value: "pending_review", label: "รอตรวจทาน", known: true });
  assert.deepEqual(byTitle("คำถาม?").publication, { value: "published", label: "เผยแพร่แล้ว", known: true });
  assert.deepEqual(byTitle("คำถาม?").review, { value: "approved", label: "อนุมัติแล้ว", known: true });
  assert.equal(byTitle("โถงสักการะ").typeLabel, "แบนเนอร์");
  assert.ok(byTitle("แบนเนอร์ลำดับ 2"), "a banner without a caption gets a neutral title");
  // Values outside the schema are shown as stored, never relabelled.
  assert.deepEqual(byTitle("ทีมงาน").publication, { value: "mystery", label: "ค่าที่ไม่รู้จัก (mystery)", known: false });
  assert.deepEqual(byTitle("ทีมงาน").review, { value: null, label: "ไม่มีข้อมูล", known: false });

  const json = JSON.stringify(inventory);
  for (const field of ["legacy", "migration", "placeholderFields", "quote", "contact", "assetId", "secret"]) assert.ok(!json.includes(field), `${field} leaked`);
});

test("inventory: empty and unavailable states are honest and redacted", async () => {
  const principal = await principalFor("owner@example.test");
  const empty = Object.fromEntries(CONTENT_TYPES.map((type) => [type.model, []]));
  assert.equal((await loadContentInventory(principal, { env: DB, connect: async () => ({ models: mockModels(empty) }), logger: silent })).status, "empty");

  const logs = [];
  const logger = { error: (line) => logs.push(line) };
  let connects = 0;
  const connect = async () => (connects++, { models: mockModels(stagingSite()) });
  const production = { ...DB, VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
  assert.deepEqual(await loadContentInventory(principal, { env: production, connect, logger }), { status: "unavailable", reason: "environment" });
  assert.deepEqual(await loadContentInventory(principal, { env: {}, connect, logger }), { status: "unavailable", reason: "not_configured" });
  assert.equal(connects, 0, "no connection in Production or without configuration");

  const refused = Object.assign(new Error(`could not connect to ${SECRET_URI}`), { name: "MongoServerSelectionError" });
  assert.deepEqual(await loadContentInventory(principal, { env: DB, connect: async () => { throw refused; }, logger }), { status: "unavailable", reason: "connection_failed" });
  const failing = mockModels(stagingSite(), { fail: new Error(`query failed on ${SECRET_URI}`) });
  assert.deepEqual(await loadContentInventory(principal, { env: DB, connect: async () => ({ models: failing }), logger }), { status: "unavailable", reason: "query_failed" });
  for (const line of logs) assert.ok(!line.includes("pa55-w0rd") && !line.includes("cluster9"), "connection details leaked");
});

test("filter: only one known type applies; anything else shows all and is never echoed", async () => {
  const inventory = await loadContentInventory(await principalFor("owner@example.test"), { env: DB, connect: async () => ({ models: mockModels(stagingSite()) }), logger: silent });
  const news = applyTypeFilter(inventory, "news");
  assert.equal(news.type, "news");
  assert.equal(news.invalid, false);
  assert.ok(news.items.length > 0 && news.items.every((item) => item.type === "news"));
  assert.deepEqual(applyTypeFilter(inventory, undefined), { type: null, invalid: false, items: inventory.items });
  assert.deepEqual(applyTypeFilter(inventory, ""), { type: null, invalid: false, items: inventory.items });
  for (const value of ["media", "migration_runs", "NEWS", " news", "__proto__", "constructor", "toString", "news&type=pages", "<script>", "x".repeat(5000), ["news", "pages"], { $ne: null }, 1]) {
    const result = applyTypeFilter(inventory, value);
    assert.equal(result.type, null, String(value).slice(0, 20));
    assert.equal(result.invalid, true);
    assert.equal(result.items, inventory.items);
    assert.ok(!JSON.stringify({ type: result.type, invalid: result.invalid }).includes("script"));
  }
});

test("labels: published records with unknown review values stay visible", async () => {
  const site = { ...Object.fromEntries(CONTENT_TYPES.map((type) => [type.model, []])), News: [published({ _id: "n9", title: "ข่าวเผยแพร่", review: { status: "rejected_legacy" } })] };
  const inventory = await loadContentInventory(await principalFor("owner@example.test"), { env: DB, connect: async () => ({ models: mockModels(site) }), logger: silent });
  assert.equal(inventory.total, 1);
  assert.equal(inventory.items[0].review.label, "ค่าที่ไม่รู้จัก (rejected_legacy)");
});
