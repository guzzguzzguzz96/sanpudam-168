// Publication safety, draft access, and error handling of the CMS data
// layer. Offline: mock models only; MongoDB is never contacted.
//
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../../src/server/cms/content-service.js";
import { createDraftAccessPolicy, defaultDraftAccessPolicy, DraftAccessDeniedError } from "../../src/server/cms/draft-access.js";
import { isPubliclyVisible, publicContentFilter } from "../../src/server/cms/policy.js";
import { loadHomepageContent } from "../../src/server/cms/homepage.js";
import { assertDatabaseMatchesEnvironment, sanitizeError } from "../../src/lib/db.js";
import { SECRET_URI, draft, mockModels, pendingReview, published, publishedSite, withOpenPlaceholder } from "./fixtures.mjs";

const silent = { error() {} };
const service = (collections, extra = {}) => {
  const models = mockModels(collections, extra.modelOptions);
  return { models, service: createContentService({ models, connect: extra.connect ?? (async () => {}), logger: extra.logger ?? silent, sanitize: (e) => sanitizeError(e, SECRET_URI) }) };
};
const faq = (id, build) => build({ _id: id, question: `คำถาม ${id}`, answer: "คำตอบ", showOnHome: true, sortOrder: 1 });

test("policy: public filter requires published, approved, and no open placeholders", () => {
  assert.deepEqual(publicContentFilter({ key: "history" }), {
    key: "history",
    status: "published",
    "review.status": "approved",
    "placeholderFields.status": { $ne: "placeholder" },
  });
  // Caller filters cannot override the publication rule.
  assert.equal(publicContentFilter({ status: "draft" }).status, "published");
});

test("public: every content query carries the publication filter", async () => {
  const { models, service: s } = service(publishedSite());
  await loadHomepageContent(s.public);
  for (const [name, model] of Object.entries(models)) {
    if (name === "MediaAsset") continue;
    assert.ok(model.calls.length > 0, `${name} queried`);
    for (const call of model.calls) {
      assert.equal(call.filter.status, "published", name);
      assert.equal(call.filter["review.status"], "approved", name);
      assert.deepEqual(call.filter["placeholderFields.status"], { $ne: "placeholder" }, name);
      assert.equal(call.projection.legacy, 0, `${name} excludes legacy data`);
      assert.equal(call.projection.migration, 0, `${name} excludes migration data`);
    }
  }
  for (const call of models.MediaAsset.calls) assert.equal(call.filter["rights.status"], "approved");
});

test("public: drafts, pending-review, and placeholder records are rejected even if the query returns them", async () => {
  const { service: s } = service({
    Faq: [faq("draft", draft), faq("pending", pendingReview), faq("placeholder", withOpenPlaceholder), faq("ok", published)],
  });
  const result = await s.public.faqs();
  assert.equal(result.status, "ok");
  assert.deepEqual(result.data.map((d) => d._id), ["ok"]);
});

test("public: resolved placeholder flags do not block publication", () => {
  const doc = published({ placeholderFields: [{ path: "x", status: "confirmed_correct" }, { path: "y", status: "replaced" }] });
  assert.equal(isPubliclyVisible(doc), true);
  assert.equal(isPubliclyVisible(withOpenPlaceholder({})), false);
  assert.equal(isPubliclyVisible(pendingReview({})), false);
  assert.equal(isPubliclyVisible({ ...published({}), status: "archived" }), false);
  assert.equal(isPubliclyVisible(null), false);
});

test("public: a single unpublished record is not returned", async () => {
  const { service: s } = service({ Page: [draft({ _id: "p", key: "history", title: "ร่าง" })], MediaAsset: [] });
  const result = await s.public.historyPage();
  assert.equal(result.status, "empty");
  assert.equal(result.data, null);
});

test("public: categories that are not published are dropped, not substituted", async () => {
  const site = publishedSite();
  const { service: s } = service(site);
  const result = await s.public.sacredItems();
  assert.equal(result.categories.size, 1);
  assert.equal(result.categories.has("cccccccccccccccccccccccd"), false);
});

test("draft access: missing or forged grants are refused before any query", async () => {
  const { models, service: s } = service({ Faq: [faq("draft", draft)] });
  assert.throws(() => s.withDraftAccess(), DraftAccessDeniedError);
  assert.throws(() => s.withDraftAccess(null), DraftAccessDeniedError);
  assert.throws(() => s.withDraftAccess({ subject: "owner", role: "admin", issuedAt: Date.now() }), DraftAccessDeniedError);
  assert.throws(() => s.withDraftAccess("preview"), DraftAccessDeniedError);
  assert.equal(models.Faq.calls.length, 0);
});

test("draft access: the default policy fails closed", async () => {
  await assert.rejects(defaultDraftAccessPolicy.requestGrant({ headers: { cookie: "preview=1" } }), DraftAccessDeniedError);
  const incomplete = createDraftAccessPolicy({ authorize: async () => ({ subject: "x" }) });
  await assert.rejects(incomplete.requestGrant({}), DraftAccessDeniedError);
  assert.throws(() => createDraftAccessPolicy({}), TypeError);
});

test("draft access: a grant from an authorizer reads drafts; public scope still does not", async () => {
  const { service: s } = service({ Faq: [faq("draft", draft), faq("archived", (f) => ({ ...draft(f), status: "archived" }))] });
  const policy = createDraftAccessPolicy({ authorize: async (request) => (request.sessionValid ? { subject: "editor-1", role: "editor" } : null) });
  await assert.rejects(policy.requestGrant({ sessionValid: false }), DraftAccessDeniedError);
  const grant = await policy.requestGrant({ sessionValid: true });
  assert.ok(Object.isFrozen(grant));
  const draftResult = await s.withDraftAccess(grant).faqs();
  assert.deepEqual(draftResult.data.map((d) => d._id), ["draft"]);
  assert.equal((await s.public.faqs()).status, "empty");
  // A copy of a real grant is not a grant.
  assert.throws(() => s.withDraftAccess({ ...grant }), DraftAccessDeniedError);
});

test("errors: database unavailable gives 'unavailable', sanitized logs, no drafts", async () => {
  const logged = [];
  const { service: s } = service(
    { Faq: [faq("draft", draft)] },
    { connect: async () => { throw new Error(`querySrv ENOTFOUND for ${SECRET_URI} user app-user pa55-w0rd host cluster9.zzz111.example.invalid`); }, logger: { error: (m) => logged.push(m) } },
  );
  const result = await s.public.faqs();
  assert.deepEqual(result.data, []);
  assert.equal(result.status, "unavailable");
  assert.equal(result.media.resolve({ assetId: "x", mediaMapping: { status: "resolved" } }), null);
  assert.equal(logged.length, 1);
  for (const secret of ["pa55-w0rd", "app-user", "zzz111", "cluster9", SECRET_URI]) assert.ok(!logged[0].includes(secret), `${secret} leaked`);
});

test("errors: query failures in the public scope degrade per section", async () => {
  const site = publishedSite();
  const models = mockModels(site);
  models.News.find = () => ({ exec: async () => { throw new Error("timeout"); } });
  const s = createContentService({ models, connect: async () => {}, logger: silent });
  const content = await loadHomepageContent(s.public);
  assert.equal(content.news.status, "unavailable");
  assert.equal(content.faqs.status, "ok");
  assert.equal(content.siteSettings.status, "ok");
});

test("errors: the draft scope throws instead of hiding failures", async () => {
  const policy = createDraftAccessPolicy({ authorize: async () => ({ subject: "e", role: "editor" }) });
  const { service: s } = service({ Faq: [] }, { connect: async () => { throw new Error("down"); } });
  await assert.rejects(s.withDraftAccess(await policy.requestGrant({})).faqs(), /down/);
});

test("errors: empty collections give 'empty' with safe empty data", async () => {
  const empty = Object.fromEntries(Object.keys(publishedSite()).map((name) => [name, []]));
  const { service: s } = service(empty);
  const content = await loadHomepageContent(s.public);
  for (const key of ["banners", "sacredItems", "news", "gallery", "faqs"]) {
    assert.equal(content[key].status, "empty", key);
    assert.deepEqual(content[key].data, [], key);
  }
  assert.equal(content.siteSettings.data, null);
  assert.equal(content.historyPage.data, null);
});

test("environment: production never uses a staging database and preview never uses production", () => {
  assert.throws(() => assertDatabaseMatchesEnvironment("sanpudam168_staging", { VERCEL_ENV: "production" }), /non-production/);
  assert.throws(() => assertDatabaseMatchesEnvironment("sanpudam168-test", { VERCEL_ENV: "production" }), /non-production/);
  assert.throws(() => assertDatabaseMatchesEnvironment("sanpudam168_prod", { VERCEL_ENV: "preview" }), /production database/);
  assert.doesNotThrow(() => assertDatabaseMatchesEnvironment("sanpudam168", { VERCEL_ENV: "production" }));
  assert.doesNotThrow(() => assertDatabaseMatchesEnvironment("sanpudam168_staging", { VERCEL_ENV: "preview" }));
  assert.doesNotThrow(() => assertDatabaseMatchesEnvironment("sanpudam168_staging", {}));
});
