// Media resolution, the public media rule, and formatting helpers. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryImageUrl, collectAssetIds, createMediaResolver, focalPointToPosition } from "../../src/server/cms/media.js";
import { formatThaiDate, lineUrlFromId } from "../../src/server/cms/adapters.js";
import { isMediaDraftUsable, isMediaPubliclyUsable, publicMediaFilter } from "../../src/server/cms/policy.js";
import { asset, ids, imageRef } from "./fixtures.mjs";

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


test("media: public use needs approved rights, approved file, and consent for identifiable people", () => {
  assert.equal(isMediaPubliclyUsable(asset("a")), true);
  assert.equal(isMediaPubliclyUsable(asset("a", { approval: "pending" })), false, "rights alone are not enough");
  assert.equal(isMediaPubliclyUsable(asset("a", { rights: "pending_owner_confirmation", approval: "approved" })), false);
  assert.equal(isMediaPubliclyUsable(asset("a", { people: true })), false, "people without consent");
  assert.equal(isMediaPubliclyUsable(asset("a", { people: true, consent: "refused" })), false);
  assert.equal(isMediaPubliclyUsable(asset("a", { people: true, consent: "obtained" })), true);
  assert.equal(isMediaPubliclyUsable(asset("a", { deletedAt: new Date() })), false);
  assert.equal(isMediaPubliclyUsable(null), false);
  // Draft/review scope is unchanged: pending approval and consent still preview.
  assert.equal(isMediaDraftUsable(asset("a", { approval: "pending", people: true })), true);
});

test("media: the public query carries the same rule as the per-asset check", () => {
  assert.deepEqual(publicMediaFilter(["1"]), {
    _id: { $in: ["1"] },
    "rights.status": "approved",
    "approval.status": "approved",
    $or: [{ "rights.containsIdentifiablePeople": { $ne: true } }, { "rights.consent.status": "obtained" }],
    deletedAt: null,
  });
  // A query that ignores the filter still cannot leak: the resolver re-checks.
  const media = createMediaResolver([asset("ok"), asset("people", { people: true }), asset("unsigned", { approval: "pending" })]);
  assert.ok(media.resolve(imageRef("ok")));
  assert.equal(media.resolve(imageRef("people")), null);
  assert.equal(media.resolve(imageRef("unsigned")), null);
  assert.ok(createMediaResolver([asset("people", { people: true })], { scope: "review" }).resolve(imageRef("people")), "review scope unchanged");
});

test("helpers: Thai dates and LINE links", () => {
  assert.equal(formatThaiDate("2026-01-05"), "5 มกราคม 2569");
  assert.equal(formatThaiDate("05/01/2026"), null);
  assert.equal(formatThaiDate(null), null);
  assert.equal(lineUrlFromId("sanpudam168"), "https://line.me/R/ti/p/%40sanpudam168");
  assert.equal(lineUrlFromId("https://lin.ee/abc"), "https://lin.ee/abc");
  assert.equal(lineUrlFromId("https://evil.example/@x"), null);
  assert.equal(lineUrlFromId(""), null);
});
