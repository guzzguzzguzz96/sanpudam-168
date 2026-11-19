// Public site view data (launch): published content only, no review labels,
// verified contact actions only, the public media rule, and the launch
// policy. Offline: mock models only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../../src/server/cms/content-service.js";
import { createReviewAccessPolicy } from "../../src/server/cms/review-access.js";
import { evaluateReviewMode } from "../../src/lib/review-mode.js";
import { REVIEW_LABELS, buildHomepage, buildReviewHomepage, buildSiteChrome, loadHomepageSections, reviewSocialLink } from "../../src/server/review/homepage.js";
import { buildNewsListPage, buildVisitPage, publicMapEmbedUrl } from "../../src/server/site/pages.js";
import { OWNER_CONFIRMED_MAP_EMBED_URL, isAllowedMapEmbedUrl } from "../../src/config/map-embed.js";
import { evaluateSiteLaunch, readSiteUrl, robotsFor } from "../../src/lib/site-launch.js";
import { cleanSocialUrl } from "../../src/lib/social-links.js";
import { activeCategory } from "../../src/lib/sacred-items.js";
import { asset, draft, ids, imageRef, mockModels, published, publishedSite } from "./fixtures.mjs";

const silent = { error() {} };
const publicRepos = (site) => createContentService({ models: mockModels(site), connect: async () => {}, logger: silent }).public;
const reviewGrant = () => createReviewAccessPolicy({ evaluate: () => evaluateReviewMode({ CLIENT_REVIEW_LOCAL: "true" }) }).requestGrant();
const reviewRepos = (site) => createContentService({ models: mockModels(site), connect: async () => {}, logger: silent }).withReviewAccess(reviewGrant());

const SOCIAL = [
  { platform: "facebook", url: "https://www.facebook.com/share/19YGRfMnnS/?mibextid=wwXIfr", verified: true },
  { platform: "tiktok", url: "https://www.tiktok.com/@a.190162_?_t=abc&lang=th", verified: true },
  { platform: "youtube", url: "https://www.youtube.com/@channel", verified: false },
];

function launchSite() {
  const site = publishedSite();
  site.SiteSettings[0].socialLinks = SOCIAL;
  site.SiteSettings[0].contact.mapEmbedQuery = "ศาลปู่ดำ ถนนมหาราช";
  return site;
}

async function publicHome(site = launchSite()) {
  return buildHomepage(await loadHomepageSections(publicRepos(site)), { scope: "public" });
}

test("public homepage: published content with no review labels, notes, or overrides", async () => {
  const view = await publicHome();
  assert.equal(view.status, "ok");
  const json = JSON.stringify(view);
  for (const label of Object.values(REVIEW_LABELS)) assert.ok(!json.includes(label), `review label leaked: ${label}`);
  assert.ok(!json.includes('"tone"'), "no review status objects");
  assert.equal(view.footer.note, null);
  for (const detail of view.quickInformation) assert.equal(detail.note, null);
  // Owner overrides are review-only: passing one changes nothing.
  const withOverride = buildHomepage(await loadHomepageSections(publicRepos(launchSite())), { scope: "public", overrides: { directionsUrl: "https://maps.app.goo.gl/override1" } });
  assert.equal(withOverride.confirmedDirectionsHref, "https://maps.app.goo.gl/abc123");
});

test("public homepage: drafts never appear", async () => {
  const site = launchSite();
  site.Faq = [draft({ _id: "f9", question: "ร่าง?", answer: "ร่าง", showOnHome: true, sortOrder: 1 })];
  site.News = [draft({ _id: "n9", title: "ข่าวร่าง", slug: "draft-news", date: "2026-01-01", excerpt: "ร่าง", coverImage: imageRef(ids.approvedAsset) })];
  const view = await publicHome(site);
  assert.equal(view.faq, null);
  assert.equal(view.news, null);
  assert.ok(!JSON.stringify(view).includes("ร่าง"));
});

test("public contact: actions only for verified, valid values", async () => {
  const view = await publicHome();
  assert.deepEqual(view.contactConfig, { phoneNumber: "082-368-6168", lineInquiryUrl: "https://line.me/R/ti/p/%40sanpudam168", directionsUrl: "https://maps.app.goo.gl/abc123" });
  assert.ok(view.quickActions.some((a) => a.id === "directions" && a.href === "https://maps.app.goo.gl/abc123"));

  const unverified = launchSite();
  unverified.SiteSettings[0].contact.verified = false;
  const hidden = await publicHome(unverified);
  assert.equal(hidden.contactConfig, null);
  assert.equal(hidden.visit.directions, null);
  assert.equal(hidden.confirmedDirectionsHref, null);
  assert.ok(!JSON.stringify(hidden).includes("082-368-6168"), "unverified phone is not shown");
  assert.ok(!JSON.stringify(hidden).includes("@sanpudam168"), "unverified LINE is not shown");
  assert.ok(hidden.quickInformation.some((d) => d.id === "location"), "the address still shows");
});

test("public Maps: only the stored link, only when it passes validation (no fallback)", async () => {
  const site = launchSite();
  site.SiteSettings[0].contact.directionsUrl = "https://share.google/4YWFvetEfPrWZB9qz";
  const view = await publicHome(site);
  assert.equal(view.visit.directions, null);
  assert.equal(view.contactConfig.directionsUrl, null);
  assert.ok(!view.quickActions.some((a) => a.external));
  const chrome = buildSiteChrome(await publicRepos(site).siteSettings(), { scope: "public" });
  assert.equal(chrome.confirmedDirectionsHref, null);
  assert.equal(chrome.contactConfig.directionsUrl, null);
});

test("public social: verified links only, tracking parameters removed", async () => {
  const view = await publicHome();
  assert.equal(view.footer.details.find((d) => d.id === "social").value, "Facebook · TikTok");
  const visit = buildVisitPage(await publicRepos(launchSite()).siteSettings(), { scope: "public" });
  assert.deepEqual(visit.social.map((s) => [s.id, s.href]), [
    ["social-facebook", "https://www.facebook.com/share/19YGRfMnnS/"],
    ["social-tiktok", "https://www.tiktok.com/@a.190162_?lang=th"],
  ]);
  // Review keeps every valid link as text, labeled, never clickable.
  const reviewVisit = buildVisitPage(await reviewRepos(launchSite()).siteSettings(), { scope: "review" });
  assert.equal(reviewVisit.social.length, 3);
  assert.ok(reviewVisit.social.every((s) => !("href" in s)));
  assert.equal(cleanSocialUrl(new URL("https://www.youtube.com/@c?si=x&utm_source=y#t")), "https://www.youtube.com/@c");
  assert.equal(reviewSocialLink(SOCIAL[0]).href, "https://www.facebook.com/share/19YGRfMnnS/");
});

test("public chrome: brand and verified actions from the site settings", async () => {
  const chrome = buildSiteChrome(await publicRepos(launchSite()).siteSettings(), { scope: "public" });
  assert.equal(chrome.status, "ok");
  assert.equal(chrome.brand.name, "ศาลปู่ดำ168 และตราแผ่นดิน");
  assert.equal(chrome.footer.note, null);
  assert.equal(chrome.contactConfig.lineInquiryUrl, "https://line.me/R/ti/p/%40sanpudam168");
  assert.deepEqual(buildSiteChrome({ status: "unavailable" }, { scope: "public" }), { status: "unavailable" });
  // Review chrome keeps its shape (no contactConfig).
  const review = buildSiteChrome(await reviewRepos(launchSite()).siteSettings());
  assert.ok(!("contactConfig" in review));
});

test("public media: images that fail the rule are hidden; the gallery takes the next one", async () => {
  const site = launchSite();
  site.MediaAsset.push(asset("people1", { people: true }), asset("people2", { people: true, consent: "obtained" }), asset("unsigned", { approval: "pending" }));
  site.GalleryItem = [
    published({ _id: "g1", galleryKey: "shrine-main", image: imageRef("people1"), sortOrder: 1 }),
    published({ _id: "g2", galleryKey: "shrine-main", image: imageRef("unsigned"), sortOrder: 2 }),
    published({ _id: "g3", galleryKey: "shrine-main", image: imageRef("people2", { caption: "มีความยินยอม" }), sortOrder: 3 }),
    published({ _id: "g4", galleryKey: "shrine-main", image: imageRef(ids.approvedAsset, { caption: "ภาพสถานที่" }), sortOrder: 4 }),
  ];
  site.News = [published({ _id: "n1", title: "ข่าว", slug: "news-one", date: "2026-10-29", excerpt: "ย่อ", coverImage: imageRef("people1") })];
  const view = await publicHome(site);
  assert.deepEqual(view.gallery.map((g) => g.id), ["g3", "g4"]);
  assert.equal(view.gallery[0].layout, "home-gallery__item--feature", "the first eligible image takes the feature tile");
  assert.equal(view.news.length, 1, "the article still shows");
  assert.equal(view.news[0].image, null, "without its unapproved cover");
  const list = buildNewsListPage(await publicRepos(site).news({ limit: 10 }));
  assert.equal(list[0].image, null);
  // Review scope still previews the same media.
  const review = buildReviewHomepage(await loadHomepageSections(reviewRepos(site)));
  assert.equal(review.gallery.length, 4);
  assert.ok(review.news[0].image);
});

// The owner-confirmed embed, verbatim (supplied 2026-11-19).
const CONFIRMED_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.5880934293764!2d100.49462369999999!3d13.743370099999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e299dcfc86f94b%3A0xdd43e1f925c44216!2z4Lio4Liy4Lil4Lib4Li54LmI4LiU4LizMTY4LeC4leC4o-C4suC5geC4nOC5iOC4meC4lOC4tOC4mQ!5e0!3m2!1sen!2sth!4v1795100442717!5m2!1sen!2sth";

test("map embed: the owner-confirmed URL is stored verbatim and allowed", () => {
  assert.equal(OWNER_CONFIRMED_MAP_EMBED_URL, CONFIRMED_EMBED);
  assert.equal(isAllowedMapEmbedUrl(CONFIRMED_EMBED), true);
  assert.equal(publicMapEmbedUrl(), CONFIRMED_EMBED);
});

test("map embed: only https://www.google.com/maps/embed with a pb parameter", () => {
  for (const bad of [
    CONFIRMED_EMBED.replace("https:", "http:"),
    CONFIRMED_EMBED.replace("www.google.com", "maps.google.com"),
    CONFIRMED_EMBED.replace("www.google.com", "www.google.com.evil.example"),
    CONFIRMED_EMBED.replace("www.google.com", "evil.example"),
    CONFIRMED_EMBED.replace("www.google.com", "www.google.com:8443"),
    CONFIRMED_EMBED.replace("https://", "https://user:pass@"),
    "https://www.google.com/maps?q=%E0%B8%A8%E0%B8%B2%E0%B8%A5&output=embed",
    "https://www.google.com/maps/embed",
    "https://www.google.com/maps/embed?pb=",
    "https://www.google.com/maps/embed/v1/place?q=x",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isAllowedMapEmbedUrl(bad), false, String(bad));
  }
  assert.equal(publicMapEmbedUrl("https://www.google.com/maps?q=x&output=embed"), null);
});

test("public /visit: the confirmed embed only for a verified contact block; never in review", async () => {
  const visit = buildVisitPage(await publicRepos(launchSite()).siteSettings(), { scope: "public" });
  assert.equal(visit.mapEmbedUrl, CONFIRMED_EMBED);
  assert.ok(visit.directions?.href, "the directions button stays");
  const unverified = launchSite();
  unverified.SiteSettings[0].contact.verified = false;
  assert.equal(buildVisitPage(await publicRepos(unverified).siteSettings(), { scope: "public" }).mapEmbedUrl, null);
  assert.equal(buildVisitPage(await reviewRepos(launchSite()).siteSettings(), { scope: "review" }).mapEmbedUrl, null);
});

test("public homepage: the confirmed embed in the visit section; review keeps the placeholder", async () => {
  const view = await publicHome();
  assert.equal(view.visit.mapEmbedUrl, CONFIRMED_EMBED);
  assert.equal(view.visit.directions.href, "https://maps.app.goo.gl/abc123", "directions unchanged");
  const unverified = launchSite();
  unverified.SiteSettings[0].contact.verified = false;
  const hidden = await publicHome(unverified);
  assert.equal(hidden.visit.mapEmbedUrl, null);
  const review = buildReviewHomepage(await loadHomepageSections(reviewRepos(launchSite())));
  assert.ok(!("mapEmbedUrl" in review.visit), "review visit shape is unchanged (placeholder box)");
  assert.ok(!JSON.stringify(review).includes("google.com/maps/embed"));
});

test("/sakkara ?cat=: only a well-formed slug of a listed category filters", () => {
  const categories = [{ id: "sacred-place", label: "สถานที่ศักดิ์สิทธิ์" }, { id: "saimu", label: "สายมู" }];
  assert.equal(activeCategory("saimu", categories), "saimu");
  assert.equal(activeCategory("check-in", categories), null, "unknown category shows all");
  for (const bad of [null, "", "SAIMU", "saimu;drop", "../x", { $ne: 1 }, "a".repeat(101)]) assert.equal(activeCategory(bad, categories), null);
});

test("launch policy: indexable only on Vercel Production with SITE_LAUNCHED=true", () => {
  assert.equal(evaluateSiteLaunch({ VERCEL_ENV: "production", SITE_LAUNCHED: "true" }).indexable, true);
  for (const env of [{}, { VERCEL_ENV: "production" }, { VERCEL_ENV: "production", SITE_LAUNCHED: "TRUE" }, { VERCEL_ENV: "preview", SITE_LAUNCHED: "true" }, { SITE_LAUNCHED: "true" }, null]) {
    assert.equal(evaluateSiteLaunch(env).indexable, false, JSON.stringify(env));
  }
  assert.deepEqual(robotsFor(evaluateSiteLaunch({})), { index: false, follow: false });
  assert.deepEqual(robotsFor(evaluateSiteLaunch({ VERCEL_ENV: "production", SITE_LAUNCHED: "true" })), { index: true, follow: true });
  assert.equal(readSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://sanpudam168.com" }).href, "https://sanpudam168.com/");
  assert.equal(readSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).href, "http://localhost:3000/");
  for (const value of ["http://sanpudam168.com", "https://sanpudam168.com/th", "https://u:p@sanpudam168.com", "not a url", ""]) assert.equal(readSiteUrl({ NEXT_PUBLIC_SITE_URL: value }), null, value);
});
