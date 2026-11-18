// Staging-to-production promotion plan (pure; no I/O).
//
// Input: the staging documents (read-only) and the owner confirmation file
// (migration/confirmations/owner-launch-confirmation.json). Output: the
// exact production documents, per-field before/after for edited text, the
// issues found, and a plan hash that binds the approval to this content.
//
// Rules (any error rejects the whole batch):
//   - Only PROMOTED_COLLECTIONS are promoted; videos, reviews, team_members,
//     migration_runs, and admin_audit_log never are.
//   - Every staging record in a promoted collection must be listed in the
//     confirmation, and every listed record must exist.
//   - Every open placeholder flag of a promoted record must have a decision:
//     "confirm" (the stored value must still equal the confirmed value) or
//     "remove_sample_paragraph" (exactly one paragraph starting with
//     "ข้อความ(ใน)ส่วนนี้เป็นตัวอย่าง" is removed; the rest is kept as is).
//   - No sample marker may remain in promoted text.
//   - Contact values must equal the confirmed ones; Maps and social links
//     come from the confirmation and must pass the site validators.
//   - Every media reference resolves to a promoted asset that passes the
//     public media rule; every category reference resolves.
//   - Every document passes its Mongoose schema with status "published"
//     and the public publication rule.
// Kept: _id, timestamps, legacy keys/checksums. Removed: legacy.raw (spec:
// raw values that could not be converted; not needed in production).
import { createHash } from "node:crypto";
import { collectImageRefs } from "../../../src/models/shared.js";
import { modelsByCollection } from "../../../src/models/index.js";
import { isMediaPubliclyUsable, isPubliclyVisible } from "../../../src/server/cms/policy.js";
import { getPhoneHref } from "../../../src/lib/contact-actions.js";
import { lineUrlFromId } from "../../../src/server/cms/adapters.js";
import { reviewMapsUrl, reviewSocialLink } from "../../../src/server/review/homepage.js";
import { PRODUCTION_DATABASE } from "./promotion-target.mjs";

export const PROMOTED_COLLECTIONS = Object.freeze(["media_assets", "categories", "site_settings", "pages", "sacred_items", "news", "banners", "gallery_items", "faqs"]);
export const EXCLUDED_COLLECTIONS = Object.freeze(["videos", "reviews", "team_members", "migration_runs", "admin_audit_log"]);
const CONTENT_COLLECTIONS = PROMOTED_COLLECTIONS.filter((c) => c !== "media_assets");

export const SAMPLE_PARAGRAPH = /^(\*\*)?ข้อความ(ใน)?ส่วนนี้เป็นตัวอย่าง/;
const SAMPLE_MARKERS = /ข้อความ(ใน)?ส่วนนี้เป็นตัวอย่าง|ข้อความตัวอย่าง|placeholder|lorem ipsum/i;
const SKIP_SCAN_KEYS = new Set(["_id", "legacy", "migration", "placeholderFields", "review", "mediaMapping", "createdBy", "updatedBy", "approval", "rights", "cloudinary", "contentHash", "source", "cloudinaryImport"]);

// --- canonical form and hashing --------------------------------------------

const isObjectId = (v) => v && typeof v === "object" && (v._bsontype === "ObjectId" || v._bsontype === "ObjectID") && typeof v.toHexString === "function";

export function canonical(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (isObjectId(value)) return { $oid: value.toHexString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => [k, canonical(value[k])]));
}

export const sha256 = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

// Checksum of a document as promoted, excluding the field that stores it.
export function promotionChecksum(doc) {
  const { migration, ...rest } = doc;
  const { importChecksum: _ignored, ...migrationRest } = migration ?? {};
  return sha256({ ...rest, migration: migrationRest });
}

// Deep copy that keeps ObjectId and Date instances.
export function clone(value) {
  if (value === null || typeof value !== "object" || isObjectId(value) || value instanceof Date) return value instanceof Date ? new Date(value) : value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
}

const idOf = (doc) => (isObjectId(doc?._id) ? doc._id.toHexString() : String(doc?._id));

function getPath(doc, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), doc);
}

function setPath(doc, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((node, key) => node[key], doc);
  parent[last] = value;
}

// Removes exactly the sample paragraphs (paragraphs are separated by blank
// lines). Returns { value, removed }.
export function removeSampleParagraphs(text) {
  if (typeof text !== "string") return { value: text, removed: [] };
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  const removed = paragraphs.filter((p) => SAMPLE_PARAGRAPH.test(p.trim()));
  const kept = paragraphs.filter((p) => !SAMPLE_PARAGRAPH.test(p.trim()));
  return { value: kept.join("\n\n").trim(), removed: removed.map((p) => p.trim()) };
}

function scanStrings(value, path, out) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, i) => scanStrings(item, `${path}[${i}]`, out));
  else if (value && typeof value === "object" && !isObjectId(value) && !(value instanceof Date)) {
    for (const [key, inner] of Object.entries(value)) if (!SKIP_SCAN_KEYS.has(key)) scanStrings(inner, path ? `${path}.${key}` : key, out);
  }
  return out;
}

// --- confirmation file ------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX24 = /^[0-9a-f]{24}$/;

export function validateConfirmation(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== "object") return ["confirmation file is not an object"];
  if (manifest.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  if (!DATE.test(manifest.confirmedAt ?? "")) problems.push("confirmedAt must be YYYY-MM-DD");
  if (typeof manifest.confirmedBy !== "string" || !manifest.confirmedBy.trim()) problems.push("confirmedBy is required");
  if (manifest.targetDatabase !== PRODUCTION_DATABASE) problems.push(`targetDatabase must be ${PRODUCTION_DATABASE}`);
  if (!Array.isArray(manifest.records)) problems.push("records must be an array");
  for (const record of manifest.records ?? []) {
    if (!PROMOTED_COLLECTIONS.includes(record.collection)) problems.push(`records: ${record.collection} is not a promoted collection`);
    if (!HEX24.test(record.id ?? "")) problems.push(`records: invalid id ${record.id}`);
  }
  const ids = (manifest.records ?? []).map((r) => `${r.collection}/${r.id}`);
  if (new Set(ids).size !== ids.length) problems.push("records: duplicate entries");
  for (const decision of manifest.placeholders ?? []) {
    if (!["confirm", "remove_sample_paragraph"].includes(decision.action)) problems.push(`placeholders: unknown action ${decision.action}`);
    if (!HEX24.test(decision.id ?? "") || typeof decision.path !== "string") problems.push(`placeholders: invalid entry ${decision.collection}/${decision.id}`);
    if (decision.action === "confirm" && !("value" in decision)) problems.push(`placeholders: ${decision.collection}/${decision.id} ${decision.path} needs the confirmed value`);
  }
  for (const entry of manifest.media ?? []) {
    if (typeof entry.manifestId !== "string") problems.push("media: manifestId is required");
    if (!["obtained", "not_required"].includes(entry.consent)) problems.push(`media: ${entry.manifestId} consent must be obtained or not_required`);
  }
  const contact = manifest.contact;
  if (!contact || typeof contact !== "object") problems.push("contact is required");
  else {
    for (const key of ["address", "phoneNumber", "lineId", "directionsUrl"]) if (typeof contact[key] !== "string") problems.push(`contact.${key} is required`);
    if (!contact.openingHours || typeof contact.openingHours !== "object") problems.push("contact.openingHours is required");
    if (!Array.isArray(contact.socialLinks)) problems.push("contact.socialLinks must be an array");
  }
  for (const name of EXCLUDED_COLLECTIONS) if ((manifest.records ?? []).some((r) => r.collection === name)) problems.push(`${name} must not be promoted`);
  return problems;
}

// --- plan -------------------------------------------------------------------

// staging: { [collection]: documents[] } (read-only copies).
// manifest: the parsed confirmation file. manifestText: its exact bytes,
// hashed into the plan.
export async function buildPromotionPlan(staging, manifest, { manifestText = JSON.stringify(manifest) } = {}) {
  const issues = [];
  const error = (where, message) => issues.push({ severity: "error", where, message });
  for (const problem of validateConfirmation(manifest)) error("confirmation", problem);
  if (issues.length) return { issues, docs: [], edits: [], planHash: null, counts: {} };

  const approvedAt = new Date(`${manifest.confirmedAt}T00:00:00.000Z`);
  const reviewNote = `Owner launch confirmation ${manifest.confirmedAt}: ${manifest.confirmedBy}`.slice(0, 500);
  const listed = new Set(manifest.records.map((r) => `${r.collection}/${r.id}`));
  const decisions = new Map((manifest.placeholders ?? []).map((d) => [`${d.collection}/${d.id}/${d.path}`, d]));
  const usedDecisions = new Set();
  const mediaDecisions = new Map((manifest.media ?? []).map((m) => [m.manifestId, m]));
  const docs = [];
  const edits = [];

  for (const collection of PROMOTED_COLLECTIONS) {
    for (const source of staging[collection] ?? []) {
      const key = `${collection}/${idOf(source)}`;
      if (!listed.has(key)) {
        error(key, "staging record is not in the confirmation file");
        continue;
      }
      const doc = clone(source);
      if (doc.legacy && "raw" in doc.legacy) doc.legacy.raw = null;

      if (collection === "media_assets") {
        const decision = mediaDecisions.get(doc.manifestId);
        if (!decision) {
          error(key, `media ${doc.manifestId} is not approved in the confirmation file`);
          continue;
        }
        if (doc.rights?.status !== "approved") error(key, `media ${doc.manifestId} rights.status is ${doc.rights?.status}, not approved`);
        if (doc.rights?.containsIdentifiablePeople === true && decision.consent !== "obtained") error(key, `media ${doc.manifestId} shows identifiable people and needs consent "obtained"`);
        doc.approval = { status: "approved", approvedBy: null, approvedAt };
        if (doc.rights?.containsIdentifiablePeople === true) doc.rights.consent = { status: "obtained", recordedAt: approvedAt, note: (decision.note ?? reviewNote).slice(0, 300) };
        docs.push({ collection, id: idOf(doc), label: doc.manifestId, doc });
        continue;
      }

      // Content: placeholder decisions first (on the original values).
      for (const flag of doc.placeholderFields ?? []) {
        if (flag.status !== "placeholder") continue;
        const decisionKey = `${key}/${flag.path}`;
        const decision = decisions.get(decisionKey);
        if (!decision) {
          error(decisionKey, "open placeholder flag has no decision in the confirmation file");
          continue;
        }
        usedDecisions.add(decisionKey);
        const before = getPath(doc, flag.path);
        if (decision.action === "confirm") {
          if (JSON.stringify(canonical(before)) !== JSON.stringify(canonical(decision.value))) error(decisionKey, "the stored value differs from the confirmed value");
          flag.status = "confirmed_correct";
        } else {
          const { value, removed } = removeSampleParagraphs(before);
          if (removed.length !== 1) error(decisionKey, `expected exactly one sample paragraph, found ${removed.length}`);
          if (!value) error(decisionKey, "nothing would remain after removing the sample paragraph");
          setPath(doc, flag.path, value);
          flag.status = "replaced";
          edits.push({ collection, id: idOf(doc), label: doc.slug ?? doc.key, path: flag.path, before, after: value, removed });
        }
        flag.resolvedAt = approvedAt;
        flag.resolvedBy = null;
        flag.note = `Owner launch confirmation ${manifest.confirmedAt}`;
      }

      if (collection === "site_settings") applyContact(doc, manifest.contact, key, error);

      doc.status = "published";
      doc.review = { status: "approved", reviewedBy: null, reviewedAt: approvedAt, note: reviewNote };

      for (const { path, value } of scanStrings(doc, "", [])) {
        if (SAMPLE_MARKERS.test(value)) error(`${key}/${path}`, "sample text marker remains");
      }
      docs.push({ collection, id: idOf(doc), label: doc.slug ?? doc.key ?? doc.question ?? `sortOrder ${doc.sortOrder}`, doc });
    }
  }

  const stagingKeys = new Set(PROMOTED_COLLECTIONS.flatMap((c) => (staging[c] ?? []).map((d) => `${c}/${idOf(d)}`)));
  for (const key of listed) if (!stagingKeys.has(key)) error(key, "confirmed record does not exist in staging");
  for (const key of decisions.keys()) if (!usedDecisions.has(key)) error(key, "decision does not match an open placeholder flag");
  for (const manifestId of mediaDecisions.keys()) if (!(staging.media_assets ?? []).some((m) => m.manifestId === manifestId)) error(`media_assets/${manifestId}`, "approved media does not exist in staging");

  await validateDocs(docs, error);

  for (const entry of docs) {
    entry.doc.migration = { ...(entry.doc.migration ?? {}), importChecksum: null };
    entry.doc.migration.importChecksum = promotionChecksum(entry.doc);
  }
  const counts = Object.fromEntries(PROMOTED_COLLECTIONS.map((c) => [c, docs.filter((d) => d.collection === c).length]));
  const planHash = sha256({ manifest: createHash("sha256").update(manifestText).digest("hex"), docs: docs.map((d) => ({ collection: d.collection, id: d.id, checksum: d.doc.migration.importChecksum })) });
  return { issues, docs, edits, counts, planHash, excluded: EXCLUDED_COLLECTIONS };
}

function applyContact(doc, confirmed, key, error) {
  const contact = doc.contact ?? {};
  for (const field of ["address", "phoneNumber", "lineId"]) {
    if ((contact[field] ?? null) !== confirmed[field]) error(`${key}/contact.${field}`, "stored value differs from the confirmed value");
  }
  for (const [field, value] of Object.entries(confirmed.openingHours)) {
    if (JSON.stringify(canonical(doc.openingHours?.[field])) !== JSON.stringify(canonical(value))) error(`${key}/openingHours.${field}`, "stored value differs from the confirmed value");
  }
  if (!getPhoneHref(confirmed.phoneNumber)) error(`${key}/contact.phoneNumber`, "confirmed phone number does not pass validation");
  if (!lineUrlFromId(confirmed.lineId)) error(`${key}/contact.lineId`, "confirmed LINE id does not pass validation");
  if (reviewMapsUrl(confirmed.directionsUrl) !== confirmed.directionsUrl) error(`${key}/contact.directionsUrl`, "confirmed Maps link does not pass validation");
  doc.contact = { ...contact, directionsUrl: confirmed.directionsUrl, verified: true };
  const links = confirmed.socialLinks.map((link) => ({ platform: link.platform, url: link.url, verified: link.verified === true }));
  for (const link of links) {
    const parsed = reviewSocialLink(link);
    if (!parsed) error(`${key}/socialLinks.${link.platform}`, "confirmed social link does not pass validation");
    else if (parsed.href !== link.url) error(`${key}/socialLinks.${link.platform}`, "confirmed social link must be stored without tracking parameters");
  }
  doc.socialLinks = links;
}

// Schema (with the publish rules), public visibility, and references.
export async function validateDocs(docs, error) {
  const media = new Map(docs.filter((d) => d.collection === "media_assets").map((d) => [d.id, d.doc]));
  const categories = new Set(docs.filter((d) => d.collection === "categories").map((d) => d.id));
  for (const { collection, id, doc } of docs) {
    const key = `${collection}/${id}`;
    try {
      await new modelsByCollection[collection](doc).validate();
    } catch (e) {
      error(key, `schema: ${Object.values(e.errors ?? {}).map((x) => `${x.path}: ${x.message}`).join("; ") || e.message}`);
    }
    if (collection === "media_assets") {
      if (!isMediaPubliclyUsable(doc)) error(key, "media does not pass the public media rule");
      continue;
    }
    if (!isPubliclyVisible(doc)) error(key, "record does not pass the public publication rule");
    for (const { path, ref } of collectImageRefs(doc)) {
      if (!ref.assetId) continue;
      const assetId = isObjectId(ref.assetId) ? ref.assetId.toHexString() : String(ref.assetId);
      if (!media.has(assetId)) error(`${key}/${path}`, "media reference does not resolve to a promoted asset");
    }
    if (collection === "sacred_items" && doc.categoryId) {
      const categoryId = isObjectId(doc.categoryId) ? doc.categoryId.toHexString() : String(doc.categoryId);
      if (!categories.has(categoryId)) error(`${key}/categoryId`, "category reference does not resolve to a promoted category");
    }
  }
}

export { CONTENT_COLLECTIONS };
