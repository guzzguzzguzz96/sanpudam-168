// Builds the MongoDB migration plan from local files only (no connection).
// Every record gets a deterministic _id, references are resolved to those
// _ids, and every document is validated against its Mongoose model.
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { modelsByCollection } from "../../../src/models/index.js";

export const IMPORT_ORDER = [
  "media_assets", "categories", "site_settings", "pages", "sacred_items", "news",
  "banners", "gallery_items", "faqs", "videos", "reviews", "team_members",
];
export const CONTENT_COLLECTIONS = IMPORT_ORDER.slice(1);

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Same form for planned docs and docs read back from a database:
// ObjectId -> hex string, Date -> ISO string.
export const normalize = (doc) => JSON.parse(JSON.stringify(doc));

// Checksum of the editable content of a stored document (what a CMS edit
// would change). Excludes identity, timestamps, and migration bookkeeping.
export function contentChecksum(doc) {
  const { _id, __v, createdAt, updatedAt, migration, ...rest } = normalize(doc);
  void _id, void __v, void createdAt, void updatedAt, void migration;
  return sha256(stableStringify(rest));
}

// The document as the model would store it (casts and schema defaults
// applied). Import checksums are computed on this form so a record read back
// from the database checksums identically.
export function shapeForStorage(collection, doc) {
  const Model = modelsByCollection[collection];
  return normalize(new Model(doc).toObject({ depopulate: true }));
}

export const mediaImportId = (manifestId) => sha256(`sanpudam168:media:${manifestId}`).slice(0, 24);

function convertImageRef(ref, mediaById, issues, where) {
  if (!ref) return null;
  const media = ref.assetManifestId ? mediaById.get(ref.assetManifestId) : null;
  const shaMatches = media && (!ref.assetSha256 || ref.assetSha256 === media.contentHash.sha256);
  if (!media || !shaMatches) {
    issues.push({ severity: "error", where, message: `media reference ${ref.assetManifestId ?? "(none)"} cannot be resolved${media ? " (SHA-256 mismatch)" : ""}` });
  }
  return {
    assetId: media && shaMatches ? media._id : null,
    alt: ref.alt ?? "",
    caption: ref.caption ?? null,
    focalPoint: ref.focalPoint ?? null,
    mediaMapping: {
      status: media && shaMatches ? "resolved" : "missing",
      manifestId: ref.assetManifestId ?? null,
      legacyUrl: ref.mediaMapping?.legacyUrl ?? null,
      legacyMobileUrl: ref.mediaMapping?.legacyMobileUrl ?? null,
      legacyWidth: ref.mediaMapping?.legacyWidth ?? null,
      legacyHeight: ref.mediaMapping?.legacyHeight ?? null,
      note: ref.mediaMapping?.note ?? null,
    },
  };
}

// Replaces every source ImageRef (has assetManifestId) with a schema ImageRef.
function convertImageRefs(value, mediaById, issues, where) {
  if (Array.isArray(value)) return value.map((item, index) => convertImageRefs(item, mediaById, issues, `${where}[${index}]`));
  if (value && typeof value === "object") {
    if ("assetManifestId" in value) return convertImageRef(value, mediaById, issues, where);
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, convertImageRefs(inner, mediaById, issues, `${where}.${key}`)]));
  }
  return value;
}

function buildMediaDoc(asset) {
  const _id = mediaImportId(asset.manifestId);
  const doc = {
    _id,
    manifestId: asset.manifestId,
    category: asset.category,
    resourceType: asset.resourceType,
    cloudinary: { ...asset.cloudinary },
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    contentHash: { ...asset.contentHash },
    defaultAlt: asset.defaultAlt ?? null,
    source: { type: asset.source.type, url: asset.source.url, originalFilename: asset.source.originalFilename, pages: asset.source.pages ?? [] },
    legacy: { key: `media:manifest:${asset.manifestId}`, mediaUrls: asset.legacy?.mediaUrls ?? [], references: asset.legacy?.references ?? [] },
    rights: {
      status: asset.rights?.status ?? "pending_owner_confirmation",
      containsIdentifiablePeople: Boolean(asset.rights?.containsIdentifiablePeople),
      consent: asset.rights?.consent ?? { status: "not_required" },
      notes: asset.rights?.notes ?? [],
    },
    approval: { status: asset.approval?.status ?? "pending" },
    importedAt: asset.importedAt ?? null, // Cloudinary upload time
    cloudinaryImport: { runId: asset.migration?.runId ?? null, importRoot: asset.migration?.importRoot ?? null },
  };
  return doc;
}

export async function buildMigrationPlan({ mediaMapping, content }) {
  const issues = [];
  const records = [];

  // 1. media_assets: one record per file, never per usage.
  const mediaById = new Map();
  for (const asset of mediaMapping.assets) {
    if (mediaById.has(asset.manifestId)) {
      issues.push({ severity: "error", where: `media_assets:${asset.manifestId}`, message: "duplicate manifest ID in mapping" });
      continue;
    }
    const doc = buildMediaDoc(asset);
    mediaById.set(asset.manifestId, doc);
    records.push({ collection: "media_assets", doc });
  }

  // 2. content in dependency order.
  const categoryIds = new Set((content.categories ?? []).map((record) => record.importId));
  const logoAssociation = mediaMapping.assets
    .flatMap((asset) => asset.suggestedAssociations.map((a) => ({ ...a, manifestId: asset.manifestId })))
    .find((a) => a.collection === "site_settings" && a.field === "branding.logo");

  for (const collection of CONTENT_COLLECTIONS) {
    for (const record of content[collection] ?? []) {
      const where = `${collection}:${record.slug ?? record.key ?? record.legacy?.id}`;
      const { importId, migration, ...fields } = record;
      if (fields.status !== "draft" || fields.review?.status !== "pending_review") {
        issues.push({ severity: "error", where, message: "source record is not draft / pending_review" });
      }
      const doc = convertImageRefs(fields, mediaById, issues, where);
      doc._id = importId;
      doc.status = "draft";
      doc.review = { status: "pending_review" };

      if (collection === "sacred_items") {
        if (!doc.categoryId || !categoryIds.has(doc.categoryId)) {
          issues.push({ severity: "error", where, message: `category reference ${doc.categoryId ?? "(none)"} does not resolve` });
        }
      }
      if (collection === "site_settings" && !doc.branding?.logo && logoAssociation) {
        // Planned association: the legacy CMS had no logo field.
        doc.branding.logo = convertImageRef(
          { assetManifestId: logoAssociation.manifestId, alt: "", mediaMapping: { note: "Assigned from the media mapping; no legacy CMS field." } },
          mediaById, issues, `${where}.branding.logo`,
        );
      }
      doc.migration = { preparedAt: migration?.preparedAt ?? null };
      records.push({ collection, doc });
    }
  }

  // Source checksum of every planned document (before runtime bookkeeping).
  for (const record of records) {
    record.doc.migration = { ...(record.doc.migration ?? {}), sourceChecksum: contentChecksum(record.doc) };
    record.importId = String(record.doc._id);
    record.legacyKey = record.doc.legacy?.key ?? null;
  }

  // Identity checks: _id unique overall; legacy.key and slug unique per collection.
  const seenIds = new Map();
  const seenKeys = new Map();
  for (const { collection, doc, importId, legacyKey } of records) {
    if (!/^[0-9a-f]{24}$/.test(importId)) issues.push({ severity: "error", where: `${collection}:${importId}`, message: "import ID is not a 24-character hex ObjectId" });
    if (seenIds.has(importId)) issues.push({ severity: "error", where: `${collection}:${importId}`, message: `duplicate import ID (also ${seenIds.get(importId)})` });
    seenIds.set(importId, collection);
    for (const [label, value] of [["legacy.key", legacyKey], ["slug", doc.slug]]) {
      if (!value) continue;
      const key = `${collection}|${label}|${value}`;
      if (seenKeys.has(key)) issues.push({ severity: "error", where: `${collection}:${value}`, message: `duplicate ${label}` });
      seenKeys.set(key, true);
    }
  }

  // Schema validation with the real Mongoose models (offline).
  for (const record of records) {
    const Model = modelsByCollection[record.collection];
    let error = null;
    try {
      await new Model(record.doc).validate();
    } catch (caught) {
      error = caught;
    }
    if (error?.errors) {
      for (const [path, detail] of Object.entries(error.errors)) {
        issues.push({ severity: "error", where: `${record.collection}:${record.importId}`, message: `schema: ${path}: ${detail.message}` });
      }
    }
  }

  // Usage check: every mapping association must be present in the plan.
  const docsById = new Map(records.map((r) => [r.importId, r]));
  let resolvedUsages = 0;
  for (const asset of mediaMapping.assets) {
    const media = mediaById.get(asset.manifestId);
    for (const association of asset.suggestedAssociations) {
      const target = docsById.get(association.importId);
      const ref = target && getPath(target.doc, association.field);
      if (ref?.assetId && String(ref.assetId) === String(media._id)) resolvedUsages++;
      else issues.push({ severity: "error", where: `${association.collection}:${association.record}`, message: `media usage ${asset.manifestId} -> ${association.field} is not resolved in the plan` });
    }
  }

  // Missing-media indicators that must stay explicit.
  for (const { collection, doc } of records) {
    if (collection === "videos" && !doc.videoAssetId) {
      issues.push({ severity: "warning", where: `videos:${doc.legacy.id}`, message: `video file missing (videoMapping.status=${doc.videoMapping?.status}); stays draft` });
    }
  }

  const ordered = IMPORT_ORDER.flatMap((collection) => records.filter((r) => r.collection === collection));
  const planHash = sha256(stableStringify(ordered.map((r) => ({ collection: r.collection, doc: normalize(r.doc) }))));
  const counts = Object.fromEntries(IMPORT_ORDER.map((c) => [c, ordered.filter((r) => r.collection === c).length]));
  return {
    records: ordered,
    counts,
    totals: { media: counts.media_assets, content: ordered.length - counts.media_assets, all: ordered.length },
    resolvedUsages,
    placeholderFields: ordered.reduce((total, r) => total + (r.doc.placeholderFields?.length ?? 0), 0),
    issues,
    planHash,
  };
}

// Reads "a.b[0].c" style paths.
export function getPath(object, path) {
  return path.split(/\.|\[(\d+)\]/).filter((part) => part !== undefined && part !== "").reduce((value, key) => (value == null ? undefined : value[key]), object);
}

export function loadPlanInputs(readJson, fromRoot) {
  const mediaMapping = readJson(fromRoot("migration/manifests/media-assets-mapping.json"));
  if (!mediaMapping) throw new Error("migration/manifests/media-assets-mapping.json is missing (run build-media-mapping.mjs).");
  const content = {};
  for (const collection of CONTENT_COLLECTIONS) {
    const file = readJson(fromRoot("migration/content", `${collection}.json`));
    if (!file) throw new Error(`migration/content/${collection}.json is missing (run build-content.mjs).`);
    content[collection] = file.records;
  }
  return { mediaMapping, content };
}

export const isObjectId = (value) => mongoose.isValidObjectId(value);
