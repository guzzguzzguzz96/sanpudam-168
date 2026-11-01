// Client Review Mode: environment policy, review grants, the dedicated
// read-only connection, review DTOs, labels, and unavailable states.
// Offline: mock models and a fake Mongoose; MongoDB is never contacted.
//
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { evaluateReviewMode, reviewResponseHeaders } from "../../src/lib/review-mode.js";
import { createContentService } from "../../src/server/cms/content-service.js";
import { createDraftAccessPolicy, DraftAccessDeniedError } from "../../src/server/cms/draft-access.js";
import { assertReviewGrant, createReviewAccessPolicy, ReviewAccessDeniedError } from "../../src/server/cms/review-access.js";
import { readReviewDatabaseConfig } from "../../src/server/review/config.js";
import {
  REVIEW_CONNECTION_OPTIONS,
  ReviewPrivilegeError,
  assertReadOnlyRoles,
  connectReviewDatabase,
  readOnlyModel,
  registerReviewModels,
  resetReviewConnectionCache,
} from "../../src/server/review/connection.js";
import { REVIEW_LABELS, buildReviewHomepage, describeReviewStatus, loadReviewHomepageContent, reviewMapsUrl, reviewSocialLink } from "../../src/server/review/homepage.js";
import { REVIEW_CONFIRMED_OVERRIDES } from "../../src/server/review/overrides.js";
import { loadReviewHomepage } from "../../src/server/review/service.js";
import { SECRET_URI, asset, draft, ids, imageRef, mockModels, published } from "./fixtures.mjs";

const CONFIRMED_MAPS = "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7";
const PREVIEW = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev", CLIENT_REVIEW_ENABLED: "true" };
const LOCAL = { CLIENT_REVIEW_LOCAL: "true" };
const REVIEW_DB = { CLIENT_REVIEW_MONGODB_URI: SECRET_URI, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_staging" };
const silent = { error() {} };
const placeholder = (path) => ({ path, status: "placeholder", source: "legacy", note: "internal note", flaggedAt: "2026-10-17T10:27:20.515Z" });

// Draft records shaped like the migrated staging data (all pending review).
function migratedSite() {
  return {
    SiteSettings: [draft({
      _id: "s1",
      key: "default",
      placeholderFields: [placeholder("openingHours.daysText"), placeholder("contactTopics")],
      identity: { name: "ศาลปู่ดำ168 และตราแผ่นดิน", shortName: "ศาลปู่ดำ168", tagline: "แท็กไลน์ที่นำเข้า", description: "คำอธิบายที่นำเข้า" },
      branding: { logo: imageRef(ids.logoAsset, { alt: "" }) },
      contact: { address: "ที่อยู่ที่นำเข้า", locationShort: "ถนนมหาราช", phoneNumber: "0823686168", lineId: "@sanpudam168", directionsUrl: "https://share.google/4YWFvetEfPrWZB9qz", verified: false },
      openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
      socialLinks: [
        { platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/", verified: false },
        { platform: "youtube", url: "https://evil.example/@x", verified: false },
      ],
    })],
    Banner: [
      draft({ _id: "b1", image: imageRef(ids.approvedAsset, { alt: "โถงสักการะ", caption: "โถง", focalPoint: { x: 0.55, y: 0.5 } }), mobileImage: null, sortOrder: 1 }),
      draft({ _id: "b2", image: imageRef(ids.pendingAsset, { caption: "ซุ้มประตู" }), mobileImage: null, sortOrder: 2 }),
    ],
    SacredItem: [
      draft({ _id: "i1", name: "องค์ปู่ดำ 168", slug: "pu-dam-168", excerpt: "สรุปหนึ่ง", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), sortOrder: 1, placeholderFields: [placeholder("body"), placeholder("offerings")] }),
      draft({ _id: "i2", name: "ตราแผ่นดินสยาม", slug: "tra", excerpt: "สรุปสอง", categoryId: ids.category, primaryImage: imageRef(ids.pendingAsset), sortOrder: 2 }),
      draft({ _id: "i3", name: "หลวงปู่ศิลา", slug: "sila", excerpt: "สรุปตัวอย่าง", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), sortOrder: 3, placeholderFields: [placeholder("excerpt"), placeholder("body")] }),
      draft({ _id: "i4", name: "เหรียญ", slug: "coin", excerpt: "สรุปสี่", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), sortOrder: 4 }),
    ],
    Category: [draft({ _id: ids.category, name: "สถานที่ศักดิ์สิทธิ์", slug: "sacred-place", sortOrder: 1 })],
    News: [
      draft({ _id: "n1", title: "ข่าวหนึ่ง", slug: "n1", date: "2026-03-20", excerpt: "ย่อ", coverImage: imageRef(ids.approvedAsset) }),
      draft({ _id: "n2", title: "ข่าวตัวอย่าง", slug: "n2", date: "2026-03-16", excerpt: "ย่อ", coverImage: imageRef(ids.approvedAsset), placeholderFields: [placeholder("title"), placeholder("date"), placeholder("body")] }),
    ],
    GalleryItem: Array.from({ length: 7 }, (_, i) => draft({ _id: `g${i}`, galleryKey: "shrine-main", image: imageRef(ids.approvedAsset, { caption: `ภาพ ${i}` }), sortOrder: i })),
    Faq: [
      draft({ _id: "f1", question: "อยู่ที่ไหน", answer: "คำตอบ", showOnHome: true, sortOrder: 1 }),
      draft({ _id: "f2", question: "ของไหว้", answer: "คำตอบตัวอย่าง", showOnHome: false, sortOrder: 2, placeholderFields: [placeholder("answer")] }),
    ],
    Page: [draft({
      _id: "p1", key: "history", title: "ประวัติ", intro: "บทนำที่นำเข้า", homeIntroHeading: "ศรัทธาที่อยู่คู่ใจ",
      historyImage: imageRef(ids.approvedAsset, { alt: "องค์ปู่ดำ" }),
      placeholderFields: [placeholder("historyBody"), placeholder("worshipSteps")],
      worshipSteps: [{ key: "step-02", sortOrder: 2, title: "กล่าวคำขอพร", detail: null }, { key: "step-01", sortOrder: 1, title: "ตั้งจิต", detail: "รายละเอียด" }],
    })],
    MediaAsset: [
      asset(ids.approvedAsset),
      asset(ids.pendingAsset, { rights: "pending_owner_confirmation" }),
      { ...asset(ids.logoAsset), width: 192, height: 192 },
    ],
  };
}
ids.logoAsset = "aaaaaaaaaaaaaaaaaaaaaaa9";

const reviewGrant = () => createReviewAccessPolicy({ evaluate: () => evaluateReviewMode(LOCAL) }).requestGrant();
function reviewService(collections = migratedSite(), options) {
  const models = mockModels(collections, options);
  return { models, service: createContentService({ models, connect: async () => {}, logger: silent }) };
}
async function reviewView(collections) {
  const { service } = reviewService(collections);
  return buildReviewHomepage(await loadReviewHomepageContent(service.withReviewAccess(reviewGrant())));
}

// --- Policy -----------------------------------------------------------------

test("policy: disabled by default and for missing environments", () => {
  assert.equal(evaluateReviewMode({}).enabled, false);
  assert.equal(evaluateReviewMode(undefined).enabled, false);
  assert.equal(evaluateReviewMode(null).enabled, false);
  assert.equal(evaluateReviewMode({ CLIENT_REVIEW_ENABLED: "true" }).enabled, false, "the Vercel flag alone does not enable local review");
});

test("policy: production rejects review even when every flag is enabled", () => {
  for (const env of [
    { ...PREVIEW, VERCEL_ENV: "production" },
    { ...PREVIEW, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" },
    { ...PREVIEW, VERCEL_TARGET_ENV: "production" },
    { ...LOCAL, VERCEL_ENV: "production" },
    { ...PREVIEW, ...LOCAL, VERCEL_ENV: "production" },
  ]) {
    assert.deepEqual(evaluateReviewMode(env), { enabled: false, mode: null, reason: "production" });
  }
});

test("policy: Vercel Preview needs the explicit flag and the dev branch", () => {
  assert.deepEqual(evaluateReviewMode(PREVIEW), { enabled: true, mode: "vercel-preview", reason: null });
  assert.equal(evaluateReviewMode({ ...PREVIEW, CLIENT_REVIEW_ENABLED: undefined }).reason, "flag_not_enabled");
  assert.equal(evaluateReviewMode({ ...PREVIEW, VERCEL_GIT_COMMIT_REF: "main" }).reason, "branch_not_allowed");
  assert.equal(evaluateReviewMode({ ...PREVIEW, VERCEL_GIT_COMMIT_REF: "feature/dev" }).reason, "branch_not_allowed");
  assert.equal(evaluateReviewMode({ ...PREVIEW, VERCEL_GIT_COMMIT_REF: undefined }).reason, "branch_not_allowed");
});

test("policy: unexpected or missing environment values deny access", () => {
  const denied = [
    { ...PREVIEW, CLIENT_REVIEW_ENABLED: "TRUE" },
    { ...PREVIEW, CLIENT_REVIEW_ENABLED: "1" },
    { ...PREVIEW, CLIENT_REVIEW_ENABLED: " true" },
    { ...PREVIEW, VERCEL: undefined },
    { ...PREVIEW, VERCEL: "true" },
    { ...PREVIEW, VERCEL_ENV: "development" },
    { ...PREVIEW, VERCEL_ENV: "staging" },
    { ...PREVIEW, VERCEL_ENV: undefined },
    { ...PREVIEW, VERCEL_TARGET_ENV: "staging" },
    { ...PREVIEW, CLIENT_REVIEW_LOCAL: "true" },
    { CLIENT_REVIEW_LOCAL: "yes" },
    { CLIENT_REVIEW_LOCAL: "1" },
    { ...LOCAL, CI: "true" },
    { ...LOCAL, VERCEL_URL: "x.vercel.app" },
    { ...LOCAL, VERCEL_GIT_COMMIT_REF: "dev" },
    { ...LOCAL, NETLIFY: "true" },
    { ...LOCAL, K_SERVICE: "svc" },
  ];
  for (const env of denied) assert.equal(evaluateReviewMode(env).enabled, false, JSON.stringify(env));
});

test("policy: local review needs its own opt-in and works for local production builds", () => {
  assert.deepEqual(evaluateReviewMode(LOCAL), { enabled: true, mode: "local", reason: null });
  assert.equal(evaluateReviewMode({ ...LOCAL, NODE_ENV: "production" }).enabled, true, "next build && next start locally");
  assert.equal(evaluateReviewMode({ CLIENT_REVIEW_ENABLED: "true" }).reason, "local_opt_in_missing");
});

test("policy: query parameters, headers, and cookies cannot enable review", () => {
  // The policy takes only an environment object; request-derived values
  // passed alongside are ignored, and the grant policy ignores arguments.
  const requestLike = { searchParams: { review: "1", preview: "true" }, headers: { "x-client-review": "true", host: "dev.sanpudam168.example" }, cookies: { __prerender_bypass: "x", "client-review": "true" } };
  assert.equal(evaluateReviewMode({ ...requestLike }).enabled, false);
  assert.equal(evaluateReviewMode({ HTTP_X_CLIENT_REVIEW: "true", QUERY_REVIEW: "1" }).enabled, false);
  const policy = createReviewAccessPolicy({ evaluate: () => evaluateReviewMode({}) });
  assert.throws(() => policy.requestGrant(requestLike), ReviewAccessDeniedError);
});

test("policy: review response headers exist only while enabled", () => {
  assert.deepEqual(reviewResponseHeaders(evaluateReviewMode({ ...PREVIEW, VERCEL_ENV: "production" })), []);
  assert.deepEqual(reviewResponseHeaders(evaluateReviewMode({})), []);
  const [rule] = reviewResponseHeaders(evaluateReviewMode(PREVIEW));
  assert.equal(rule.source, "/:path*");
  const headers = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
  assert.equal(headers["X-Robots-Tag"], "noindex, nofollow");
  assert.match(headers["Cache-Control"], /private/);
  assert.match(headers["Cache-Control"], /no-store/);
  assert.doesNotMatch(headers["Cache-Control"], /public|s-maxage/);
});

// --- Grants and scopes ------------------------------------------------------

test("grants: forged, copied, and draft grants cannot open the review scope", () => {
  const { service } = reviewService();
  assert.throws(() => service.withReviewAccess(null), ReviewAccessDeniedError);
  assert.throws(() => service.withReviewAccess({ kind: "client-review", mode: "local", issuedAt: Date.now() }), ReviewAccessDeniedError);
  assert.throws(() => service.withReviewAccess({ ...reviewGrant() }), ReviewAccessDeniedError);
  const draftGrant = createDraftAccessPolicy({ authorize: async () => ({ subject: "u1", role: "editor" }) });
  return draftGrant.requestGrant({}).then((grant) => {
    assert.throws(() => service.withReviewAccess(grant), ReviewAccessDeniedError);
    assert.throws(() => service.withDraftAccess(reviewGrant()), DraftAccessDeniedError, "a review grant is not a draft grant");
    assert.equal(assertReviewGrant(reviewGrant()).kind, "client-review");
  });
});

test("review scope: read-only queries without archived records; public queries unchanged", async () => {
  const { models, service } = reviewService();
  await loadReviewHomepageContent(service.withReviewAccess(reviewGrant()));
  for (const [name, model] of Object.entries(models)) {
    for (const call of model.calls) {
      assert.ok(["find", "findOne"].includes(call.method), `${name} ${call.method}`);
      if (name === "MediaAsset") {
        assert.deepEqual(call.filter["rights.status"], { $ne: "rejected" });
        continue;
      }
      assert.deepEqual(call.filter.status, { $in: ["draft", "published"] }, name);
      assert.equal(call.projection.legacy, 0);
      assert.equal(call.projection.migration, 0);
    }
  }
  // Only the presentation collections are read; reviews, team, and videos
  // are not part of the review data path.
  assert.deepEqual(Object.keys(models).sort(), ["Banner", "Category", "Faq", "GalleryItem", "MediaAsset", "News", "Page", "SacredItem", "SiteSettings"]);

  const publicResult = await reviewService().service.public.faqs();
  assert.equal(publicResult.status, "empty", "draft records stay invisible to the public scope");
});

test("review scope: database errors degrade to unavailable, never throw", async () => {
  const { service } = reviewService(migratedSite(), { fail: new Error(`connect failed ${SECRET_URI}`) });
  const result = await service.withReviewAccess(reviewGrant()).news();
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.data, []);
});

// --- Configuration and connection -------------------------------------------

test("config: review credentials never fall back to MONGODB_URI", () => {
  const config = readReviewDatabaseConfig({ MONGODB_URI: SECRET_URI, MONGODB_DB_NAME: "sanpudam168_staging" });
  assert.equal(config.uri, null);
  assert.ok(config.problems.some((p) => p.includes("CLIENT_REVIEW_MONGODB_URI")));
  assert.equal(readReviewDatabaseConfig({ ...REVIEW_DB, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_production" }).uri, null);
  assert.equal(readReviewDatabaseConfig({ ...REVIEW_DB, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_staging2" }).uri, null);
  assert.equal(readReviewDatabaseConfig({ ...REVIEW_DB, CLIENT_REVIEW_MONGODB_URI: "https://example.com" }).uri, null);
  assert.deepEqual(readReviewDatabaseConfig(REVIEW_DB), { uri: SECRET_URI, dbName: "sanpudam168_staging", dnsServers: null, problems: [] });
});

test("config: optional local DNS resolvers accept IP addresses only", () => {
  assert.deepEqual(readReviewDatabaseConfig({ ...REVIEW_DB, CLIENT_REVIEW_DNS_SERVERS: "8.8.8.8, 1.1.1.1" }).dnsServers, ["8.8.8.8", "1.1.1.1"]);
  for (const value of ["dns.google", "8.8.8.8,", "1.1.1.1,2.2.2.2,3.3.3.3,4.4.4.4,5.5.5.5", "999.1.1.1"]) {
    const config = readReviewDatabaseConfig({ ...REVIEW_DB, CLIENT_REVIEW_DNS_SERVERS: value });
    assert.equal(config.uri, null, value);
    assert.ok(config.problems.some((p) => p.includes("CLIENT_REVIEW_DNS_SERVERS")), value);
  }
});

test("loader: custom DNS resolvers are used for local review only", async () => {
  const seen = [];
  const connect = async (config) => (seen.push(config.dnsServers), { models: mockModels(migratedSite()) });
  const dnsEnv = { ...REVIEW_DB, CLIENT_REVIEW_DNS_SERVERS: "8.8.8.8" };
  await loadReviewHomepage({ env: { ...LOCAL, ...dnsEnv }, connect, logger: silent });
  await loadReviewHomepage({ env: { ...PREVIEW, ...dnsEnv }, connect, logger: silent });
  assert.deepEqual(seen, [["8.8.8.8"], null]);

  resetReviewConnectionCache();
  const applied = [];
  await connectReviewDatabase({ uri: SECRET_URI, dbName: "sanpudam168_staging", dnsServers: ["8.8.8.8"] }, { mongooseInstance: fakeMongoose(), dnsModule: { setServers: (s) => applied.push(s) } });
  assert.deepEqual(applied, [["8.8.8.8"]]);
  resetReviewConnectionCache();
});

test("connection: only read@sanpudam168_staging is accepted", () => {
  assert.doesNotThrow(() => assertReadOnlyRoles({ authInfo: { authenticatedUserRoles: [{ role: "read", db: "sanpudam168_staging" }] } }));
  for (const roles of [
    [],
    [{ role: "atlasAdmin", db: "admin" }],
    [{ role: "readWrite", db: "sanpudam168_staging" }],
    [{ role: "readAnyDatabase", db: "admin" }],
    [{ role: "read", db: "sanpudam168_production" }],
    [{ role: "read", db: "sanpudam168_staging" }, { role: "readWrite", db: "sanpudam168_staging" }],
  ]) {
    assert.throws(() => assertReadOnlyRoles({ authInfo: { authenticatedUserRoles: roles } }), ReviewPrivilegeError, JSON.stringify(roles));
  }
  assert.throws(() => assertReadOnlyRoles(undefined), ReviewPrivilegeError);
});

test("connection: models expose find/findOne only and never auto-create collections or indexes", () => {
  const model = { find: () => "f", findOne: () => "o", updateOne: () => "u", deleteMany: () => "d", create: () => "c" };
  const facade = readOnlyModel(model);
  assert.deepEqual(Object.keys(facade).sort(), ["find", "findOne"]);
  assert.equal(facade.find(), "f");
  assert.ok(Object.isFrozen(facade));

  assert.equal(REVIEW_CONNECTION_OPTIONS.autoCreate, false);
  assert.equal(REVIEW_CONNECTION_OPTIONS.autoIndex, false);
  assert.equal(REVIEW_CONNECTION_OPTIONS.bufferCommands, false);

  // A real, never-opened Mongoose connection: compile the review models.
  const connection = mongoose.createConnection();
  const models = registerReviewModels(connection);
  assert.deepEqual(Object.keys(models).sort(), ["Banner", "Category", "Faq", "GalleryItem", "MediaAsset", "News", "Page", "SacredItem", "SiteSettings"]);
  for (const compiled of Object.values(connection.models)) {
    assert.equal(compiled.schema.options.autoCreate, false, compiled.modelName);
    assert.equal(compiled.schema.options.autoIndex, false, compiled.modelName);
  }
  for (const facadeModel of Object.values(models)) assert.deepEqual(Object.keys(facadeModel).sort(), ["find", "findOne"]);
});

function fakeMongoose({ databaseName = "sanpudam168_staging", roles = [{ role: "read", db: "sanpudam168_staging" }], fail } = {}) {
  const calls = { createConnection: [], commands: [], closed: 0 };
  return {
    calls,
    createConnection(uri, options) {
      calls.createConnection.push({ uri, options });
      const connection = {
        models: {},
        model: (name, schema) => (connection.models[name] = { modelName: name, schema, find() {}, findOne() {}, updateOne() {} }),
        db: { databaseName, command: async (command) => (calls.commands.push(command), { authInfo: { authenticatedUserRoles: roles } }) },
        asPromise: async () => {
          if (fail) throw fail;
          return connection;
        },
        close: async () => void calls.closed++,
      };
      return connection;
    },
  };
}

test("connection: opens a separate staging connection with safe options and verifies privileges", async () => {
  resetReviewConnectionCache();
  const fake = fakeMongoose();
  const { models } = await connectReviewDatabase({ uri: SECRET_URI, dbName: "sanpudam168_staging" }, { mongooseInstance: fake });
  assert.equal(fake.calls.createConnection.length, 1);
  assert.deepEqual(fake.calls.createConnection[0].options, { ...REVIEW_CONNECTION_OPTIONS, dbName: "sanpudam168_staging" });
  assert.deepEqual(fake.calls.commands, [{ connectionStatus: 1 }]);
  assert.deepEqual(Object.keys(models.News), ["find", "findOne"]);
  resetReviewConnectionCache();
});

test("connection: wrong database, extra privileges, or failures are refused and redacted", async () => {
  for (const options of [{ databaseName: "sanpudam168_production" }, { roles: [{ role: "atlasAdmin", db: "admin" }] }, { fail: new Error(`getaddrinfo failed for ${SECRET_URI}`) }]) {
    resetReviewConnectionCache();
    const fake = fakeMongoose(options);
    await assert.rejects(connectReviewDatabase({ uri: SECRET_URI, dbName: "sanpudam168_staging" }, { mongooseInstance: fake }), (error) => {
      assert.ok(!error.message.includes("pa55-w0rd") && !error.message.includes("app-user") && !error.message.includes(SECRET_URI), error.message);
      return true;
    });
    assert.equal(fake.calls.closed, 1, "the connection is closed after a refusal");
  }
  resetReviewConnectionCache();
  await assert.rejects(connectReviewDatabase({ uri: null, dbName: "sanpudam168_staging" }, { mongooseInstance: fakeMongoose() }));
  await assert.rejects(connectReviewDatabase({ uri: SECRET_URI, dbName: "other" }, { mongooseInstance: fakeMongoose() }));
});

// --- Loader -------------------------------------------------------------------

test("loader: disabled policy runs no query and opens no connection", async () => {
  let connected = 0;
  const connect = async () => (connected++, { models: mockModels(migratedSite()) });
  for (const env of [{}, { ...PREVIEW, ...REVIEW_DB, VERCEL_ENV: "production" }, { ...PREVIEW, ...REVIEW_DB, VERCEL_GIT_COMMIT_REF: "main" }]) {
    assert.deepEqual(await loadReviewHomepage({ env, connect, logger: silent }), { status: "disabled" });
  }
  assert.equal(connected, 0);
});

test("loader: missing review credentials are unavailable and never use the admin connection", async () => {
  let connected = 0;
  const logs = [];
  const result = await loadReviewHomepage({
    env: { ...LOCAL, MONGODB_URI: SECRET_URI, MONGODB_DB_NAME: "sanpudam168_staging" },
    connect: async () => (connected++, { models: mockModels(migratedSite()) }),
    logger: { error: (m) => logs.push(m) },
  });
  assert.deepEqual(result, { status: "unavailable", reason: "not_configured" });
  assert.equal(connected, 0);
  assert.ok(logs.every((m) => !m.includes("pa55-w0rd")));
});

test("loader: connection errors produce an honest unavailable state with redacted logs", async () => {
  const logs = [];
  const result = await loadReviewHomepage({ env: { ...LOCAL, ...REVIEW_DB }, connect: async () => { throw new Error(`auth failed ${SECRET_URI}`); }, logger: { error: (m) => logs.push(m) } });
  assert.deepEqual(result, { status: "unavailable", reason: "connection_failed" });
  assert.ok(logs.length === 1 && !logs[0].includes("pa55-w0rd") && !logs[0].includes("cluster9"));
  const failing = await loadReviewHomepage({ env: { ...LOCAL, ...REVIEW_DB }, connect: async () => ({ models: mockModels(migratedSite(), { fail: new Error("down") }) }), logger: silent });
  assert.deepEqual(failing, { status: "unavailable", reason: "query_failed" }, "every section failing is unavailable, not sample content");
});

test("loader: enabled review returns migrated content", async () => {
  const result = await loadReviewHomepage({ env: { ...LOCAL, ...REVIEW_DB }, connect: async () => ({ models: mockModels(migratedSite()) }), logger: silent });
  assert.equal(result.status, "ok");
  assert.equal(result.banner.title, "ศาลปู่ดำ168 และตราแผ่นดิน");
});

// --- DTO and labels -----------------------------------------------------------

test("dto: excludes raw documents and private or internal fields", async () => {
  const view = await reviewView(migratedSite());
  const json = JSON.stringify(view);
  // (The Cloudinary folder "sanpudam168/staging/legacy/" is part of public
  // image URLs, so keys are checked rather than the bare word.)
  for (const marker of ["legacy raw", "\"legacy\"", "\"migration\"", "\"runId\"", "mediaMapping", "assetId", "rights", "placeholderFields", "pending_review", "internal note", "pending_owner_confirmation", "publicId", "deletedAt", "\"_id\"", "flaggedAt", "review\":{"]) {
    assert.ok(!json.includes(marker), `${marker} leaked into the review DTO`);
  }
  assert.ok(!/tel:|line\.me|lin\.ee/.test(json), "contact values are never actions");
  assert.deepEqual(JSON.parse(json), view, "the DTO is plain JSON");
});

test("dto: hero, ordering, limits, and coverage", async () => {
  const view = await reviewView(migratedSite());
  assert.equal(view.banner.desktopImage.alt, "โถงสักการะ");
  assert.equal(view.banner.desktopFocalPoint, "55% 50%");
  assert.equal(view.banner.description, "แท็กไลน์ที่นำเข้า");
  assert.deepEqual(view.featuredItems.items.map((i) => i.name), ["องค์ปู่ดำ 168", "ตราแผ่นดินสยาม", "หลวงปู่ศิลา"]);
  assert.equal(view.featuredItems.items[0].category.label, "สถานที่ศักดิ์สิทธิ์");
  assert.equal(view.featuredItems.items[0].href, null, "no detail routes in this step");
  assert.equal(view.gallery.length, 5);
  assert.equal(view.gallery[0].layout, "home-gallery__item--feature");
  assert.deepEqual(view.faq.map((f) => f.question), ["อยู่ที่ไหน"], "showOnHome is respected");
  assert.deepEqual(view.worshipGuide.steps.map((s) => s.title), ["ตั้งจิต", "กล่าวคำขอพร"]);
  assert.equal(view.worshipGuide.steps[1].description, null, "missing details are not filled in");
  assert.deepEqual(view.coverage, {
    banners: { available: 2, rendered: 1 },
    sacredItems: { available: 4, rendered: 3 },
    news: { available: 2, rendered: 2 },
    gallery: { available: 7, rendered: 5 },
    faqs: { available: 2, rendered: 1 },
    worshipSteps: { available: 2, rendered: 2 },
  });
  assert.deepEqual(view.quickActions.map((a) => a.href), ["#about", "#worship-guide", "#featured-items", CONFIRMED_MAPS]);
  assert.equal(view.quickActions.at(-1).external, true);
});

test("dto: placeholder metadata becomes visible labels next to the content", async () => {
  const view = await reviewView(migratedSite());
  const [item1, , item3] = view.featuredItems.items;
  assert.deepEqual(item1.reviewStatus, { tone: "pending", label: REVIEW_LABELS.pending, fields: ["รายละเอียด", "ของไหว้"] });
  assert.deepEqual(item3.reviewStatus, { tone: "sample", label: REVIEW_LABELS.sample, fields: ["คำอธิบายย่อ"] });
  assert.equal(view.featuredItems.items[1].reviewStatus, null);
  assert.deepEqual(view.news[1].reviewStatus.fields, ["หัวข้อ", "วันที่"]);
  assert.equal(view.news[1].reviewStatus.tone, "sample");
  assert.equal(view.worshipGuide.reviewStatus.tone, "sample");
  assert.equal(view.about.reviewStatus.tone, "pending");
  assert.match(view.quickInformation.find((i) => i.id === "hours").note, /ข้อความตัวอย่าง.*วันเปิดทำการ/);
  assert.equal(describeReviewStatus({ placeholderFields: [{ path: "x", status: "confirmed_correct" }] }, ["x"]), null);
});

test("dto: imported contacts are labeled unverified; invalid links are not used", async () => {
  const view = await reviewView(migratedSite());
  const contact = view.quickInformation.find((i) => i.id === "contact");
  assert.equal(contact.value, "โทร 0823686168 · LINE @sanpudam168");
  assert.equal(contact.note, REVIEW_LABELS.unverifiedContact);
  assert.ok(view.visit.details.every((d) => d.note));
  assert.deepEqual(view.visit.directions, { status: "confirmed", confirmed: true, href: CONFIRMED_MAPS, note: null }, "the owner-confirmed link replaces share.google");
  const footer = Object.fromEntries(view.footer.details.map((d) => [d.id, d]));
  assert.equal(footer.phone.note, REVIEW_LABELS.unverifiedContact);
  assert.equal(footer.line.value, "@sanpudam168");
  assert.equal(footer["social-facebook"].value, "www.facebook.com/share/19YGRfMnnS");
  assert.equal(footer["social-youtube"], undefined, "a social link on an unexpected host is dropped");
  assert.equal(view.brand.logoIsLowResolution, true, "the 192x192 logo is icon-size only");
  assert.equal(view.brand.logo.width, 192);
});

test("dto: maps and social links use exact HTTPS hosts", () => {
  assert.equal(reviewMapsUrl("https://share.google/4YWFvetEfPrWZB9qz"), null);
  assert.equal(reviewMapsUrl("http://maps.app.goo.gl/abc"), null);
  assert.equal(reviewMapsUrl("https://evil.maps.app.goo.gl/abc"), null);
  assert.equal(reviewMapsUrl("https://maps.app.goo.gl.evil.com/abc"), null);
  assert.equal(reviewMapsUrl("https://user:pw@maps.app.goo.gl/abc"), null);
  assert.equal(reviewMapsUrl("https://www.google.com/search?q=x"), null);
  assert.equal(reviewMapsUrl("javascript:alert(1)"), null);
  assert.equal(reviewMapsUrl("https://maps.app.goo.gl/abc123"), "https://maps.app.goo.gl/abc123");
  assert.equal(reviewMapsUrl("https://www.google.com/maps/place/x"), null, "only maps.app.goo.gl is accepted");
  assert.equal(reviewMapsUrl("https://maps.google.com/?q=x"), null);
  assert.equal(reviewMapsUrl("https://goo.gl/maps/abc"), null);
  assert.equal(reviewMapsUrl("https://maps.app.goo.gl/"), null);
  assert.equal(reviewMapsUrl("https://maps.app.goo.gl:8443/abc"), null);
  assert.equal(reviewMapsUrl(CONFIRMED_MAPS), CONFIRMED_MAPS);
  assert.equal(reviewSocialLink({ platform: "tiktok", url: "https://tiktok.com.evil.io/@a" }), null);
  assert.equal(reviewSocialLink({ platform: "unknown", url: "https://www.tiktok.com/@a" }), null);
  assert.equal(reviewSocialLink({ platform: "tiktok", url: "https://www.tiktok.com/@a.190162_" }).value, "www.tiktok.com/@a.190162_");
});

test("dto: missing and failing sections are omitted or marked unavailable, never filled", async () => {
  const empty = await reviewView({ ...Object.fromEntries(Object.keys(migratedSite()).map((k) => [k, []])) });
  assert.equal(empty.status, "ok");
  for (const key of ["banner", "quickInformation", "about", "featuredItems", "worshipGuide", "news", "gallery", "visit", "faq", "brand"]) assert.equal(empty[key], null, key);
  assert.deepEqual(empty.quickActions.map((a) => a.href), [CONFIRMED_MAPS], "the confirmed link does not depend on the database");
  assert.deepEqual(buildReviewHomepage(await loadReviewHomepageContent(reviewService(Object.fromEntries(Object.keys(migratedSite()).map((k) => [k, []]))).service.withReviewAccess(reviewGrant())), { overrides: {} }).quickActions, []);

  const collections = migratedSite();
  const models = mockModels(collections);
  models.News = mockModels({ News: [] }, { fail: new Error("news down") }).News;
  const service = createContentService({ models, connect: async () => {}, logger: silent });
  const partial = buildReviewHomepage(await loadReviewHomepageContent(service.withReviewAccess(reviewGrant())));
  assert.equal(partial.status, "ok");
  assert.equal(partial.sections.news, "unavailable");
  assert.equal(partial.news, null);
  assert.ok(partial.featuredItems.items.length > 0, "other sections still render");

  // Media that is not resolvable is never replaced with another image.
  const noMedia = migratedSite();
  noMedia.MediaAsset = [];
  const view = await reviewView(noMedia);
  assert.equal(view.banner.desktopImage, null);
  assert.equal(view.gallery, null);
  assert.equal(view.featuredItems.items[0].image, null);
});

test("dto: published records keep working in the review scope", async () => {
  const collections = migratedSite();
  collections.Faq = [published({ _id: "fp", question: "เผยแพร่แล้ว", answer: "คำตอบ", showOnHome: true, sortOrder: 1 })];
  const view = await reviewView(collections);
  assert.deepEqual(view.faq.map((f) => f.question), ["เผยแพร่แล้ว"]);
});

test("dto: owner-confirmed directions override", async () => {
  assert.equal(REVIEW_CONFIRMED_OVERRIDES.directionsUrl, CONFIRMED_MAPS, "the exact supplied URL");
  const content = await loadReviewHomepageContent(reviewService().service.withReviewAccess(reviewGrant()));

  const confirmed = buildReviewHomepage(content);
  assert.equal(confirmed.confirmedDirectionsHref, CONFIRMED_MAPS);
  assert.ok(!JSON.stringify(confirmed).includes("share.google"), "the imported link is never passed on");

  // Without an override the imported share.google link stays unusable.
  const none = buildReviewHomepage(content, { overrides: {} });
  assert.deepEqual(none.visit.directions, { status: "invalid", confirmed: false, href: null, note: REVIEW_LABELS.invalidDirections });
  assert.equal(none.confirmedDirectionsHref, null);
  assert.equal(none.quickActions.at(-1).href, "#visit");

  // An invalid override is ignored, never swapped for the imported value.
  for (const directionsUrl of ["https://share.google/abc", "http://maps.app.goo.gl/abc", "https://www.google.com/maps/@13.7,100.5,17z", "javascript:alert(1)"]) {
    const view = buildReviewHomepage(content, { overrides: { directionsUrl } });
    assert.equal(view.confirmedDirectionsHref, null, directionsUrl);
    assert.equal(view.visit.directions.status, "invalid", directionsUrl);
  }

  // A valid imported link (if it existed) is usable but stays labeled.
  const collections = migratedSite();
  collections.SiteSettings[0].contact.directionsUrl = "https://maps.app.goo.gl/importedLink1";
  const imported = buildReviewHomepage(await loadReviewHomepageContent(reviewService(collections).service.withReviewAccess(reviewGrant())), { overrides: {} });
  assert.deepEqual(imported.visit.directions, { status: "imported", confirmed: false, href: "https://maps.app.goo.gl/importedLink1", note: REVIEW_LABELS.unverifiedContact });
  assert.equal(imported.confirmedDirectionsHref, null, "imported links never become header/footer/quick actions");
});

test("boundary: the confirmed link is review-only and never an embed", () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.equal(read("src/config/site.js").includes("maps.app.goo.gl/xTiyZjWJcKTH3sHR7"), false, "the public siteConfig is unchanged");
  for (const p of ["src/server/review/overrides.js", "src/components/home/visit-us.js", "src/app/_review/review-homepage.js", "src/app/_review/review-chrome.js"]) {
    assert.doesNotMatch(read(p), /<iframe|maps\/embed|output=embed/i, p);
  }
});
