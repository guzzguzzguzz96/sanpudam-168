// Applies a promotion plan to a target adapter and verifies the result.
//
// Adapter: { findById(collection, id), insert(collection, doc),
//            replace(collection, doc), list(collection) }
// Results per record:
//   created    not in production yet
//   unchanged  identical to the plan (re-runs are no-ops)
//   updated    production copy unedited since the last promotion
//              (its stored importChecksum still matches its content)
//   conflict   edited in production after promotion: never overwritten
// write=false computes the same results without writing (dry run).
import { canonical, clone, promotionChecksum, validateDocs } from "./promotion-plan.mjs";

export const PROBLEM_RESULTS = new Set(["conflict", "error"]);
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export async function applyPromotion(plan, adapter, { write = true } = {}) {
  const results = [];
  for (const { collection, id, label, doc } of plan.docs) {
    try {
      const existing = await adapter.findById(collection, doc._id);
      if (!existing) {
        if (write) await adapter.insert(collection, doc);
        results.push({ collection, id, label, result: "created" });
      } else if (same(existing, doc)) {
        results.push({ collection, id, label, result: "unchanged" });
      } else if (existing.migration?.importChecksum && existing.migration.importChecksum === promotionChecksum(existing)) {
        if (write) await adapter.replace(collection, doc);
        results.push({ collection, id, label, result: "updated" });
      } else {
        results.push({ collection, id, label, result: "conflict", message: "edited in production after promotion; not overwritten" });
      }
    } catch (error) {
      results.push({ collection, id, label, result: "error", message: error.message });
    }
  }
  return results;
}

export function countResults(results) {
  return results.reduce((counts, r) => ({ ...counts, [r.result]: (counts[r.result] ?? 0) + 1 }), {});
}

// Reads back every planned record: present, identical to the plan, and
// still passing the schema, public rules, and references.
export async function verifyPromotion(plan, adapter) {
  const problems = [];
  const stored = [];
  for (const { collection, id, doc } of plan.docs) {
    const found = await adapter.findById(collection, doc._id);
    if (!found) problems.push(`${collection}/${id}: missing after apply`);
    else {
      if (!same(found, doc)) problems.push(`${collection}/${id}: differs from the plan`);
      stored.push({ collection, id, doc: found });
    }
  }
  await validateDocs(stored, (where, message) => problems.push(`${where}: ${message}`));
  const counts = {};
  for (const collection of Object.keys(plan.counts)) counts[collection] = (await adapter.list(collection)).length;
  for (const [collection, expected] of Object.entries(plan.counts)) {
    if (counts[collection] < expected) problems.push(`${collection}: ${counts[collection]} documents, expected at least ${expected}`);
  }
  return { passed: problems.length === 0, problems, counts };
}

// In-memory adapter (tests and the offline simulation).
export function createMemoryPromotionAdapter() {
  const store = new Map();
  const table = (collection) => store.get(collection) ?? store.set(collection, new Map()).get(collection);
  const key = (id) => (typeof id?.toHexString === "function" ? id.toHexString() : String(id));
  const copy = (doc) => (doc ? clone(doc) : null);
  return {
    store,
    async findById(collection, id) {
      return copy(table(collection).get(key(id)));
    },
    async insert(collection, doc) {
      if (table(collection).has(key(doc._id))) throw new Error("duplicate _id");
      table(collection).set(key(doc._id), copy(doc));
    },
    async replace(collection, doc) {
      table(collection).set(key(doc._id), copy(doc));
    },
    async list(collection) {
      return [...table(collection).values()].map(copy);
    },
  };
}

// Native-driver adapter for the production database (apply only).
export function createDriverPromotionAdapter(db) {
  return {
    findById: (collection, id) => db.collection(collection).findOne({ _id: id }),
    insert: (collection, doc) => db.collection(collection).insertOne(doc),
    replace: (collection, doc) => db.collection(collection).replaceOne({ _id: doc._id }, doc),
    list: (collection) => db.collection(collection).find({}, { projection: { _id: 1 } }).toArray(),
  };
}
