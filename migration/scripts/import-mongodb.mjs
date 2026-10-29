// MongoDB importer for the migrated legacy records (17 media + 39 content).
//
// Offline dry run (default; no credentials, no network):
//   node migration/scripts/import-mongodb.mjs
// Read-only staging preflight (native driver, read commands only; no
// collections, indexes, documents, or migration_runs are created):
//   node --env-file=.env.local migration/scripts/import-mongodb.mjs --preflight
// Apply to staging (future; needs explicit approval):
//   node --env-file=.env.local migration/scripts/import-mongodb.mjs --apply \
//     --plan-hash=<full hash> --confirm-db=<exact MONGODB_DB_NAME>
//
// Options: --update-unedited (refresh unedited records whose source changed)
//
// Guarantees: deterministic _ids; records default to draft / pending_review;
// relationships verified before success; no deletes; records edited after
// import are never overwritten; credentials and connection strings are never
// printed or stored.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { buildMigrationPlan, loadPlanInputs } from "./lib/mongo-plan.mjs";
import { PROBLEM_RESULTS, applyPlan, countResults } from "./lib/mongo-apply.mjs";
import { createMemoryAdapter, createMongooseAdapter } from "./lib/mongo-adapters.mjs";
import { assertConnectedTarget, resolveStagingTarget } from "./lib/db-target.mjs";
import { createReadOnlyAdapter, openReadOnlyDatabase } from "./lib/mongo-readonly.mjs";
import { fromRoot, parseArgs, readJson, writeJson } from "./lib/files.mjs";
import { modelsByCollection } from "../../src/models/index.js";
import { sanitizeError } from "../../src/lib/db.js";

const args = parseArgs();
const mode = args.flags.has("apply") ? "apply" : args.flags.has("preflight") ? "preflight" : "dry-run";
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;

const plan = await buildMigrationPlan(loadPlanInputs(readJson, fromRoot));
const errors = plan.issues.filter((i) => i.severity === "error");
const summary = {
  mode,
  runId,
  planHash: plan.planHash,
  totals: plan.totals,
  counts: plan.counts,
  resolvedMediaUsages: plan.resolvedUsages,
  placeholderFields: plan.placeholderFields,
  errors: errors.length,
  warnings: plan.issues.filter((i) => i.severity === "warning").length,
};

function report(name, extra) {
  const data = { ...summary, generatedAt: new Date().toISOString(), issues: plan.issues, ...extra };
  writeJson(fromRoot("migration/reports", `${name}.json`), data);
  return data;
}

if (mode === "dry-run") {
  // Offline simulation: import into an empty in-memory target, then re-run.
  const memory = createMemoryAdapter();
  const first = await applyPlan(plan, memory, { runId: `${runId}-sim1` });
  const second = await applyPlan(plan, memory, { runId: `${runId}-sim2` });
  const stored = [...memory.store.values()].flatMap((rows) => [...rows.values()]);
  const simulation = {
    firstRun: countResults(first),
    secondRun: countResults(second),
    storedRecords: stored.length,
    allDraftPendingReview: stored.filter((d) => d.status !== undefined).every((d) => d.status === "draft" && d.review?.status === "pending_review"),
    problems: [...first, ...second].filter((r) => PROBLEM_RESULTS.has(r.result)),
  };
  const data = report("mongodb-dry-run", { simulation, records: plan.records.map((r) => ({ collection: r.collection, importId: r.importId, legacyKey: r.legacyKey })) });
  writeFileSync(fromRoot("migration/reports/mongodb-dry-run.md"), [
    "# MongoDB import dry run (offline)",
    "",
    `Plan hash: \`${data.planHash}\`  `,
    "Target: none (no connection). Simulation used an in-memory store with the real Mongoose models.",
    "",
    `Records: ${plan.totals.all} (media ${plan.totals.media}, content ${plan.totals.content}); media usages resolved: ${plan.resolvedUsages}; placeholder fields: ${plan.placeholderFields}`,
    "",
    "| Collection | Records |",
    "|---|---:|",
    ...Object.entries(plan.counts).map(([c, n]) => `| ${c} | ${n} |`),
    "",
    `Simulation: first run ${JSON.stringify(simulation.firstRun)}, second run ${JSON.stringify(simulation.secondRun)}, stored ${simulation.storedRecords}, all draft/pending_review: ${simulation.allDraftPendingReview}`,
    "",
    "## Issues",
    "",
    ...(plan.issues.length ? plan.issues.map((i) => `- ${i.severity}: ${i.where}: ${i.message}`) : ["None."]),
    "",
  ].join("\n"));
  console.log(JSON.stringify({ ...summary, simulation: { firstRun: simulation.firstRun, secondRun: simulation.secondRun, storedRecords: simulation.storedRecords, allDraftPendingReview: simulation.allDraftPendingReview, problems: simulation.problems.length } }, null, 1));
  if (errors.length || simulation.problems.length) process.exitCode = 1;
} else {
  await runAgainstStaging();
}

async function runAgainstStaging() {
  // Fail closed before any connection.
  let target;
  try {
    target = resolveStagingTarget(process.env, { confirmDb: args.values["confirm-db"] ?? null, requireConfirmation: mode === "apply" });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (errors.length) {
    console.error(`The plan has ${errors.length} error(s); run the dry run and fix them first.`);
    process.exitCode = 1;
    return;
  }
  if (mode === "apply" && args.values["plan-hash"] !== plan.planHash) {
    console.error("--plan-hash does not match the current plan. Run the dry run again and review it.");
    process.exitCode = 1;
    return;
  }

  if (mode === "preflight") {
    await runReadOnlyPreflight(target);
    return;
  }

  // Apply (separately approved). autoCreate/autoIndex are off so collections
  // and indexes are only created by the explicit createIndexes() step below.
  try {
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
    await mongoose.connect(process.env.MONGODB_URI, { dbName: target.dbName, bufferCommands: false, autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    assertConnectedTarget(mongoose.connection, target.dbName);
  } catch (error) {
    console.error(`Connection failed: ${sanitizeError(error, process.env.MONGODB_URI).message}`);
    process.exitCode = 1;
    await mongoose.disconnect().catch(() => {});
    return;
  }

  const adapter = createMongooseAdapter();
  try {
    // Non-destructive index creation (never syncIndexes), then records in dependency order.
    for (const Model of Object.values(modelsByCollection)) await Model.createIndexes();
    const startedAt = new Date();
    await adapter.saveRun({ runId, track: "mongodb", mode: "apply", planHash: plan.planHash, targetDatabase: target.dbName, sourceType: "admin_ui_capture", status: "running", startedAt });
    const results = await applyPlan(plan, adapter, { runId, updateUnedited: args.flags.has("update-unedited") });
    const counts = countResults(results);
    const hasProblems = results.some((r) => PROBLEM_RESULTS.has(r.result));
    await adapter.saveRun({
      runId, track: "mongodb", mode: "apply", planHash: plan.planHash, targetDatabase: target.dbName, sourceType: "admin_ui_capture",
      status: hasProblems ? "completed_with_issues" : "completed", startedAt, finishedAt: new Date(), counts,
      items: results.map((r) => ({ collectionName: r.collection, importId: r.importId, legacyKey: r.legacyKey, result: r.result, message: r.message ?? null })),
    });
    report(`mongodb-apply-${runId}`, { target: { database: target.dbName }, counts, results });
    console.log(JSON.stringify({ ...summary, target: { database: target.dbName }, results: counts }, null, 1));
    if (hasProblems) process.exitCode = 2;
  } catch (error) {
    console.error(`Run failed: ${sanitizeError(error, process.env.MONGODB_URI).message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

// Read-only preflight: native driver, read commands only, no Mongoose
// connection (so no autoCreate/autoIndex), no migration_runs record.
async function runReadOnlyPreflight(target) {
  let ro;
  try {
    ro = await openReadOnlyDatabase(process.env.MONGODB_URI, target.dbName);
  } catch (error) {
    console.error(`Connection failed: ${sanitizeError(error, process.env.MONGODB_URI).message}`);
    process.exitCode = 1;
    return;
  }
  try {
    const access = await ro.connectionStatus();
    const collections = await ro.listCollections();
    const existing = new Set(collections.map((c) => c.name));
    const inventory = {};
    for (const name of [...existing].sort()) {
      inventory[name] = { documents: await ro.countDocuments(name), indexes: (await ro.indexes(name)).map((i) => ({ name: i.name, key: i.key, unique: Boolean(i.unique), partialFilterExpression: i.partialFilterExpression ?? null })) };
    }

    // Index compatibility: the indexes each model expects vs. what exists.
    const indexReport = {};
    for (const [collection, Model] of Object.entries(modelsByCollection)) {
      const actual = inventory[collection]?.indexes ?? [];
      const expected = Model.schema.indexes().map(([key, options]) => ({ key, unique: Boolean(options?.unique), partial: Boolean(options?.partialFilterExpression) }));
      const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      indexReport[collection] = {
        collectionExists: existing.has(collection),
        missing: expected.filter((e) => !actual.some((a) => sameKey(a.key, e.key))).map((e) => ({ key: e.key, unique: e.unique })),
        uniqueMismatch: expected.filter((e) => actual.some((a) => sameKey(a.key, e.key) && a.unique !== e.unique)).map((e) => e.key),
        unexpected: actual.filter((a) => a.name !== "_id_" && !expected.some((e) => sameKey(a.key, e.key))).map((a) => a.name),
      };
    }

    // Schema compatibility of documents already in the target collections.
    const schemaReport = {};
    for (const [collection, Model] of Object.entries(modelsByCollection)) {
      if (!existing.has(collection)) continue;
      const docs = await ro.find(collection, {}, { limit: 500 });
      let invalid = 0;
      for (const doc of docs) {
        try {
          await new Model(doc).validate();
        } catch {
          invalid++;
        }
      }
      schemaReport[collection] = { sampled: docs.length, invalid };
    }

    const results = await applyPlan(plan, createReadOnlyAdapter(ro), { runId, write: false });
    const counts = countResults(results);
    const violations = ro.violations();
    const data = report(`mongodb-preflight-${runId}`, {
      target: { database: ro.databaseName },
      access,
      collections: [...existing].sort(),
      inventory,
      indexReport,
      schemaReport,
      counts,
      results,
      readOnly: { commandsObserved: [...new Set(ro.observedCommands())].sort(), violations },
    });
    console.log(JSON.stringify({
      ...summary,
      target: data.target,
      access: { roles: access.roles, privilegeResources: access.privilegeResources },
      collections: data.collections,
      documents: Object.fromEntries(Object.entries(inventory).map(([k, v]) => [k, v.documents])),
      results: counts,
      readOnly: data.readOnly,
    }, null, 1));
    if (violations.length) {
      console.error(`Read-only violation: non-read commands observed (${violations.join(", ")}).`);
      process.exitCode = 1;
    } else if (results.some((r) => PROBLEM_RESULTS.has(r.result))) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`Preflight failed: ${sanitizeError(error, process.env.MONGODB_URI).message}`);
    process.exitCode = 1;
  } finally {
    await ro.close();
  }
}
