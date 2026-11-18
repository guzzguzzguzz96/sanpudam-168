import "server-only";
import { HOSTED_ENVIRONMENT_MARKERS } from "../../lib/review-mode.js";
import { requireAdminRole } from "../auth/admin-access.js";
import { CONTENT_INVENTORY_ROLES } from "../auth/config.js";
import { readReviewDatabaseConfig } from "../review/config.js";
import { connectReviewDatabase } from "../review/connection.js";

// Read-only inventory of the staging site content for /admin/content.
//
// - Callers must pass a principal issued by getAdminAccess() for this
//   request; anything else throws before configuration is read or a
//   connection is opened.
// - Data comes from the dedicated read-only staging connection (database
//   name and `read` role are verified in review/connection.js). The Client
//   Review flags play no part: they neither enable this inventory nor grant
//   access to it.
// - Available on a local machine and on the Vercel Preview of branch `dev`
//   only; Production and every other hosted environment are refused.
// - Only the fields the list shows are read and returned. Media assets,
//   migration runs, and other operational collections are not content.

const QUERY_OPTIONS = Object.freeze({ lean: true, maxTimeMS: 5000, limit: 500 });
const MAX_TITLE_LENGTH = 120;

const text = (value) => (typeof value === "string" ? value.trim() : "");
const isSet = (env, name) => typeof env?.[name] === "string" && env[name] !== "";

// Content collections in the order an editor thinks about the site.
// projection: the title fields only, plus status, review status, and order.
export const CONTENT_TYPES = Object.freeze([
  { key: "site-settings", model: "SiteSettings", label: "การตั้งค่าเว็บไซต์", fields: ["identity.name"], title: (doc) => doc.identity?.name },
  { key: "pages", model: "Page", label: "หน้าเนื้อหา", fields: ["title"], title: (doc) => doc.title },
  { key: "sacred-items", model: "SacredItem", label: "วัตถุมงคล", fields: ["name", "sortOrder"], title: (doc) => doc.name },
  { key: "categories", model: "Category", label: "หมวดหมู่วัตถุมงคล", fields: ["name", "sortOrder"], title: (doc) => doc.name },
  { key: "news", model: "News", label: "ข่าวสาร", fields: ["title", "date"], title: (doc) => doc.title, sort: { date: -1, _id: 1 } },
  { key: "banners", model: "Banner", label: "แบนเนอร์", fields: ["image.caption", "sortOrder"], title: (doc) => doc.image?.caption, fallback: (doc) => `แบนเนอร์ลำดับ ${doc.sortOrder ?? "-"}` },
  { key: "gallery", model: "GalleryItem", label: "ภาพแกลเลอรี", fields: ["image.caption", "image.alt", "sortOrder"], title: (doc) => doc.image?.caption || doc.image?.alt, fallback: (doc) => `ภาพลำดับ ${doc.sortOrder ?? "-"}` },
  { key: "faqs", model: "Faq", label: "คำถามที่พบบ่อย", fields: ["question", "sortOrder"], title: (doc) => doc.question },
  { key: "videos", model: "Video", label: "วิดีโอ", fields: ["title"], title: (doc) => doc.title },
  { key: "reviews", model: "Review", label: "รีวิวจากผู้ศรัทธา", fields: ["displayName"], title: (doc) => doc.displayName },
  { key: "team", model: "TeamMember", label: "ทีมงาน", fields: ["name"], title: (doc) => doc.name },
].map((type) => Object.freeze(type)));

const TYPE_KEYS = new Set(CONTENT_TYPES.map((type) => type.key));

// Labels for the values the schema allows (models/shared.js). Any other
// stored value is shown as it is, marked unknown, never hidden.
export const PUBLICATION_LABELS = Object.freeze({ draft: "ฉบับร่าง", published: "เผยแพร่แล้ว", archived: "เก็บถาวร" });
export const REVIEW_STATUS_LABELS = Object.freeze({ pending_review: "รอตรวจทาน", approved: "อนุมัติแล้ว", changes_requested: "ขอให้แก้ไข" });

function describeValue(value, labels) {
  const raw = text(value);
  if (!raw) return { value: null, label: "ไม่มีข้อมูล", known: false };
  if (Object.hasOwn(labels, raw)) return { value: raw, label: labels[raw], known: true };
  return { value: raw.slice(0, 40), label: `ค่าที่ไม่รู้จัก (${raw.slice(0, 40)})`, known: false };
}

// Environment gate. Returns { enabled, mode: "local" | "vercel-preview" | null, reason }.
export function evaluateInventoryEnvironment(env) {
  if (!env || typeof env !== "object") return { enabled: false, mode: null, reason: "no_environment" };
  if (env.VERCEL_ENV === "production" || env.VERCEL_TARGET_ENV === "production") return { enabled: false, mode: null, reason: "production" };
  if (isSet(env, "VERCEL") || isSet(env, "VERCEL_ENV")) {
    const devPreview = env.VERCEL === "1" && env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === "dev";
    return devPreview ? { enabled: true, mode: "vercel-preview", reason: null } : { enabled: false, mode: null, reason: "hosted_not_dev_preview" };
  }
  if (HOSTED_ENVIRONMENT_MARKERS.some((name) => isSet(env, name))) return { enabled: false, mode: null, reason: "hosted_unknown" };
  return { enabled: true, mode: "local", reason: null };
}

function toItem(type, doc) {
  const title = text(type.title(doc)) || text(type.fallback?.(doc)) || "(ไม่มีชื่อ)";
  return {
    id: String(doc._id),
    type: type.key,
    typeLabel: type.label,
    title: title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title,
    publication: describeValue(doc.status, PUBLICATION_LABELS),
    review: describeValue(doc.review?.status, REVIEW_STATUS_LABELS),
  };
}

// Returns one of:
//   { status: "unavailable", reason: "environment" | "not_configured" | "connection_failed" | "query_failed" }
//   { status: "ok" | "empty", total, types: [{ key, label, count }], items }
export async function loadContentInventory(principal, { env = process.env, connect = connectReviewDatabase, logger = console } = {}) {
  requireAdminRole(principal, CONTENT_INVENTORY_ROLES);

  const environment = evaluateInventoryEnvironment(env);
  if (!environment.enabled) return { status: "unavailable", reason: "environment" };

  const config = readReviewDatabaseConfig(env);
  if (config.problems.length) {
    logger.error(`[admin-content] unavailable: ${config.problems.join("; ")}`);
    return { status: "unavailable", reason: "not_configured" };
  }

  let models;
  try {
    // Custom DNS resolvers are a local-machine workaround only.
    ({ models } = await connect({ ...config, dnsServers: environment.mode === "local" ? config.dnsServers : null }));
  } catch (error) {
    logger.error(`[admin-content] unavailable: ${error?.name ?? "Error"}`);
    return { status: "unavailable", reason: "connection_failed" };
  }

  try {
    const lists = await Promise.all(
      CONTENT_TYPES.map(async (type) => {
        const projection = Object.fromEntries(["status", "review.status", ...type.fields].map((field) => [field, 1]));
        const docs = await models[type.model].find({}, projection, { ...QUERY_OPTIONS, sort: type.sort ?? { sortOrder: 1, _id: 1 } }).exec();
        return (docs ?? []).map((doc) => toItem(type, doc));
      }),
    );
    const types = CONTENT_TYPES.map((type, index) => ({ key: type.key, label: type.label, count: lists[index].length }));
    const items = lists.flat();
    return { status: items.length ? "ok" : "empty", total: items.length, types, items };
  } catch (error) {
    logger.error(`[admin-content] unavailable: ${error?.name ?? "Error"}`);
    return { status: "unavailable", reason: "query_failed" };
  }
}

// ?type= handling. Only a single known key applies; anything else (unknown,
// repeated, non-string) shows every type and is reported as invalid. The
// requested value itself is never echoed.
export function applyTypeFilter(inventory, requested) {
  if (requested === undefined || requested === null || requested === "") return { type: null, invalid: false, items: inventory.items };
  if (typeof requested !== "string" || !TYPE_KEYS.has(requested)) return { type: null, invalid: true, items: inventory.items };
  return { type: requested, invalid: false, items: inventory.items.filter((item) => item.type === requested) };
}
