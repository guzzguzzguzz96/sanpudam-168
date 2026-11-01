// /news, /news/[slug], and /visit (C2.2): ordering, slugs, labels, public
// isolation, the review-only directions override, and page states.
// Offline: mock models only; MongoDB is never contacted.
//
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../../src/server/cms/content-service.js";
import { createReviewAccessPolicy } from "../../src/server/cms/review-access.js";
import { evaluateReviewMode } from "../../src/lib/review-mode.js";
import { REVIEW_LABELS } from "../../src/server/review/homepage.js";
import { REVIEW_CONFIRMED_OVERRIDES } from "../../src/server/review/overrides.js";
import { createSitePages } from "../../src/server/site/service.js";
import { SECRET_URI, asset, draft, ids, imageRef, mockModels, published } from "./fixtures.mjs";

const silent = { error() {} };
const CONFIRMED_MAPS = "https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7";
const NEWS_SLUGS = ["know-tra-phaendin-siam", "tra-phaendin-ceremony-2569", "monks-blessing-ceremony"];
const placeholder = (path) => ({ path, status: "placeholder", source: "legacy", note: "internal note", flaggedAt: "2026-10-17T10:27:20.515Z" });

function news(build = draft) {
  // Stored out of order; two articles share a date.
  return [
    build({ _id: "n3", title: "พระสงฆ์ประพรมน้ำพระพุทธมนต์", slug: "monks-blessing-ceremony", date: "2026-03-16", excerpt: "บรรยากาศ", coverImage: imageRef(ids.approvedAsset), body: "ย่อหน้า\n\n**ข้อความส่วนนี้เป็นตัวอย่าง** รอยืนยัน", images: [imageRef(ids.approvedAsset, { alt: "พระสงฆ์ให้พร" }), imageRef(ids.missingAsset)], placeholderFields: [placeholder("title"), placeholder("date"), placeholder("body")], createdAt: "2026-10-29T16:32:37.162Z" }),
    build({ _id: "n1", title: "ทำความรู้จักตราแผ่นดินสยาม", slug: "know-tra-phaendin-siam", date: "2026-03-20", excerpt: "ตราประจำประเทศ", coverImage: imageRef(ids.approvedAsset, { alt: "อินโฟกราฟิก" }), body: "**โล่แบ่งเป็น 3 ห้อง** ความหมาย\n\nคาถา", images: [imageRef(ids.approvedAsset)] }),
    build({ _id: "n2", title: "ผบ.ตร. เป็นประธานพิธีบวงสรวง", slug: "tra-phaendin-ceremony-2569", date: "2026-03-16", excerpt: "วันที่ 16 มี.ค. 69", coverImage: imageRef(ids.missingAsset), body: "พิธี", images: [] }),
  ];
}

function settings(build = draft, contact = {}) {
  return [build({
    _id: "s1", key: "default",
    placeholderFields: build === draft ? [placeholder("openingHours.daysText"), placeholder("contactTopics")] : [],
    identity: { name: "ศาลปู่ดำ168 และตราแผ่นดิน", shortName: "ศาลปู่ดำ168", description: "คำอธิบาย" },
    contact: { address: "79 ถนนมหาราช", locationShort: "หลัง สน.พระราชวัง", phoneNumber: "0823686168", lineId: "@sanpudam168", directionsUrl: "https://share.google/4YWFvetEfPrWZB9qz", mapEmbedQuery: "ศาลปู่ดำ", verified: false, ...contact },
    openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
    socialLinks: [{ platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/", verified: false }, { platform: "youtube", url: "https://www.youtube.com/@aslandarachart3393", verified: true }],
    contactTopics: [{ key: "topic-01", sortOrder: 1, label: "สอบถามการเดินทาง" }],
  })];
}
ids.missingAsset = "aaaaaaaaaaaaaaaaaaaaaaa8";

// Mock models ignore filters; sort news like MongoDB (date desc, _id) and
// let findOne honor the lookup key.
function models(data, options) {
  const all = mockModels(data, options);
  const find = all.News.find.bind(all.News);
  all.News.find = (filter, projection, opts) => {
    const query = find(filter, projection, opts);
    return { exec: async () => (await query.exec()).sort((a, b) => b.date.localeCompare(a.date) || a._id.localeCompare(b._id)) };
  };
  for (const [name, model] of Object.entries(all)) {
    const findOne = model.findOne.bind(model);
    model.findOne = (filter, projection, opts) => {
      const query = findOne(filter, projection, opts);
      const key = ["slug", "key"].find((k) => typeof filter?.[k] === "string");
      return {
        exec: async () => {
          await query.exec();
          const match = key ? data[name].find((doc) => String(doc[key]) === filter[key]) : data[name][0];
          return match ? structuredClone(match) : null;
        },
      };
    };
  }
  return all;
}

function setup({ data = { News: news(), SiteSettings: settings(), MediaAsset: [asset(ids.approvedAsset)] }, mode = "review", fail } = {}) {
  const m = models(data, fail ? { fail } : undefined);
  const service = createContentService({ models: m, connect: async () => {}, logger: silent });
  const grant = createReviewAccessPolicy({ evaluate: () => evaluateReviewMode({ CLIENT_REVIEW_LOCAL: "true" }) }).requestGrant();
  const pages = createSitePages({
    review: async () => (mode === "review" ? { status: "ok", repositories: service.withReviewAccess(grant) } : mode === "review-down" ? { status: "unavailable", reason: "connection_failed" } : { status: "disabled" }),
    publicRepositories: () => service.public,
  });
  return { pages, models: m };
}

// --- /news -------------------------------------------------------------------

test("news: all three articles, date descending then _id, linked to their slugs", async () => {
  const { pages, models: m } = setup();
  const result = await pages.news();
  assert.equal(result.status, "ok");
  assert.deepEqual(result.view.map((a) => a.href), NEWS_SLUGS.map((s) => `/news/${s}`));
  assert.deepEqual(m.News.calls[0].options.sort, { date: -1, _id: 1 });
  assert.deepEqual(result.view.map((a) => a.publicationDate), ["20 มีนาคม 2569", "16 มีนาคม 2569", "16 มีนาคม 2569"]);
  assert.equal(result.view[1].image, null, "missing cover media keeps the card");
  assert.deepEqual(result.view[2].reviewStatus.fields, ["หัวข้อ", "วันที่"]);
  assert.equal(result.view[2].reviewStatus.tone, "sample");
  assert.ok(!JSON.stringify(result.view).includes("2026-10-29"), "migration timestamps are never used as dates");
});

test("news: article pages resolve by exact slug; invalid slugs never query", async () => {
  const { pages, models: m } = setup();
  for (const slug of [{ $ne: null }, "../visit", "KNOW-TRA-PHAENDIN-SIAM", "monks blessing", ["know-tra-phaendin-siam"]]) {
    assert.equal((await pages.newsArticle(slug)).status, "not_found", JSON.stringify(slug));
  }
  assert.equal(m.News.calls.length, 0);
  for (const slug of NEWS_SLUGS) {
    const result = await pages.newsArticle(slug);
    assert.equal(result.status, "ok", slug);
    assert.equal(result.view.slug, slug);
  }
  assert.equal(m.News.calls[0].filter.slug, NEWS_SLUGS[0]);
  assert.equal((await pages.newsArticle("not-a-real-article")).status, "not_found");
});

test("news: article view keeps stored fields, per-field labels, and resolvable images only", async () => {
  const { pages } = setup();
  const monks = (await pages.newsArticle("monks-blessing-ceremony")).view;
  assert.equal(monks.publicationDate, "16 มีนาคม 2569");
  assert.equal(monks.status.title.tone, "sample");
  assert.equal(monks.status.date.tone, "sample");
  assert.equal(monks.status.body.tone, "sample");
  assert.equal(monks.status.summary, null);
  assert.deepEqual(monks.images.map((i) => i.alt), ["พระสงฆ์ให้พร"], "an unresolvable article image is dropped, not replaced");
  const know = (await pages.newsArticle("know-tra-phaendin-siam")).view;
  assert.deepEqual(know.body[0], [{ text: "โล่แบ่งเป็น 3 ห้อง", strong: true }, { text: " ความหมาย", strong: false }]);
  assert.deepEqual(know.status, { title: null, date: null, summary: null, body: null });
  for (const key of ["author", "caption", "createdAt", "updatedAt"]) assert.ok(!JSON.stringify(know).includes(key), key);
});

test("news: public mode shows no drafts; database failures are unavailable", async () => {
  const pub = setup({ mode: "disabled" });
  assert.deepEqual(await pub.pages.news(), { scope: "public", status: "empty", view: [] });
  for (const slug of NEWS_SLUGS) assert.equal((await pub.pages.newsArticle(slug)).status, "not_found", slug);

  const published3 = setup({ mode: "disabled", data: { News: news(published), SiteSettings: [], MediaAsset: [asset(ids.approvedAsset)] } });
  assert.deepEqual((await published3.pages.news()).view.map((a) => a.href), ["/news/know-tra-phaendin-siam", "/news/tra-phaendin-ceremony-2569"], "the placeholder article stays hidden");
  assert.equal((await published3.pages.newsArticle("monks-blessing-ceremony")).status, "not_found");

  const down = setup({ mode: "disabled", fail: new Error("down") });
  assert.equal((await down.pages.news()).status, "unavailable");
  assert.equal((await down.pages.newsArticle("know-tra-phaendin-siam")).status, "unavailable");
  const reviewDown = setup({ mode: "review-down" });
  assert.equal((await reviewDown.pages.newsArticle("know-tra-phaendin-siam")).status, "unavailable");
});

// --- /visit ------------------------------------------------------------------

test("visit (review): imported values labeled, confirmed directions from the override only", async () => {
  const { pages } = setup();
  const result = await pages.visit();
  assert.equal(result.scope, "review");
  const view = result.view;
  assert.equal(REVIEW_CONFIRMED_OVERRIDES.directionsUrl, CONFIRMED_MAPS);
  assert.deepEqual(view.directions, { href: CONFIRMED_MAPS, confirmed: true, note: null });
  assert.equal(view.hours.value, "ทุกวัน 08:00 – 20:00 น.");
  assert.match(view.hours.note, /ข้อความตัวอย่าง.*วันเปิดทำการ/);
  assert.equal(view.address.note, REVIEW_LABELS.unverifiedContact);
  assert.deepEqual(view.contacts.map((c) => [c.id, c.value, c.note]), [["phone", "0823686168", REVIEW_LABELS.unverifiedContact], ["line", "@sanpudam168", REVIEW_LABELS.unverifiedContact]]);
  assert.equal(view.social.find((s) => s.id === "social-facebook").note, REVIEW_LABELS.unverifiedContact);
  assert.equal(view.social.find((s) => s.id === "social-youtube").note, null);
  assert.equal(view.verifiedContact, null, "no clickable phone/LINE in review");
  const json = JSON.stringify(view);
  for (const marker of ["share.google", "mapEmbedQuery", "ศาลปู่ดำ\"", "contactTopics", "สอบถามการเดินทาง", "tel:", "line.me"]) assert.ok(!json.includes(marker), marker);
});

test("visit (public): published record only, no review override, verified channels only", async () => {
  // Unverified published settings: no directions, no phone/LINE.
  const unverified = setup({ mode: "disabled", data: { News: [], SiteSettings: settings(published), MediaAsset: [] } });
  const view = (await unverified.pages.visit()).view;
  assert.equal(view.directions, null, "the review-only override never reaches public pages");
  assert.deepEqual(view.contacts, []);
  assert.equal(view.verifiedContact, null);
  assert.deepEqual(view.social.map((s) => s.id), ["social-youtube"], "only verified social links");
  assert.equal(view.hours.note, null);
  assert.equal(view.address.note, null);

  // Verified settings: channels become actions; the share.google link is still rejected.
  const verified = setup({ mode: "disabled", data: { News: [], SiteSettings: settings(published, { verified: true }), MediaAsset: [] } });
  const v = (await verified.pages.visit()).view;
  assert.equal(v.directions, null);
  assert.deepEqual(v.verifiedContact, { phoneNumber: "0823686168", lineInquiryUrl: "https://line.me/R/ti/p/%40sanpudam168" });
  const withMaps = setup({ mode: "disabled", data: { News: [], SiteSettings: settings(published, { verified: true, directionsUrl: "https://maps.app.goo.gl/owner1" }), MediaAsset: [] } });
  assert.deepEqual((await withMaps.pages.visit()).view.directions, { href: "https://maps.app.goo.gl/owner1", confirmed: true, note: null });

  // Draft settings stay hidden publicly: honest empty state, not a 404.
  assert.deepEqual(await setup({ mode: "disabled" }).pages.visit(), { scope: "public", status: "empty", view: null });
  assert.equal((await setup({ mode: "disabled", fail: new Error(`down ${SECRET_URI}`) }).pages.visit()).status, "unavailable");
});

test("dto: news and visit data carry no raw documents or internal fields", async () => {
  const { pages } = setup();
  const views = [await pages.news(), await pages.visit(), ...(await Promise.all(NEWS_SLUGS.map((s) => pages.newsArticle(s))))];
  const json = JSON.stringify(views);
  for (const marker of ["legacy raw", "\"legacy\"", "\"migration\"", "mediaMapping", "assetId", "rights", "placeholderFields", "pending_review", "internal note", "\"_id\"", "flaggedAt", "publicId", "\"review\":{", "\"verified\""]) {
    assert.ok(!json.includes(marker), `${marker} leaked into page data`);
  }
});
