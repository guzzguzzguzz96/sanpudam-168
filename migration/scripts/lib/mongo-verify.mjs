// Read-only integrity check of the records stored in the target database
// against the migration plan. Used by the preflight after an import.
import { getPath, normalize } from "./mongo-plan.mjs";

const isImageRef = (value) => value && typeof value === "object" && "mediaMapping" in value && "alt" in value;

function collectRefs(value, path = "", out = []) {
  if (Array.isArray(value)) value.forEach((item, index) => collectRefs(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object") {
    if (isImageRef(value)) {
      if (value.assetId) out.push({ path, assetId: String(value.assetId) });
    } else for (const [key, inner] of Object.entries(value)) collectRefs(inner, path ? `${path}.${key}` : key, out);
  }
  return out;
}

// readDb: { find(collection, filter, { limit }) } returning stored documents.
export async function verifyStoredState(plan, readDb) {
  const planned = new Map();
  for (const record of plan.records) {
    if (!planned.has(record.collection)) planned.set(record.collection, new Map());
    planned.get(record.collection).set(record.importId, record);
  }

  const stored = new Map();
  const collections = {};
  for (const [collection, records] of planned) {
    const docs = (await readDb.find(collection, {}, { limit: 5000 })).map(normalize);
    stored.set(collection, new Map(docs.map((d) => [String(d._id), d])));
    const ids = new Set(docs.map((d) => String(d._id)));
    collections[collection] = {
      planned: records.size,
      found: [...records.keys()].filter((id) => ids.has(id)).length,
      missing: [...records.keys()].filter((id) => !ids.has(id)),
      unexpected: docs.filter((d) => !records.has(String(d._id))).map((d) => String(d._id)),
    };
  }

  const mediaIds = new Set(stored.get("media_assets")?.keys() ?? []);
  const categoryIds = new Set(stored.get("categories")?.keys() ?? []);
  const media = { references: 0, resolved: 0, broken: [] };
  const categories = { references: 0, resolved: 0, broken: [] };
  const content = { records: 0, draft: 0, pendingReview: 0, placeholderFields: 0, openPlaceholders: 0, legacyPublished: 0 };
  const cloudinary = { records: 0, publicIdMatches: 0, secureUrlMatches: 0, assetIdMatches: 0 };
  let logoMapped = false;
  let videoMissingFlagged = false;

  for (const [collection, docs] of stored) {
    for (const doc of docs.values()) {
      const plannedDoc = planned.get(collection)?.get(String(doc._id))?.doc;
      if (collection === "media_assets") {
        cloudinary.records++;
        if (plannedDoc && doc.cloudinary?.publicId === plannedDoc.cloudinary.publicId) cloudinary.publicIdMatches++;
        if (plannedDoc && doc.cloudinary?.secureUrl === plannedDoc.cloudinary.secureUrl) cloudinary.secureUrlMatches++;
        if (plannedDoc && doc.cloudinary?.assetId === plannedDoc.cloudinary.assetId) cloudinary.assetIdMatches++;
        continue;
      }
      content.records++;
      if (doc.status === "draft") content.draft++;
      if (doc.review?.status === "pending_review") content.pendingReview++;
      if (doc.legacy?.isPublished) content.legacyPublished++;
      content.placeholderFields += (doc.placeholderFields ?? []).length;
      content.openPlaceholders += (doc.placeholderFields ?? []).filter((p) => p.status === "placeholder").length;
      for (const ref of collectRefs(doc)) {
        media.references++;
        if (mediaIds.has(ref.assetId)) media.resolved++;
        else media.broken.push(`${collection}:${doc._id}:${ref.path}`);
      }
      if (collection === "sacred_items") {
        categories.references++;
        if (doc.categoryId && categoryIds.has(String(doc.categoryId))) categories.resolved++;
        else categories.broken.push(String(doc._id));
      }
      if (collection === "site_settings" && getPath(doc, "branding.logo.assetId")) logoMapped = mediaIds.has(String(doc.branding.logo.assetId));
      if (collection === "videos" && !doc.videoAssetId && doc.videoMapping?.status !== "resolved") videoMissingFlagged = true;
    }
  }

  const imported = Object.values(collections).some((c) => c.found > 0);
  const checks = {
    allPlannedRecordsPresent: Object.values(collections).every((c) => c.missing.length === 0),
    noUnexpectedRecords: Object.values(collections).every((c) => c.unexpected.length === 0),
    mediaReferencesResolve: media.references === plan.resolvedUsages && media.broken.length === 0,
    categoryReferencesResolve: categories.broken.length === 0 && categories.references === (planned.get("sacred_items")?.size ?? 0),
    placeholdersPreserved: content.placeholderFields === plan.placeholderFields,
    allContentDraft: content.draft === content.records,
    allContentPendingReview: content.pendingReview === content.records,
    cloudinaryPreserved: cloudinary.records > 0 && cloudinary.publicIdMatches === cloudinary.records && cloudinary.secureUrlMatches === cloudinary.records && cloudinary.assetIdMatches === cloudinary.records,
    logoMapped,
    videoMissingFlagged,
  };
  return { imported, passed: imported && Object.values(checks).every(Boolean), checks, collections, media, categories, content, cloudinary };
}
