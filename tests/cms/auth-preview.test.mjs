// CMS session verification, draft preview authorization, and the private
// preview layer. Offline: mock models, test-only secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signSessionToken, verifySessionToken, MAX_SESSION_SECONDS } from "../../src/server/auth/session-token.js";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, readAuthConfig } from "../../src/server/auth/config.js";
import { authorizePreviewSession, createPreviewAccessPolicy } from "../../src/server/auth/preview-access.js";
import { getPreviewGrant } from "../../src/server/auth/request-session.js";
import { DraftAccessDeniedError } from "../../src/server/cms/draft-access.js";
import { createContentService } from "../../src/server/cms/content-service.js";
import { loadPreviewSection } from "../../src/server/preview/preview-content.js";
import { describePublicationState } from "../../src/server/preview/publication-state.js";
import { draft, imageRef, ids, pendingReview, published, publishedSite, mockModels } from "./fixtures.mjs";

// Test-only values; not real credentials.
const SECRET = "test-only-secret-0123456789abcdefghijklmnop";
const env = { AUTH_SECRET: SECRET, CMS_PREVIEW_ALLOWED_SUBJECTS: "user-owner-1, user-editor-2" };
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const token = (subject = "user-owner-1", role = "owner", options = {}) => signSessionToken({ subject, role, ...options }, { secret: SECRET, now: options.now ?? NOW });

// Builds a correctly signed token with an arbitrary payload.
function craft(payload, secret = SECRET) {
  const data = `v1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}
const iat = Math.floor(NOW / 1000);

test("session: a signed token verifies and carries only minimal claims", () => {
  const result = verifySessionToken(token(), { secret: SECRET, now: NOW });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.session).sort(), ["expiresAt", "issuedAt", "role", "sessionId", "subject"]);
  assert.equal(result.session.expiresAt - result.session.issuedAt, MAX_SESSION_SECONDS);
});

test("session: forged, tampered, and malformed tokens are rejected", () => {
  const valid = token("user-editor-2", "editor");
  const [version, payload, signature] = valid.split(".");
  const elevated = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), role: "owner", sub: "user-owner-1" })).toString("base64url");
  const cases = {
    tamperedPayload: `${version}.${elevated}.${signature}`,
    wrongSecret: signSessionToken({ subject: "user-owner-1", role: "owner" }, { secret: "another-secret-0123456789abcdefghijkl", now: NOW }),
    noSignature: `${version}.${payload}.`,
    unsignedAlgNone: `${version}.${payload}`,
    otherVersion: `v2.${payload}.${signature}`,
    jwtLike: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLW93bmVyLTEifQ.",
    garbage: "not a token",
    oversized: `v1.${"a".repeat(5000)}.${signature}`,
  };
  for (const [name, value] of Object.entries(cases)) {
    const result = verifySessionToken(value, { secret: SECRET, now: NOW });
    assert.equal(result.ok, false, name);
  }
  assert.equal(verifySessionToken(cases.tamperedPayload, { secret: SECRET, now: NOW }).reason, "bad_signature");
  for (const value of [undefined, null, "", 42, {}]) assert.equal(verifySessionToken(value, { secret: SECRET, now: NOW }).reason, "missing");
  assert.equal(verifySessionToken(craft({ sub: "user-owner-1", role: "owner", sid: "s", iat: "x", exp: iat + 10 }), { secret: SECRET, now: NOW }).reason, "malformed");
  assert.equal(verifySessionToken(craft({ sub: "bad subject!", role: "owner", sid: "s", iat, exp: iat + 10 }), { secret: SECRET, now: NOW }).reason, "malformed");
});

test("session: expired, future, and over-long sessions are rejected", () => {
  const expired = token("user-owner-1", "owner", { ttlSeconds: 60 });
  assert.equal(verifySessionToken(expired, { secret: SECRET, now: NOW + 61_000 }).reason, "expired");
  assert.equal(verifySessionToken(token(), { secret: SECRET, now: NOW + MAX_SESSION_SECONDS * 1000 }).reason, "expired");
  assert.equal(verifySessionToken(craft({ sub: "user-owner-1", role: "owner", sid: "s", iat: iat + 3600, exp: iat + 7200 }), { secret: SECRET, now: NOW }).reason, "not_yet_valid");
  assert.equal(verifySessionToken(craft({ sub: "user-owner-1", role: "owner", sid: "s", iat, exp: iat + 30 * 24 * 3600 }), { secret: SECRET, now: NOW }).reason, "invalid_lifetime");
  assert.throws(() => token("user-owner-1", "owner", { ttlSeconds: MAX_SESSION_SECONDS + 1 }), /lifetime/);
});

test("session: no secret means no sessions", () => {
  assert.equal(verifySessionToken(token(), { secret: null }).reason, "not_configured");
  assert.throws(() => signSessionToken({ subject: "a-b", role: "owner" }, { secret: "" }), /secret/);
  assert.equal(readAuthConfig({}).enabled, false);
  assert.equal(readAuthConfig({ AUTH_SECRET: "short", CMS_PREVIEW_ALLOWED_SUBJECTS: "a" }).enabled, false);
  assert.equal(readAuthConfig({ AUTH_SECRET: SECRET }).enabled, false, "empty allowlist disables preview");
  assert.equal(readAuthConfig(env).enabled, true);
});

test("session: cookie settings are host-only, HttpOnly, Secure, SameSite strict", () => {
  assert.match(SESSION_COOKIE_NAME, /^__Host-/);
  assert.deepEqual({ ...SESSION_COOKIE_OPTIONS }, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: MAX_SESSION_SECONDS });
});

test("authorization: role and explicit allowlist are both required", () => {
  assert.deepEqual(authorizePreviewSession(token(), { env, now: NOW }), { allowed: true, principal: { subject: "user-owner-1", role: "owner" } });
  assert.equal(authorizePreviewSession(token("user-editor-2", "editor"), { env, now: NOW }).allowed, true);
  assert.equal(authorizePreviewSession(token("user-owner-1", "viewer"), { env, now: NOW }).reason, "role_not_allowed");
  assert.equal(authorizePreviewSession(token("someone-else", "owner"), { env, now: NOW }).reason, "subject_not_allowed");
  assert.equal(authorizePreviewSession(null, { env, now: NOW }).reason, "missing");
  assert.equal(authorizePreviewSession(token(), { env: { AUTH_SECRET: SECRET }, now: NOW }).reason, "not_configured");
  assert.equal(authorizePreviewSession(token(), { env: {}, now: NOW }).reason, "not_configured");
});

test("authorization: client-supplied preview flags never grant access", async () => {
  const policy = createPreviewAccessPolicy({ env, now: NOW });
  const forged = [
    {},
    { preview: true, draft: "1", role: "owner", subject: "user-owner-1" },
    { searchParams: { preview: "true", token: token() }, headers: { authorization: `Bearer ${token()}`, "x-preview": "1" } },
    { sessionToken: "v1.forged.signature" },
    { sessionToken: token("user-owner-1", "owner", { now: NOW - (MAX_SESSION_SECONDS + 10) * 1000 }) },
  ];
  for (const request of forged) await assert.rejects(policy.requestGrant(request), DraftAccessDeniedError, JSON.stringify(Object.keys(request)));
  const grant = await policy.requestGrant({ sessionToken: token() });
  assert.deepEqual({ subject: grant.subject, role: grant.role }, { subject: "user-owner-1", role: "owner" });
});

test("request binding: only the session cookie is read; failures return null", async () => {
  const policy = createPreviewAccessPolicy({ env, now: NOW });
  const reads = [];
  const jar = (value) => async (name) => { reads.push(name); return value; };
  assert.equal(await getPreviewGrant({ readCookie: jar(null), policy }), null);
  assert.equal(await getPreviewGrant({ readCookie: jar("v1.bad.sig"), policy }), null);
  assert.equal(await getPreviewGrant({ readCookie: jar(token("user-owner-1", "viewer")), policy }), null);
  const grant = await getPreviewGrant({ readCookie: jar(token()), policy });
  assert.equal(grant.subject, "user-owner-1");
  assert.ok(reads.every((name) => name === SESSION_COOKIE_NAME));
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
  for (const grant of [null, undefined, { subject: "user-owner-1", role: "owner" }]) {
    await assert.rejects(loadPreviewSection("homepage", grant, { service }), DraftAccessDeniedError);
  }
  for (const model of Object.values(models)) assert.equal(model.calls.length, 0);
  await assert.rejects(loadPreviewSection("admin", null, { service }), /Unknown preview section/);
});

test("preview: an authorized grant sees drafts with stage labels and placeholders; public does not", async () => {
  const site = draftSite();
  const before = structuredClone(site);
  const service = createContentService({ models: readOnlyModels(site), connect: async () => {}, logger: { error() {} } });
  const grant = await createPreviewAccessPolicy({ env, now: NOW }).requestGrant({ sessionToken: token() });

  const preview = await loadPreviewSection("homepage", grant, { service });
  assert.equal(preview.isPreview, true);
  assert.deepEqual(preview.robots, { index: false, follow: false });
  assert.deepEqual(preview.viewer, { subject: "user-owner-1", role: "owner" });
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
  const grant = await createPreviewAccessPolicy({ env, now: NOW }).requestGrant({ sessionToken: token("user-editor-2", "editor") });

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
