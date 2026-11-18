// Draft preview authorization on top of admin sign-in, and the private
// preview layer. Offline: mock models, test-only configuration, injected
// sessions (no Google request).
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAdminAccess } from "../../src/server/auth/admin-access.js";
import { authorizePreviewPrincipal, createPreviewAccessPolicy } from "../../src/server/auth/preview-access.js";
import { getPreviewGrant } from "../../src/server/auth/request-session.js";
import { DraftAccessDeniedError } from "../../src/server/cms/draft-access.js";
import { createContentService } from "../../src/server/cms/content-service.js";
import { loadPreviewSection } from "../../src/server/preview/preview-content.js";
import { describePublicationState } from "../../src/server/preview/publication-state.js";
import { draft, imageRef, ids, pendingReview, published, publishedSite, mockModels } from "./fixtures.mjs";

// Test-only values; not real credentials or accounts.
const env = {
  AUTH_SECRET: "test-only-secret-0123456789abcdefghijklmnop",
  AUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "test-client-id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-client-secret",
  ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:owner,editor@example.test:editor",
};
const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const sessionFor = (email, subject = "1000001") => ({
  user: { name: "Test", email },
  identity: { provider: "google", subject, email, authTime: Math.floor(NOW / 1000) - 60 },
});
async function principalFor(email) {
  const access = await getAdminAccess({ env, readSession: async () => sessionFor(email), now: NOW, waitForRequest: async () => {} });
  assert.equal(access.status, "ok");
  return access.principal;
}

test("preview authorization: only issued admin principals with a preview role", async () => {
  const owner = await principalFor("owner@example.test");
  assert.deepEqual(authorizePreviewPrincipal(owner), { allowed: true, principal: { subject: "1000001", role: "owner" } });
  assert.equal(authorizePreviewPrincipal(await principalFor("editor@example.test")).allowed, true);
  // Same shape, not issued by getAdminAccess(): refused.
  assert.equal(authorizePreviewPrincipal({ ...owner }).reason, "not_signed_in");
  assert.equal(authorizePreviewPrincipal({ subject: "1000001", email: "owner@example.test", role: "owner" }).reason, "not_signed_in");
  assert.equal(authorizePreviewPrincipal(null).reason, "not_signed_in");
});

test("preview authorization: request data and review flags never grant access", async () => {
  const policy = createPreviewAccessPolicy();
  const forged = [
    {},
    { preview: true, draft: "1", role: "owner", subject: "1000001" },
    { principal: { subject: "1000001", role: "owner" } },
    { searchParams: { preview: "true" }, headers: { authorization: "Bearer x", "x-preview": "1" }, sessionToken: "v1.legacy.token" },
    { CLIENT_REVIEW_ENABLED: "true", CLIENT_REVIEW_LOCAL: "true" },
  ];
  for (const request of forged) await assert.rejects(policy.requestGrant(request), DraftAccessDeniedError, JSON.stringify(Object.keys(request)));
  const grant = await policy.requestGrant({ principal: await principalFor("owner@example.test") });
  assert.deepEqual({ subject: grant.subject, role: grant.role }, { subject: "1000001", role: "owner" });
});

test("request binding: a grant only for an ok admin access result", async () => {
  for (const status of ["unavailable", "unauthenticated", "forbidden"]) {
    assert.equal(await getPreviewGrant({ getAccess: async () => ({ status, principal: null }) }), null, status);
  }
  // A fabricated "ok" result with an unissued principal is still refused.
  assert.equal(await getPreviewGrant({ getAccess: async () => ({ status: "ok", principal: { subject: "1000001", role: "owner" } }) }), null);
  const principal = await principalFor("editor@example.test");
  const grant = await getPreviewGrant({ getAccess: async () => ({ status: "ok", principal }) });
  assert.equal(grant.role, "editor");
});

// Mock models that throw on anything except find/findOne: proves preview is read-only.
function readOnlyModels(collections) {
  const models = mockModels(collections);
  return Object.fromEntries(Object.entries(models).map(([name, model]) => [name, new Proxy(model, {
    get(target, prop) {
      if (["find", "findOne", "calls"].includes(prop)) return target[prop];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      throw new Error(`write or unexpected model access: ${name}.${String(prop)}`);
    },
  })]));
}

function draftSite() {
  const site = publishedSite();
  site.SiteSettings[0] = { ...pendingReview(site.SiteSettings[0]), status: "draft", placeholderFields: [{ path: "openingHours.daysText", status: "placeholder", note: null }] };
  site.Faq = [draft({ _id: "f-draft", question: "ร่าง?", answer: "คำตอบร่าง", showOnHome: true, sortOrder: 1 })];
  site.Page[0] = { ...site.Page[0], status: "draft", review: { status: "approved" }, placeholderFields: [{ path: "historyBody", status: "placeholder" }] };
  return site;
}

test("preview: denied grants stop before any query", async () => {
  const models = readOnlyModels(draftSite());
  const service = createContentService({ models, connect: async () => {}, logger: { error() {} } });
  for (const grant of [null, undefined, { subject: "1000001", role: "owner" }]) {
    await assert.rejects(loadPreviewSection("homepage", grant, { service }), DraftAccessDeniedError);
  }
  for (const model of Object.values(models)) assert.equal(model.calls.length, 0);
  await assert.rejects(loadPreviewSection("admin", null, { service }), /Unknown preview section/);
});

test("preview: an authorized grant sees drafts with stage labels and placeholders; public does not", async () => {
  const site = draftSite();
  const before = structuredClone(site);
  const service = createContentService({ models: readOnlyModels(site), connect: async () => {}, logger: { error() {} } });
  const grant = await createPreviewAccessPolicy().requestGrant({ principal: await principalFor("owner@example.test") });

  const preview = await loadPreviewSection("homepage", grant, { service });
  assert.equal(preview.isPreview, true);
  assert.deepEqual(preview.robots, { index: false, follow: false });
  assert.deepEqual(preview.viewer, { subject: "1000001", role: "owner" });
  assert.equal(preview.view.faq[0].question, "ร่าง?");
  assert.equal(preview.view.featuredItems.items[0].href, "/sakkara/item-one");
  const settings = preview.records.find((r) => r.collection === "site_settings");
  assert.equal(settings.stage, "pending_review");
  assert.equal(settings.label, "รอตรวจทาน");
  assert.deepEqual(settings.openPlaceholders, [{ path: "openingHours.daysText", note: null }]);
  assert.equal(settings.publiclyVisible, false);
  const page = preview.records.find((r) => r.collection === "pages");
  assert.equal(page.stage, "approved");
  assert.equal(preview.summary.openPlaceholders, 2);

  // The same data in the public scope: drafts stay hidden.
  const publicFaqs = await service.public.faqs({ homeOnly: true });
  assert.equal(publicFaqs.status, "empty");
  assert.equal((await service.public.siteSettings()).data, null);

  // Preview never changes records.
  assert.deepEqual(site, before);
});

test("preview: sacred items, news, history, and gallery sections", async () => {
  const site = draftSite();
  site.Page[0].coatOfArms = { heading: "ตราแผ่นดิน", body: "เนื้อหา", image: imageRef(ids.approvedAsset), parts: [{ key: "p2", sortOrder: 2, part: "ข", meaning: "ความหมาย ข" }, { key: "p1", sortOrder: 1, part: "ก", meaning: "ความหมาย ก" }] };
  const service = createContentService({ models: readOnlyModels(site), connect: async () => {}, logger: { error() {} } });
  const grant = await createPreviewAccessPolicy().requestGrant({ principal: await principalFor("editor@example.test") });

  const items = await loadPreviewSection("sacred-items", grant, { service });
  assert.equal(items.view.length, 2);
  assert.ok(items.records.some((r) => r.collection === "categories"));
  const news = await loadPreviewSection("news", grant, { service });
  assert.equal(news.view[0].href, "/news/news-one");
  const history = await loadPreviewSection("history", grant, { service });
  assert.equal(history.view.historyImage.alt, "องค์ปู่ดำ");
  assert.deepEqual(history.view.coatOfArms.parts.map((p) => p.part), ["ก", "ข"]);
  assert.deepEqual(history.records[0].openPlaceholders.map((p) => p.path), ["historyBody"]);
  const json = JSON.stringify(history);
  for (const field of ["legacy", "migration", "assetId", "mediaMapping"]) assert.ok(!json.includes(`"${field}"`), `${field} leaked`);
  const gallery = await loadPreviewSection("gallery", grant, { service });
  // Draft scope may show media whose rights are still pending; public may not.
  assert.equal(gallery.view.length, 2);
  const publicGallery = await service.public.gallery();
  assert.equal(publicGallery.media.resolve(publicGallery.data.find((d) => d._id === "g2").image), null);
});

test("publication state: draft, pending review, approved, and published are distinct", () => {
  assert.equal(describePublicationState(draft({ review: { status: "changes_requested" } })).stage, "draft");
  assert.equal(describePublicationState(draft({})).stage, "pending_review");
  assert.equal(describePublicationState({ ...draft({}), review: { status: "approved" } }).stage, "approved");
  const live = describePublicationState(published({}));
  assert.equal(live.stage, "published");
  assert.equal(live.publiclyVisible, true);
  const blocked = describePublicationState({ ...published({}), placeholderFields: [{ path: "x", status: "placeholder" }] });
  assert.equal(blocked.stage, "published");
  assert.equal(blocked.publiclyVisible, false, "published but blocked by an open placeholder");
});
