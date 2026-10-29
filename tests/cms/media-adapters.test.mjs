// Media resolution and homepage adapter compatibility. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryImageUrl, collectAssetIds, createMediaResolver, focalPointToPosition } from "../../src/server/cms/media.js";
import { adaptContactConfig, composeHomepageData, formatThaiDate, lineUrlFromId } from "../../src/server/cms/adapters.js";
import { createContentService } from "../../src/server/cms/content-service.js";
import { loadHomepageContent } from "../../src/server/cms/homepage.js";
import { homepagePreviewData } from "../../src/data/homepage-preview.js";
import { asset, ids, imageRef, mockModels, publishedSite } from "./fixtures.mjs";

const silent = { error() {} };
async function homepageFrom(collections) {
  const s = createContentService({ models: mockModels(collections), connect: async () => {}, logger: silent });
  return loadHomepageContent(s.public);
}

test("media: resolves Cloudinary URL, dimensions, alt, caption, and focal point", () => {
  const media = createMediaResolver([asset(ids.approvedAsset)]);
  const image = media.resolve(imageRef(ids.approvedAsset, { alt: "โถง", caption: "คำบรรยาย", focalPoint: { x: 0.55, y: 0.5 } }));
  assert.deepEqual(image, {
    src: `https://res.cloudinary.com/demo-cloud/image/upload/v17/sanpudam168/staging/legacy/test/${ids.approvedAsset}.webp`,
    width: 1600,
    height: 1066,
    alt: "โถง",
    caption: "คำบรรยาย",
    focalPoint: "55% 50%",
    publicId: `sanpudam168/staging/legacy/test/${ids.approvedAsset}`,
  });
  assert.equal(media.resolve(imageRef(ids.approvedAsset, { alt: "" })).alt, "ภาพจากคลังสื่อ", "usage alt falls back to the asset default");
});

test("media: missing, unresolved, unapproved, deleted, and video assets resolve to null", () => {
  const assets = [asset(ids.approvedAsset), asset(ids.pendingAsset, { rights: "pending_owner_confirmation" }), asset(ids.videoAsset, { resourceType: "video" }), asset("deleted", { deletedAt: new Date() })];
  const media = createMediaResolver(assets);
  assert.equal(media.resolve(null), null);
  assert.equal(media.resolve(imageRef(null)), null);
  assert.equal(media.resolve(imageRef("not-in-library")), null);
  assert.equal(media.resolve(imageRef(ids.approvedAsset, { status: "missing" })), null);
  assert.equal(media.resolve(imageRef(ids.pendingAsset)), null, "public scope needs approved rights");
  assert.equal(media.resolve(imageRef(ids.videoAsset)), null);
  assert.equal(media.resolve(imageRef("deleted")), null);
  assert.ok(createMediaResolver(assets, { scope: "draft" }).resolve(imageRef(ids.pendingAsset)), "draft scope may preview pending media");
  assert.equal(createMediaResolver([asset("r", { rights: "rejected" })], { scope: "draft" }).resolve(imageRef("r")), null);
});

test("media: references are collected once from nested documents", () => {
  const docs = [{ a: imageRef("1"), list: [imageRef("2"), imageRef("1")], nested: { deep: imageRef(null) } }];
  assert.deepEqual(collectAssetIds(docs).sort(), ["1", "2"]);
});

test("media: focal points and responsive Cloudinary URLs", () => {
  assert.equal(focalPointToPosition({ x: 0, y: 1 }), "0% 100%");
  assert.equal(focalPointToPosition({ x: 1.2, y: 0.5 }), null);
  assert.equal(focalPointToPosition(null), null);
  const a = asset(ids.approvedAsset);
  assert.equal(cloudinaryImageUrl(a), a.cloudinary.secureUrl);
  assert.equal(
    cloudinaryImageUrl(a, { width: 800, crop: "fill", height: 533, gravity: "auto" }),
    `https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,c_fill,w_800,h_533,g_auto/v17/sanpudam168/staging/legacy/test/${ids.approvedAsset}.webp`,
  );
  assert.equal(cloudinaryImageUrl({ cloudinary: { publicId: "x", secureUrl: "https://evil.example/x.webp" } }, { width: 10 }), null);
  assert.equal(cloudinaryImageUrl(null), null);
});

test("adapters: composed data keeps the exact homepage shape", async () => {
  const data = composeHomepageData(await homepageFrom(publishedSite()), homepagePreviewData);
  assert.deepEqual(Object.keys(data).sort(), [...Object.keys(homepagePreviewData), "contactConfig"].sort());
  assert.deepEqual(Object.keys(data.banner).sort(), Object.keys(homepagePreviewData.banner).sort());
  assert.deepEqual(Object.keys(data.about).sort(), Object.keys(homepagePreviewData.about).sort());
  const sameItemKeys = (list, reference) => list.forEach((item) => assert.deepEqual(Object.keys(item).sort(), Object.keys(reference[0]).sort()));
  sameItemKeys(data.featuredItems.items, homepagePreviewData.featuredItems.items);
  sameItemKeys(data.news, homepagePreviewData.news);
  sameItemKeys(data.gallery, homepagePreviewData.gallery);
  sameItemKeys(data.faq, homepagePreviewData.faq);
  sameItemKeys(data.worshipGuide, homepagePreviewData.worshipGuide);
  sameItemKeys(data.quickInformation, homepagePreviewData.quickInformation);
  sameItemKeys(data.visit, homepagePreviewData.visit);
});

test("adapters: published content maps to the expected values", async () => {
  const data = composeHomepageData(await homepageFrom(publishedSite()), homepagePreviewData);
  // Hero: banner b0 has unapproved media, so b1 is used.
  assert.equal(data.banner.title, "ศาลปู่ดำ168 และตราแผ่นดิน");
  assert.equal(data.banner.desktopImage.alt, "โถงสักการะ");
  assert.equal(data.banner.desktopFocalPoint, "55% 50%");
  assert.equal(data.banner.primaryCta, homepagePreviewData.banner.primaryCta, "interface copy unchanged");
  // Sacred items: unpublished category dropped, unapproved image -> null.
  assert.deepEqual(data.featuredItems.items[0].category, { id: "published-category", label: "หมวดที่เผยแพร่" });
  assert.equal(data.featuredItems.items[1].category, null);
  assert.equal(data.featuredItems.items[1].image, null);
  assert.equal(data.featuredItems.items[0].href, null, "no link until the detail route exists");
  assert.equal(data.featuredItems.catalogHref, null);
  // News: Thai date, no link yet.
  assert.equal(data.news[0].publicationDate, "29 ตุลาคม 2569");
  assert.equal(data.news[0].href, null);
  // Gallery: item without approved media skipped; layout pattern kept.
  assert.equal(data.gallery.length, 1);
  assert.equal(data.gallery[0].layout, homepagePreviewData.gallery[0].layout);
  assert.equal(data.gallery[0].label, "คำบรรยาย");
  // About and worship guide from the history page, ordered.
  assert.equal(data.about.title, "ศรัทธาที่อยู่คู่ใจ");
  assert.equal(data.about.imageAlt, "องค์ปู่ดำ");
  assert.deepEqual(data.worshipGuide.map((s) => s.title), ["ขั้นหนึ่ง", "ขั้นสอง"]);
  assert.equal(data.worshipGuide[1].description, null, "missing detail stays null, not invented");
  // Visitor information.
  assert.equal(data.quickInformation.find((i) => i.id === "hours").value, "ทุกวัน 08:00 – 20:00 น.");
  assert.equal(data.visit.find((i) => i.id === "address").value, "ที่อยู่ที่อนุมัติแล้ว");
  assert.ok(data.quickActions.some((a) => a.id === "line" && a.href === "https://line.me/R/ti/p/%40sanpudam168"));
  assert.ok(data.quickActions.some((a) => a.id === "directions" && a.external));
});

test("adapters: routes are linked only when enabled", async () => {
  const routes = { sacredItems: true, sacredItemDetail: true, newsDetail: true };
  const data = composeHomepageData(await homepageFrom(publishedSite()), homepagePreviewData, { routes });
  assert.equal(data.featuredItems.items[0].href, "/sakkara/item-one");
  assert.equal(data.featuredItems.catalogHref, "/sakkara");
  assert.equal(data.news[0].href, "/news/news-one");
});

test("adapters: no content, unavailable, or empty results keep the approved UI unchanged", async () => {
  const { contactConfig, ...withoutContent } = composeHomepageData(null, homepagePreviewData);
  assert.equal(contactConfig, null);
  assert.deepEqual(withoutContent, homepagePreviewData);

  const empty = Object.fromEntries(Object.keys(publishedSite()).map((name) => [name, []]));
  const { contactConfig: c2, ...fromEmpty } = composeHomepageData(await homepageFrom(empty), homepagePreviewData);
  assert.equal(c2, null);
  assert.deepEqual({ ...fromEmpty, banner: { ...fromEmpty.banner } }, homepagePreviewData);
});

test("adapters: missing hero media keeps the placeholder backdrop", async () => {
  const site = publishedSite();
  site.MediaAsset = [];
  const data = composeHomepageData(await homepageFrom(site), homepagePreviewData);
  assert.equal(data.banner.desktopImage, null);
  assert.equal(data.banner.mobileImage, null);
  assert.equal(data.about.image, null);
  assert.deepEqual(data.gallery, homepagePreviewData.gallery);
});

test("adapters: contact details appear only when verified and valid", async () => {
  const site = publishedSite();
  const settings = (contact) => ({ status: "ok", data: { contact }, media: createMediaResolver([]) });
  assert.equal(adaptContactConfig(settings({ ...site.SiteSettings[0].contact, verified: false })), null);
  assert.deepEqual(adaptContactConfig(settings({ lineId: "not a line id!", directionsUrl: "https://share.google/xyz", phoneNumber: "12", verified: true })), {
    lineInquiryUrl: null,
    directionsUrl: null,
    phoneNumber: null,
  });

  site.SiteSettings[0].contact.verified = false;
  const data = composeHomepageData(await homepageFrom(site), homepagePreviewData);
  assert.equal(data.contactConfig, null);
  assert.deepEqual(data.quickActions, homepagePreviewData.quickActions);
  assert.equal(data.quickInformation.find((i) => i.id === "contact").value, homepagePreviewData.quickInformation.find((i) => i.id === "contact").value);
});

test("adapters: helpers", () => {
  assert.equal(formatThaiDate("2026-01-05"), "5 มกราคม 2569");
  assert.equal(formatThaiDate("05/01/2026"), null);
  assert.equal(formatThaiDate(null), null);
  assert.equal(lineUrlFromId("sanpudam168"), "https://line.me/R/ti/p/%40sanpudam168");
  assert.equal(lineUrlFromId("https://lin.ee/abc"), "https://lin.ee/abc");
  assert.equal(lineUrlFromId("https://evil.example/@x"), null);
  assert.equal(lineUrlFromId(""), null);
});

test("adapters: output contains no internal or unreviewed fields", async () => {
  const json = JSON.stringify(composeHomepageData(await homepageFrom(publishedSite()), homepagePreviewData));
  for (const field of ["legacy", "migration", "placeholderFields", "review", "rights", "legacy raw", "mediaMapping", "assetId"]) {
    assert.ok(!json.includes(`"${field}"`) && !json.includes(field === "legacy raw" ? field : `"${field}":`), `${field} leaked`);
  }
});
