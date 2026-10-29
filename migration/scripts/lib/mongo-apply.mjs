// Applies a migration plan through a storage adapter (Mongoose for a real
// staging database, in-memory for tests). Never deletes. Never overwrites a
// record that was edited after import.
import { contentChecksum, normalize, shapeForStorage } from "./mongo-plan.mjs";

// Reference fields that must exist in the target before a record is written.
export function referencesOf(collection, doc) {
  const refs = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if ("mediaMapping" in value && "alt" in value) {
        if (value.assetId) refs.push({ collection: "media_assets", id: String(value.assetId) });
      } else Object.values(value).forEach(visit);
    }
  };
  visit(doc);
  if (collection === "sacred_items" && doc.categoryId) refs.push({ collection: "categories", id: String(doc.categoryId) });
  if (collection === "videos" && doc.videoAssetId) refs.push({ collection: "media_assets", id: String(doc.videoAssetId) });
  return refs;
}

// Natural keys that identify a record independently of its _id.
function identityFilters(collection, doc) {
  if (collection === "media_assets") return [{ "contentHash.sha256": doc.contentHash.sha256 }, { "cloudinary.publicId": doc.cloudinary.publicId }];
  const filters = [];
  if (doc.legacy?.key) filters.push({ "legacy.key": doc.legacy.key });
  if (doc.slug) filters.push({ slug: doc.slug });
  return filters;
}

const editedSinceImport = (existing) =>
  Boolean(existing.migration?.editedAfterImport) || (existing.migration?.importChecksum ?? null) !== contentChecksum(existing);

export async function applyPlan(plan, adapter, { runId, now = () => new Date(), updateUnedited = false, write = true } = {}) {
  const results = [];
  // In preview mode (write=false), records this run would create count as
  // present for the records that depend on them.
  const wouldExist = new Set();
  const exists = async (collection, id) => wouldExist.has(`${collection}:${id}`) || Boolean(await adapter.findById(collection, id));
  for (const record of plan.records) {
    const { collection, doc } = record;
    const base = { collection, importId: record.importId, legacyKey: record.legacyKey };
    try {
      // 1. relationships must already exist in the target
      const missing = [];
      for (const ref of referencesOf(collection, doc)) {
        if (!(await exists(ref.collection, ref.id))) missing.push(`${ref.collection}:${ref.id}`);
      }

      const existing = normalizeOrNull(await adapter.findById(collection, record.importId));
      const plannedSource = doc.migration.sourceChecksum;

      if (!existing) {
        // A different _id holding the same natural identity is a duplicate.
        let duplicate = null;
        for (const filter of identityFilters(collection, doc)) {
          const found = await adapter.findOne(collection, filter);
          if (found && String(found._id) !== record.importId) duplicate = `${Object.keys(filter)[0]} already used by ${found._id}`;
        }
        if (duplicate) {
          results.push({ ...base, result: "conflict", message: duplicate });
          continue;
        }
        if (missing.length) {
          results.push({ ...base, result: write ? "blocked_missing_reference" : "would_block", message: `missing: ${missing.join(", ")}` });
          continue;
        }
        if (!write) {
          wouldExist.add(`${collection}:${record.importId}`);
          results.push({ ...base, result: "would_create" });
          continue;
        }
        const importedAt = now();
        const toInsert = { ...doc, migration: { ...doc.migration, runId, importedAt, importChecksum: contentChecksum(shapeForStorage(collection, doc)), editedAfterImport: false } };
        await adapter.insert(collection, toInsert);
        // Verify the stored record and its references before reporting success.
        const stored = await adapter.findById(collection, record.importId);
        const stillMissing = [];
        for (const ref of referencesOf(collection, doc)) if (!(await adapter.findById(ref.collection, ref.id))) stillMissing.push(ref.id);
        if (!stored || stillMissing.length) {
          results.push({ ...base, result: "verify_failed", message: !stored ? "record not found after insert" : `references missing after insert: ${stillMissing.join(", ")}` });
          continue;
        }
        results.push({ ...base, result: "created" });
        continue;
      }

      const sourceChanged = existing.migration?.sourceChecksum !== plannedSource;
      const edited = editedSinceImport(existing);
      if (!sourceChanged && !edited) results.push({ ...base, result: "unchanged" });
      else if (!sourceChanged && edited) results.push({ ...base, result: "edited_in_cms", message: "record was edited after import; left untouched" });
      else if (edited) results.push({ ...base, result: "conflict", message: "source changed and the record was edited after import; not overwritten" });
      else if (!updateUnedited || !write) results.push({ ...base, result: "source_changed", message: "source changed; re-run with --update-unedited to refresh this unedited record" });
      else if (missing.length) results.push({ ...base, result: "blocked_missing_reference", message: `missing: ${missing.join(", ")}` });
      else {
        const importedAt = now();
        const replacement = { ...doc, migration: { ...doc.migration, runId, importedAt, importChecksum: contentChecksum(shapeForStorage(collection, doc)), editedAfterImport: false } };
        // Guarded replace: only if the stored record is still exactly as imported.
        const replaced = await adapter.replaceIfUnchanged(collection, record.importId, existing.migration.importChecksum, replacement);
        results.push({ ...base, result: replaced ? "updated" : "conflict", message: replaced ? undefined : "record changed during the run; not overwritten" });
      }
    } catch (error) {
      results.push({ ...base, result: "failed", message: String(error.message ?? error).slice(0, 300) });
    }
  }
  return results;
}

function normalizeOrNull(doc) {
  return doc ? normalize(doc) : null;
}

export const countResults = (results) => results.reduce((acc, r) => ({ ...acc, [r.result]: (acc[r.result] ?? 0) + 1 }), {});
export const PROBLEM_RESULTS = new Set(["conflict", "failed", "verify_failed", "blocked_missing_reference", "would_block"]);
