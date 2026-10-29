// Storage adapters for applyPlan(). Both validate with the real Mongoose
// models and enforce the schema's unique indexes. Neither has a delete method.
import { modelsByCollection } from "../../../src/models/index.js";
import { contentChecksum, getPath, normalize } from "./mongo-plan.mjs";

const matches = (doc, filter) => Object.entries(filter).every(([path, value]) => {
  const actual = getPath(doc, path);
  return actual !== undefined && String(actual) === String(value);
});

// Unique index definitions of a model (path-level unique and schema.index).
function uniqueKeys(Model) {
  return Model.schema.indexes()
    .filter(([, options]) => options?.unique)
    .map(([fields, options]) => ({ paths: Object.keys(fields), partialString: Boolean(options.partialFilterExpression) }));
}

// In-memory adapter for tests and offline simulations.
export function createMemoryAdapter({ failOnInsertNumber = null } = {}) {
  const store = new Map();
  const runs = new Map();
  let inserts = 0;
  const table = (collection) => store.get(collection) ?? store.set(collection, new Map()).get(collection);

  return {
    store,
    runs,
    async findById(collection, id) {
      return table(collection).get(String(id)) ?? null;
    },
    async findOne(collection, filter) {
      for (const doc of table(collection).values()) if (matches(doc, filter)) return doc;
      return null;
    },
    async insert(collection, doc) {
      inserts++;
      if (failOnInsertNumber && inserts === failOnInsertNumber) throw new Error("simulated failure during insert");
      const Model = modelsByCollection[collection];
      const model = new Model(doc);
      await model.validate();
      const now = new Date();
      const plain = normalize({ ...model.toObject({ depopulate: true }), createdAt: now, updatedAt: now });
      const rows = table(collection);
      if (rows.has(String(plain._id))) throw new Error(`E11000 duplicate key: _id ${plain._id}`);
      for (const { paths, partialString } of uniqueKeys(Model)) {
        const key = paths.map((p) => getPath(plain, p));
        if (partialString && key.some((v) => typeof v !== "string")) continue;
        for (const other of rows.values()) {
          if (paths.every((p, i) => String(getPath(other, p)) === String(key[i]))) throw new Error(`E11000 duplicate key: ${paths.join(",")}`);
        }
      }
      rows.set(String(plain._id), plain);
    },
    async replaceIfUnchanged(collection, id, expectedImportChecksum, doc) {
      const rows = table(collection);
      const current = rows.get(String(id));
      if (!current || current.migration?.importChecksum !== expectedImportChecksum || contentChecksum(current) !== expectedImportChecksum) return false;
      const Model = modelsByCollection[collection];
      const model = new Model(doc);
      await model.validate();
      rows.set(String(id), normalize({ ...model.toObject({ depopulate: true }), createdAt: current.createdAt, updatedAt: new Date() }));
      return true;
    },
    async saveRun(run) {
      runs.set(run.runId, normalize(run));
    },
    // Test helper: simulate a CMS edit after import.
    edit(collection, id, mutate) {
      const doc = table(collection).get(String(id));
      mutate(doc);
      doc.updatedAt = new Date().toISOString();
    },
  };
}

// Mongoose adapter for a verified staging connection (not used in this phase).
export function createMongooseAdapter() {
  return {
    async findById(collection, id) {
      return modelsByCollection[collection].findById(id).lean();
    },
    async findOne(collection, filter) {
      return modelsByCollection[collection].findOne(filter).lean();
    },
    async insert(collection, doc) {
      await modelsByCollection[collection].create(doc); // validates; fails on duplicate keys
    },
    async replaceIfUnchanged(collection, id, expectedImportChecksum, doc) {
      const Model = modelsByCollection[collection];
      const current = await Model.findById(id).lean();
      if (!current || current.migration?.importChecksum !== expectedImportChecksum || contentChecksum(current) !== expectedImportChecksum) return false;
      await new Model(doc).validate();
      // Guarded on the stored import checksum and version so a concurrent edit is never overwritten.
      const result = await Model.collection.replaceOne(
        { _id: current._id, "migration.importChecksum": expectedImportChecksum, __v: current.__v },
        { ...new Model(doc).toObject({ depopulate: true }), createdAt: current.createdAt, updatedAt: new Date(), __v: (current.__v ?? 0) + 1 },
      );
      return result.modifiedCount === 1;
    },
    async saveRun(run) {
      await modelsByCollection.migration_runs.updateOne({ runId: run.runId }, { $set: run }, { upsert: true, runValidators: true });
    },
  };
}
