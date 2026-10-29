// Offline fixtures and mock models for the CMS data layer tests.
// No MongoDB connection is ever opened.

export const SECRET_URI = "mongodb+srv://app-user:pa55-w0rd@cluster9.zzz111.example.invalid/";

export const ids = {
  approvedAsset: "aaaaaaaaaaaaaaaaaaaaaaa1",
  pendingAsset: "aaaaaaaaaaaaaaaaaaaaaaa2",
  videoAsset: "aaaaaaaaaaaaaaaaaaaaaaa3",
  category: "cccccccccccccccccccccccc",
  draftCategory: "cccccccccccccccccccccccd",
};

export function asset(id, { rights = "approved", resourceType = "image", deletedAt = null } = {}) {
  return {
    _id: id,
    resourceType,
    cloudinary: {
      publicId: `sanpudam168/staging/legacy/test/${id}`,
      secureUrl: `https://res.cloudinary.com/demo-cloud/image/upload/v17/sanpudam168/staging/legacy/test/${id}.webp`,
      version: 17,
      format: "webp",
      assetId: "x",
      type: "upload",
    },
    width: 1600,
    height: 1066,
    defaultAlt: "ภาพจากคลังสื่อ",
    rights: { status: rights },
    deletedAt,
  };
}

export function imageRef(assetId, { alt = "ภาพประกอบ", caption = null, focalPoint = null, status = "resolved" } = {}) {
  return { assetId, alt, caption, focalPoint, mediaMapping: { status } };
}

// Internal fields are present so tests can prove they never reach DTOs.
const internal = {
  legacy: { key: "x:id:1", raw: { secret: "legacy raw" } },
  migration: { runId: "run" },
};

export const published = (fields) => ({ status: "published", review: { status: "approved" }, placeholderFields: [], ...internal, ...fields });
export const draft = (fields) => ({ status: "draft", review: { status: "pending_review" }, placeholderFields: [], ...internal, ...fields });
export const pendingReview = (fields) => ({ ...published(fields), review: { status: "pending_review" } });
export const withOpenPlaceholder = (fields) => ({ ...published(fields), placeholderFields: [{ path: "x", status: "placeholder" }] });

// A mock model that ignores filters (to prove the in-memory re-check) and
// records every call.
export function mockModel(docs, { fail } = {}) {
  const calls = [];
  const run = (result) => ({ exec: async () => (fail ? Promise.reject(fail) : structuredClone(result)) });
  return {
    calls,
    find(filter, projection, options) {
      calls.push({ method: "find", filter, projection, options });
      return run(options?.limit ? docs.slice(0, options.limit) : docs);
    },
    findOne(filter, projection, options) {
      calls.push({ method: "findOne", filter, projection, options });
      return run(docs[0] ?? null);
    },
  };
}

export function publishedSite() {
  return {
    SiteSettings: [published({
      _id: "s1",
      key: "default",
      identity: { name: "ศาลปู่ดำ168 และตราแผ่นดิน", shortName: "ศาลปู่ดำ168", description: "คำอธิบายที่อนุมัติแล้ว" },
      contact: { address: "ที่อยู่ที่อนุมัติแล้ว", locationShort: "ถนนมหาราช", phoneNumber: "082-368-6168", lineId: "@sanpudam168", directionsUrl: "https://maps.app.goo.gl/abc123", verified: true },
      openingHours: { opens: "08:00", closes: "20:00", daysText: "ทุกวัน", displayText: "08:00 – 20:00 น." },
    })],
    Banner: [
      published({ _id: "b0", image: imageRef(ids.pendingAsset, { caption: "ไม่อนุมัติสิทธิ์" }), mobileImage: null, sortOrder: 0 }),
      published({ _id: "b1", image: imageRef(ids.approvedAsset, { alt: "โถงสักการะ", caption: "โถง", focalPoint: { x: 0.55, y: 0.5 } }), mobileImage: null, sortOrder: 1 }),
    ],
    SacredItem: [
      published({ _id: "i1", name: "รายการหนึ่ง", slug: "item-one", excerpt: "สรุป", categoryId: ids.category, primaryImage: imageRef(ids.approvedAsset), sortOrder: 1 }),
      published({ _id: "i2", name: "รายการสอง", slug: "item-two", excerpt: "สรุป", categoryId: ids.draftCategory, primaryImage: imageRef(ids.pendingAsset), sortOrder: 2 }),
    ],
    Category: [published({ _id: ids.category, name: "หมวดที่เผยแพร่", slug: "published-category", sortOrder: 1 })],
    News: [published({ _id: "n1", title: "ข่าว", slug: "news-one", date: "2026-10-29", excerpt: "ย่อ", coverImage: imageRef(ids.approvedAsset) })],
    GalleryItem: [
      published({ _id: "g1", galleryKey: "shrine-main", image: imageRef(ids.approvedAsset, { caption: "คำบรรยาย" }), sortOrder: 1 }),
      published({ _id: "g2", galleryKey: "shrine-main", image: imageRef(ids.pendingAsset), sortOrder: 2 }),
    ],
    Faq: [published({ _id: "f1", question: "คำถาม?", answer: "คำตอบ", showOnHome: true, sortOrder: 1 })],
    Page: [published({
      _id: "p1", key: "history", title: "ประวัติ", intro: "บทนำ", homeIntroHeading: "ศรัทธาที่อยู่คู่ใจ",
      historyImage: imageRef(ids.approvedAsset, { alt: "องค์ปู่ดำ" }),
      worshipSteps: [{ key: "s2", sortOrder: 2, title: "ขั้นสอง", detail: null }, { key: "s1", sortOrder: 1, title: "ขั้นหนึ่ง", detail: "รายละเอียด" }],
    })],
    MediaAsset: [asset(ids.approvedAsset), asset(ids.pendingAsset, { rights: "pending_owner_confirmation" }), asset(ids.videoAsset, { resourceType: "video" })],
  };
}

export function mockModels(collections, options) {
  return Object.fromEntries(Object.entries(collections).map(([name, docs]) => [name, mockModel(docs, options)]));
}
