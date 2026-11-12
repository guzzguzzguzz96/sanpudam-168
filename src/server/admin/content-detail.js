import "server-only";
import { requireAdminRole } from "../auth/admin-access.js";
import { CONTENT_INVENTORY_ROLES } from "../auth/config.js";
import { cloudinaryImageUrl } from "../cms/media.js";
import { readReviewDatabaseConfig } from "../review/config.js";
import { connectReviewDatabase } from "../review/connection.js";
import { CONTENT_TYPES, PUBLICATION_LABELS, REVIEW_STATUS_LABELS, evaluateInventoryEnvironment } from "./content-inventory.js";

// Read-only detail of one staging content record for
// /admin/content/[type]/[id]. Same access, environment, and connection
// rules as the inventory (content-inventory.js).
//
// Every type has an explicit field map below: only those fields are
// projected from the database and returned. Never read or returned: legacy
// and migration metadata, created/updated-by ids, media-mapping legacy
// URLs, consent notes, analytics settings. Migrated text is returned as
// plain strings and rendered as React text (never HTML).

const QUERY_OPTIONS = Object.freeze({ lean: true, maxTimeMS: 5000 });
const OBJECT_ID = /^[0-9a-f]{24}$/;
const THUMBNAIL_WIDTH = 480;
const MAX_TEXT_LENGTH = 20000;

const IMAGE_FIELDS = ["assetId", "alt", "caption", "mediaMapping.status"];
const SEO = { title: "การแสดงผลในเครื่องมือค้นหา", fields: [{ path: "seo.title", label: "ชื่อในผลการค้นหา" }, { path: "seo.description", label: "คำอธิบายในผลการค้นหา", kind: "longtext" }] };
const ORDER = { path: "sortOrder", label: "ลำดับการแสดง", kind: "number" };

const DAY_LABELS = { mon: "จันทร์", tue: "อังคาร", wed: "พุธ", thu: "พฤหัสบดี", fri: "ศุกร์", sat: "เสาร์", sun: "อาทิตย์" };
const CONSENT_LABELS = { not_required: "ไม่ต้องขอความยินยอม", pending: "รอความยินยอม", obtained: "ได้รับความยินยอมแล้ว", refused: "ปฏิเสธการให้ความยินยอม" };
const SACRED_ITEM_KIND_LABELS = { shrine_worship: "สถานที่สักการะ", sacred_object: "วัตถุมงคล" };
const VIDEO_FILE_LABELS = { resolved: "มีไฟล์วิดีโอ", pending: "รอไฟล์วิดีโอ", missing: "ยังไม่มีไฟล์วิดีโอ" };
const POSTER_MODE_LABELS = { auto: "สร้างจากวิดีโอ", custom: "ภาพที่กำหนดเอง" };
const PLATFORM_LABELS = { facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube" };
const PLACEHOLDER_STATUS_LABELS = { placeholder: "ยังเป็นข้อความตัวอย่าง", confirmed_correct: "ยืนยันว่าถูกต้องแล้ว", replaced: "แทนที่แล้ว" };
const MAPPING_LABELS = { resolved: "เชื่อมไฟล์ภาพแล้ว", pending: "รอไฟล์ภาพ", missing: "ไม่มีไฟล์ภาพ" };
const RIGHTS_LABELS = { approved: "อนุมัติสิทธิ์แล้ว", pending_owner_confirmation: "รอเจ้าของยืนยันสิทธิ์", restricted: "จำกัดการใช้", rejected: "ไม่อนุมัติสิทธิ์" };
const APPROVAL_LABELS = { approved: "อนุมัติภาพแล้ว", pending: "รออนุมัติภาพ", rejected: "ไม่อนุมัติภาพ" };

// kind: text (default) | longtext | number | bool | enum | days | image | images | list | category | video
// flagPaths: extra placeholder-flag paths that belong to the field.
const FIELD_MAPS = {
  SiteSettings: [
    { title: "ข้อมูลเว็บไซต์", fields: [
      { path: "identity.name", label: "ชื่อเว็บไซต์" },
      { path: "identity.shortName", label: "ชื่อย่อ" },
      { path: "identity.tagline", label: "คำโปรย" },
      { path: "identity.description", label: "คำอธิบาย", kind: "longtext" },
      { path: "branding.logo", label: "โลโก้", kind: "image" },
    ] },
    { title: "การติดต่อ", fields: [
      { path: "contact.address", label: "ที่อยู่", kind: "longtext" },
      { path: "contact.locationShort", label: "สถานที่โดยย่อ" },
      { path: "contact.phoneNumber", label: "เบอร์โทรศัพท์" },
      { path: "contact.lineId", label: "LINE ID" },
      { path: "contact.directionsUrl", label: "ลิงก์เส้นทาง (ข้อความ ไม่ใช่ลิงก์ที่กดได้)" },
      { path: "contact.mapEmbedQuery", label: "คำค้นสำหรับแผนที่" },
      { path: "contact.verified", label: "ยืนยันข้อมูลติดต่อแล้ว", kind: "bool" },
    ] },
    { title: "เวลาเปิดทำการ", fields: [
      { path: "openingHours.daysText", label: "วันเปิดทำการ" },
      { path: "openingHours.opens", label: "เวลาเปิด" },
      { path: "openingHours.closes", label: "เวลาปิด" },
      { path: "openingHours.displayText", label: "ข้อความแสดงเวลา" },
      { path: "openingHours.daysOfWeek", label: "วันในสัปดาห์", kind: "days" },
    ] },
    { title: "โซเชียลมีเดียและหัวข้อติดต่อ", fields: [
      { path: "socialLinks", label: "ลิงก์โซเชียลมีเดีย", kind: "list", project: ["socialLinks.platform", "socialLinks.url", "socialLinks.verified"], item: (link) => ({ primary: PLATFORM_LABELS[link.platform] ?? text(link.platform), secondary: [text(link.url), link.verified === true ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"].filter(Boolean).join(" · ") }) },
      { path: "contactTopics", label: "หัวข้อการติดต่อ", kind: "list", project: ["contactTopics.label", "contactTopics.sortOrder"], sortBy: "sortOrder", item: (topic) => ({ primary: text(topic.label) }) },
    ] },
    { title: "ภาพสำหรับการแชร์", fields: [{ path: "seo.defaultOgImage", label: "ภาพเริ่มต้นเมื่อแชร์ลิงก์", kind: "image" }] },
  ],
  Page: [
    { title: "ประวัติศาล", fields: [
      { path: "title", label: "ชื่อหน้า" },
      { path: "homeIntroHeading", label: "หัวข้อบนหน้าแรก" },
      { path: "intro", label: "บทนำ", kind: "longtext" },
      { path: "historyBody", label: "เนื้อหาประวัติ", kind: "longtext" },
      { path: "quote", label: "ข้อความเด่น" },
      { path: "historyImage", label: "ภาพประกอบประวัติ", kind: "image" },
    ] },
    { title: "ตราแผ่นดิน", fields: [
      { path: "coatOfArms.heading", label: "หัวข้อ" },
      { path: "coatOfArms.body", label: "เนื้อหา", kind: "longtext" },
      { path: "coatOfArms.image", label: "ภาพตราแผ่นดิน", kind: "image" },
      { path: "coatOfArms.parts", label: "ส่วนประกอบและความหมาย", kind: "list", project: ["coatOfArms.parts.part", "coatOfArms.parts.meaning", "coatOfArms.parts.sortOrder"], sortBy: "sortOrder", item: (part) => ({ primary: text(part.part), secondary: text(part.meaning) }) },
    ] },
    { title: "การขอพรและการสักการะ", fields: [
      { path: "wishTopics", label: "เรื่องที่นิยมขอพร", kind: "list", project: ["wishTopics.topic", "wishTopics.description", "wishTopics.sortOrder"], sortBy: "sortOrder", item: (topic) => ({ primary: text(topic.topic), secondary: text(topic.description) }) },
      { path: "worshipSteps", label: "ขั้นตอนการสักการะ", kind: "list", project: ["worshipSteps.title", "worshipSteps.detail", "worshipSteps.sortOrder"], sortBy: "sortOrder", item: (step) => ({ primary: text(step.title), secondary: text(step.detail) }) },
    ] },
    SEO,
  ],
  SacredItem: [
    { title: "ข้อมูลหลัก", fields: [
      { path: "name", label: "ชื่อ" },
      { path: "slug", label: "ที่อยู่หน้า", format: (slug) => `/sakkara/${slug}` },
      { path: "type", label: "ประเภทรายการ", kind: "enum", labels: SACRED_ITEM_KIND_LABELS },
      { path: "categoryId", label: "หมวดหมู่", kind: "category" },
      { path: "primaryImage", label: "ภาพหลัก", kind: "image" },
      { path: "excerpt", label: "คำอธิบายย่อ", kind: "longtext" },
      { path: "body", label: "รายละเอียด", kind: "longtext" },
    ] },
    { title: "การบูชาและการติดต่อ", fields: [
      { path: "prayerTopics", label: "เรื่องที่นิยมขอพร" },
      { path: "offerings", label: "ของไหว้", kind: "longtext" },
      { path: "inquiryText", label: "ข้อความติดต่อสอบถาม" },
      { path: "variants", label: "เนื้อที่จัดสร้าง", kind: "list", project: ["variants.name", "variants.quantity", "variants.quantityText", "variants.note", "variants.sortOrder"], sortBy: "sortOrder", item: (variant) => ({ primary: text(variant.name), secondary: [text(variant.quantityText) || (Number.isFinite(variant.quantity) ? `${variant.quantity}` : ""), text(variant.note)].filter(Boolean).join(" · ") }) },
      { path: "showVariantQuantities", label: "แสดงจำนวนที่จัดสร้าง", kind: "bool" },
      ORDER,
    ] },
    SEO,
  ],
  Category: [
    { title: "หมวดหมู่", fields: [
      { path: "name", label: "ชื่อหมวดหมู่" },
      { path: "slug", label: "รหัสในลิงก์" },
      { path: "description", label: "คำอธิบาย", kind: "longtext" },
      ORDER,
    ] },
  ],
  News: [
    { title: "ข่าว", fields: [
      { path: "title", label: "หัวข้อข่าว" },
      { path: "slug", label: "ที่อยู่หน้า", format: (slug) => `/news/${slug}` },
      { path: "date", label: "วันที่" },
      { path: "coverImage", label: "ภาพปก", kind: "image" },
      { path: "excerpt", label: "คำอธิบายย่อ", kind: "longtext" },
      { path: "body", label: "เนื้อหาข่าว", kind: "longtext" },
      { path: "images", label: "ภาพประกอบในข่าว", kind: "images" },
    ] },
    SEO,
  ],
  Banner: [
    { title: "แบนเนอร์", fields: [
      { path: "image", label: "ภาพหลัก (เดสก์ท็อป)", kind: "image" },
      { path: "mobileImage", label: "ภาพสำหรับมือถือ", kind: "image" },
      ORDER,
    ] },
  ],
  GalleryItem: [
    { title: "ภาพแกลเลอรี", fields: [
      { path: "image", label: "ภาพ", kind: "image" },
      { path: "galleryKey", label: "ชุดภาพ" },
      ORDER,
    ] },
  ],
  Faq: [
    { title: "คำถามที่พบบ่อย", fields: [
      { path: "question", label: "คำถาม" },
      { path: "answer", label: "คำตอบ", kind: "longtext" },
      { path: "showOnHome", label: "แสดงบนหน้าแรก", kind: "bool" },
      ORDER,
    ] },
  ],
  Video: [
    { title: "วิดีโอ", fields: [
      { path: "title", label: "ชื่อวิดีโอ" },
      { path: "description", label: "คำอธิบาย", kind: "longtext" },
      { path: "videoMapping.status", label: "ไฟล์วิดีโอ", kind: "video", flagPaths: ["videoAssetId", "videoMapping"] },
      { path: "posterMode", label: "ภาพหน้าปก", kind: "enum", labels: POSTER_MODE_LABELS },
      { path: "poster", label: "ภาพหน้าปกที่กำหนด", kind: "image" },
      ORDER,
    ] },
  ],
  Review: [
    { title: "รีวิว", fields: [
      { path: "displayName", label: "ชื่อที่แสดง" },
      { path: "sourceLabel", label: "ที่มา" },
      { path: "quote", label: "ข้อความรีวิว", kind: "longtext" },
      { path: "rating", label: "คะแนน", kind: "number" },
      { path: "consent.status", label: "ความยินยอมในการเผยแพร่", kind: "enum", labels: CONSENT_LABELS },
      ORDER,
    ] },
  ],
  TeamMember: [
    { title: "ทีมงาน", fields: [
      { path: "name", label: "ชื่อ" },
      { path: "roleTitle", label: "ตำแหน่ง" },
      { path: "photo", label: "ภาพ", kind: "image" },
      { path: "bio", label: "ประวัติย่อ", kind: "longtext" },
      { path: "consent.status", label: "ความยินยอมในการเผยแพร่", kind: "enum", labels: CONSENT_LABELS },
      ORDER,
    ] },
  ],
};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const get = (doc, path) => path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), doc);
const clip = (value) => (value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…` : value);

function labelled(value, labels) {
  const raw = text(value);
  if (!raw) return { label: "ยังไม่ยืนยัน", known: false };
  return Object.hasOwn(labels, raw) ? { label: labels[raw], known: true } : { label: `ยังไม่ยืนยัน (ค่าที่บันทึก: ${raw.slice(0, 40)})`, known: false };
}

function projectionFor(model) {
  const paths = ["status", "review.status", "review.note", "placeholderFields.path", "placeholderFields.status", "placeholderFields.note", "placeholderFields.flaggedAt"];
  for (const section of FIELD_MAPS[model]) {
    for (const field of section.fields) {
      if (field.kind === "image") paths.push(...IMAGE_FIELDS.map((key) => `${field.path}.${key}`));
      else if (field.kind === "images") paths.push(...IMAGE_FIELDS.map((key) => `${field.path}.${key}`));
      else if (field.kind === "list") paths.push(...field.project);
      else if (field.kind === "video") paths.push("videoAssetId", "videoMapping.status");
      else paths.push(field.path);
    }
  }
  if (model === "Banner" || model === "GalleryItem") paths.push("sortOrder");
  return Object.fromEntries([...new Set(paths)].map((path) => [path, 1]));
}

// Every referenced asset id (images, poster, video file) of a document.
function referencedAssetIds(model, doc) {
  const ids = new Set();
  for (const section of FIELD_MAPS[model]) {
    for (const field of section.fields) {
      const value = get(doc, field.path);
      if (field.kind === "image" && value?.assetId) ids.add(String(value.assetId));
      if (field.kind === "images" && Array.isArray(value)) for (const image of value) if (image?.assetId) ids.add(String(image.assetId));
    }
  }
  if (doc.videoAssetId) ids.add(String(doc.videoAssetId));
  return [...ids].filter((id) => OBJECT_ID.test(id));
}

const MEDIA_FIELDS = { resourceType: 1, width: 1, height: 1, "cloudinary.secureUrl": 1, "cloudinary.publicId": 1, "cloudinary.version": 1, "cloudinary.format": 1, "rights.status": 1, "approval.status": 1, deletedAt: 1 };

function imageView(ref, assets) {
  if (!ref || typeof ref !== "object") return null;
  const asset = ref.assetId ? assets.get(String(ref.assetId)) : null;
  const usable = asset && !asset.deletedAt && asset.resourceType === "image" && asset.rights?.status !== "rejected";
  const src = usable ? cloudinaryImageUrl(asset, { width: THUMBNAIL_WIDTH }) : null;
  const scale = asset?.width ? Math.min(1, THUMBNAIL_WIDTH / asset.width) : 1;
  return {
    thumbnail: src && asset.width && asset.height ? { src, width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } : null,
    alt: clip(text(ref.alt)),
    caption: clip(text(ref.caption)),
    mapping: labelled(ref.mediaMapping?.status, MAPPING_LABELS),
    file: !ref.assetId ? "ไม่มีการอ้างอิงไฟล์ภาพ" : !asset ? "ไม่พบไฟล์ภาพในคลังสื่อ" : asset.deletedAt ? "ไฟล์ภาพถูกลบแล้ว" : null,
    // Shown only when the asset records them; otherwise "unconfirmed".
    rights: asset ? labelled(asset.rights?.status, RIGHTS_LABELS) : null,
    approval: asset ? labelled(asset.approval?.status, APPROVAL_LABELS) : null,
  };
}

function fieldView(field, doc, assets, category) {
  const value = get(doc, field.path);
  switch (field.kind) {
    case "image":
      return { kind: "image", value: imageView(value, assets) };
    case "images":
      return { kind: "images", value: (Array.isArray(value) ? value : []).map((image) => imageView(image, assets)).filter(Boolean) };
    case "list": {
      const items = Array.isArray(value) ? [...value] : [];
      if (field.sortBy) items.sort((a, b) => (a?.[field.sortBy] ?? 0) - (b?.[field.sortBy] ?? 0));
      return { kind: "list", value: items.map((item) => field.item(item ?? {})).map((item) => ({ primary: clip(item.primary || "-"), secondary: clip(item.secondary || "") })) };
    }
    case "bool":
      return { kind: "text", value: value === true ? "ใช่" : value === false ? "ไม่ใช่" : "" };
    case "number":
      return { kind: "text", value: Number.isFinite(value) ? String(value) : "" };
    case "enum":
      return { kind: "text", value: text(value) ? labelled(value, field.labels).label : "" };
    case "days":
      return { kind: "text", value: (Array.isArray(value) ? value : []).map((day) => DAY_LABELS[day] ?? text(day)).join(", ") };
    case "category":
      return { kind: "text", value: category ?? (value ? "ไม่พบหมวดหมู่ที่อ้างอิง" : "") };
    case "video": {
      const asset = doc.videoAssetId ? assets.get(String(doc.videoAssetId)) : null;
      const status = labelled(value, VIDEO_FILE_LABELS).label;
      return { kind: "text", value: doc.videoAssetId && !asset ? `${status} · ไม่พบไฟล์ในคลังสื่อ` : status };
    }
    case "longtext":
      return { kind: "longtext", value: clip(text(value)) };
    default: {
      const raw = clip(text(typeof value === "number" ? String(value) : value));
      return { kind: "text", value: raw && field.format ? field.format(raw) : raw };
    }
  }
}

function titleOf(type, doc) {
  return text(type.title(doc)) || text(type.fallback?.(doc)) || "(ไม่มีชื่อ)";
}

// Returns one of:
//   { status: "not_found", reason: "invalid_type" | "invalid_id" | "missing" }
//   { status: "unavailable", reason: "environment" | "not_configured" | "connection_failed" | "query_failed" }
//   { status: "ok", detail }
export async function loadContentDetail(principal, { type: typeKey, id }, { env = process.env, connect = connectReviewDatabase, logger = console } = {}) {
  requireAdminRole(principal, CONTENT_INVENTORY_ROLES);

  // Validated before any configuration, connection, or query.
  const type = typeof typeKey === "string" ? CONTENT_TYPES.find((candidate) => candidate.key === typeKey) : null;
  if (!type) return { status: "not_found", reason: "invalid_type" };
  if (typeof id !== "string" || !OBJECT_ID.test(id)) return { status: "not_found", reason: "invalid_id" };

  const environment = evaluateInventoryEnvironment(env);
  if (!environment.enabled) return { status: "unavailable", reason: "environment" };
  const config = readReviewDatabaseConfig(env);
  if (config.problems.length) {
    logger.error(`[admin-content] unavailable: ${config.problems.join("; ")}`);
    return { status: "unavailable", reason: "not_configured" };
  }

  let models;
  try {
    ({ models } = await connect({ ...config, dnsServers: environment.mode === "local" ? config.dnsServers : null }));
  } catch (error) {
    logger.error(`[admin-content] unavailable: ${error?.name ?? "Error"}`);
    return { status: "unavailable", reason: "connection_failed" };
  }

  try {
    // Exact lookup by the validated id string; the schema casts it to an ObjectId.
    const doc = await models[type.model].findOne({ _id: id }, projectionFor(type.model), QUERY_OPTIONS).exec();
    if (!doc) return { status: "not_found", reason: "missing" };

    const assetIds = referencedAssetIds(type.model, doc);
    const categoryId = type.model === "SacredItem" && doc.categoryId && OBJECT_ID.test(String(doc.categoryId)) ? String(doc.categoryId) : null;
    const [assetList, category] = await Promise.all([
      assetIds.length ? models.MediaAsset.find({ _id: { $in: assetIds } }, MEDIA_FIELDS, QUERY_OPTIONS).exec() : [],
      categoryId ? models.Category.findOne({ _id: categoryId }, { name: 1 }, QUERY_OPTIONS).exec() : null,
    ]);
    const assets = new Map((assetList ?? []).map((asset) => [String(asset._id), asset]));

    const flagPathsOf = (field) => [field.path, ...(field.flagPaths ?? [])];
    const labels = new Map(FIELD_MAPS[type.model].flatMap((section) => section.fields.flatMap((field) => flagPathsOf(field).map((path) => [path, field.label]))));
    const labelFor = (path) => labels.get(path) ?? labels.get(path.split(".").slice(0, -1).join(".")) ?? path;
    const flags = Array.isArray(doc.placeholderFields) ? doc.placeholderFields : [];
    const openFlags = flags.filter((flag) => flag?.status === "placeholder");
    const openPaths = new Set(openFlags.map((flag) => text(flag.path)));

    return {
      status: "ok",
      detail: {
        id,
        type: { key: type.key, label: type.label },
        title: titleOf(type, doc),
        publication: labelled(doc.status, PUBLICATION_LABELS),
        review: labelled(doc.review?.status, REVIEW_STATUS_LABELS),
        reviewNote: clip(text(doc.review?.note)),
        placeholders: {
          open: openFlags.map((flag) => ({
            path: text(flag.path),
            label: labelFor(text(flag.path)),
            status: labelled(flag.status, PLACEHOLDER_STATUS_LABELS).label,
            note: clip(text(flag.note)),
            flaggedAt: flag.flaggedAt ? new Date(flag.flaggedAt).toISOString().slice(0, 10) : null,
          })),
          resolvedCount: flags.length - openFlags.length,
        },
        sections: FIELD_MAPS[type.model].map((section) => ({
          title: section.title,
          fields: section.fields.map((field) => ({
            label: field.label,
            placeholder: flagPathsOf(field).some((own) => openPaths.has(own) || [...openPaths].some((path) => path.startsWith(`${own}.`))),
            ...fieldView(field, doc, assets, category ? text(category.name) : null),
          })),
        })),
      },
    };
  } catch (error) {
    logger.error(`[admin-content] unavailable: ${error?.name ?? "Error"}`);
    return { status: "unavailable", reason: "query_failed" };
  }
}

// Back link: the list, keeping a valid type filter.
export function contentListHref(from) {
  return typeof from === "string" && CONTENT_TYPES.some((type) => type.key === from) ? `/admin/content?type=${from}` : "/admin/content";
}

export const CONTENT_DETAIL_FIELD_MAPS = FIELD_MAPS;
