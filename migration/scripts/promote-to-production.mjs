// Staging-to-production promotion (docs/production-launch-th.md).
//
// Dry run (default; reads only):
//   node --env-file=.env.local --import ./tests/support/register.mjs \
//     migration/scripts/promote-to-production.mjs
// Apply (separately approved; writes sanpudam168_production only):
//   node --env-file=.env.local --import ./tests/support/register.mjs \
//     migration/scripts/promote-to-production.mjs --apply \
//     --plan-hash=<full hash from the dry run> --confirm-db=sanpudam168_production
//
// Options: --confirmation=<path> (default
//   migration/confirmations/owner-launch-confirmation.json)
//
// Accounts (never printed or stored):
//   CLIENT_REVIEW_MONGODB_URI / _DB_NAME   staging reader, read@sanpudam168_staging
//   PROMOTION_MONGODB_URI / _DB_NAME       production writer (sanpudam168_production
//                                          only); optional for the dry run, which
//                                          then reads production read-only to
//                                          report created/updated/unchanged
//   MONGODB_DNS_SERVERS                    optional resolvers for mongodb+srv
//
// Guarantees: staging is read through a read-command allowlist; the whole
// batch is refused when any record has an open placeholder, a sample
// marker, an unconfirmed value, or an unresolved reference; _ids are kept;
// re-runs are no-ops; production edits made after a promotion are never
// overwritten; videos, reviews, team members, migration runs, and the
// admin audit log are never promoted. Results go to
// migration/reports/promotion-*.json and production migration_runs.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { configureMongoDns } from "./lib/dns-config.mjs";
import { fromRoot, parseArgs, writeJson } from "./lib/files.mjs";
import { openReadOnlyDatabase } from "./lib/mongo-readonly.mjs";
import { PROMOTED_COLLECTIONS, buildPromotionPlan } from "./lib/promotion-plan.mjs";
import { PROBLEM_RESULTS, applyPromotion, countResults, createDriverPromotionAdapter, createMemoryPromotionAdapter, verifyPromotion } from "./lib/promotion-apply.mjs";
import { PRODUCTION_DATABASE, assertProductionWriter, assertStagingReader, resolvePromotionSource, resolvePromotionTarget } from "./lib/promotion-target.mjs";
import { MigrationRun, modelsByCollection } from "../../src/models/index.js";
import { sanitizeError } from "../../src/lib/db.js";

const args = parseArgs();
const mode = args.flags.has("apply") ? "apply" : "dry-run";
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const confirmationPath = args.values.confirmation ?? fromRoot("migration/confirmations/owner-launch-confirmation.json");
const secrets = [process.env.CLIENT_REVIEW_MONGODB_URI, process.env.PROMOTION_MONGODB_URI].filter(Boolean);
const clean = (error) => secrets.reduce((e, uri) => sanitizeError(e, uri), error).message;

function fail(message, code = 1) {
  console.error(message);
  process.exitCode = code;
}

async function main() {
  let source;
  let target;
  try {
    source = resolvePromotionSource(process.env);
    target = resolvePromotionTarget(process.env, { required: mode === "apply", confirmDb: args.values["confirm-db"] ?? null, requireConfirmation: mode === "apply" });
    const dns = configureMongoDns(process.env);
    console.error(dns.applied ? `DNS: using MONGODB_DNS_SERVERS (${dns.servers.join(", ")})` : "DNS: system default");
  } catch (error) {
    return fail(error.message);
  }

  let manifestText;
  let manifest;
  try {
    manifestText = readFileSync(confirmationPath, "utf8");
    manifest = JSON.parse(manifestText);
  } catch (error) {
    return fail(`Confirmation file could not be read: ${error.message}`);
  }

  // 1. Read staging (read-only, allowlisted commands, read@staging only).
  const staging = {};
  let reader;
  try {
    reader = await openReadOnlyDatabase(source.uri, source.dbName);
    assertStagingReader((await reader.connectionStatus()).roles);
    for (const collection of PROMOTED_COLLECTIONS) staging[collection] = await reader.find(collection, {}, { limit: 1000 });
    if (reader.violations().length) throw new Error(`non-read commands observed on staging: ${reader.violations().join(", ")}`);
  } catch (error) {
    return fail(`Staging read failed: ${clean(error)}`);
  } finally {
    await reader?.close();
  }

  // 2. Plan and validate (rejects the whole batch on any error).
  const plan = await buildPromotionPlan(staging, manifest, { manifestText });
  const errors = plan.issues.filter((i) => i.severity === "error");
  const summary = { mode, runId, planHash: plan.planHash, source: source.dbName, target: PRODUCTION_DATABASE, counts: plan.counts, excluded: plan.excluded, errors: errors.length };
  const writeReport = (name, extra) => writeJson(fromRoot("migration/reports", `${name}.json`), { ...summary, generatedAt: new Date().toISOString(), issues: plan.issues, edits: plan.edits, ...extra });
  if (errors.length) {
    writeReport(`promotion-rejected-${runId}`, {});
    console.log(JSON.stringify({ ...summary, issues: errors }, null, 1));
    return fail(`Promotion refused: ${errors.length} problem(s). Nothing was written.`);
  }

  if (mode === "dry-run") return dryRun(plan, summary, target, writeReport);
  if (args.values["plan-hash"] !== plan.planHash) return fail("--plan-hash does not match the current plan. Run the dry run again and review it.");
  return apply(plan, summary, target, writeReport);
}

async function dryRun(plan, summary, target, writeReport) {
  // Offline simulation: empty target, then a re-run (must be all unchanged).
  const memory = createMemoryPromotionAdapter();
  const first = countResults(await applyPromotion(plan, memory));
  const second = countResults(await applyPromotion(plan, memory));
  const verification = await verifyPromotion(plan, memory);

  // Production as it is now, read-only, when the writer is configured.
  let production = { inspected: false };
  if (target) {
    let ro;
    try {
      ro = await openReadOnlyDatabase(target.uri, target.dbName);
      const access = await ro.connectionStatus();
      assertProductionWriter(access.roles);
      const readOnlyAdapter = { findById: (c, id) => ro.findOne(c, { _id: id }) };
      production = { inspected: true, roles: access.roles, results: countResults(await applyPromotion(plan, readOnlyAdapter, { write: false })), collections: (await ro.listCollections()).map((c) => c.name).sort() };
      if (ro.violations().length) throw new Error("non-read commands observed");
    } catch (error) {
      production = { inspected: false, error: clean(error) };
    } finally {
      await ro?.close();
    }
  }

  writeReport(`promotion-dry-run-${runId}`, { simulation: { first, second, verification }, production, records: plan.docs.map(({ collection, id, label }) => ({ collection, id, label })) });
  const md = [
    "# Promotion dry run",
    "",
    `Plan hash: \`${plan.planHash}\``,
    "",
    `Source: ${summary.source} (read-only) → target: ${summary.target}`,
    "",
    "| Collection | Records |",
    "|---|---:|",
    ...Object.entries(plan.counts).map(([c, n]) => `| ${c} | ${n} |`),
    "",
    `Not promoted: ${plan.excluded.join(", ")}`,
    "",
    `Simulation: first run ${JSON.stringify(first)}, re-run ${JSON.stringify(second)}, verification ${verification.passed ? "passed" : `FAILED: ${verification.problems.join("; ")}`}`,
    "",
    `Production now: ${production.inspected ? JSON.stringify(production.results) : `not inspected${production.error ? ` (${production.error})` : " (PROMOTION_MONGODB_* not set)"}`}`,
    "",
    "## Text edits (before / after)",
    "",
    ...plan.edits.flatMap((e) => [`### ${e.collection} ${e.label} — ${e.path}`, "", "Removed:", "", ...e.removed.map((r) => `> ${r}`), "", "Before:", "", "```text", e.before, "```", "", "After:", "", "```text", e.after, "```", ""]),
  ].join("\n");
  writeFileSync(fromRoot(`migration/reports/promotion-dry-run-${runId}.md`), md);
  console.log(JSON.stringify({ ...summary, simulation: { first, second, verified: verification.passed }, production, edits: plan.edits.map((e) => `${e.collection}/${e.label}:${e.path}`) }, null, 1));
  console.log(`Report: migration/reports/promotion-dry-run-${runId}.md`);
  if (!verification.passed || Object.keys(second).some((k) => k !== "unchanged")) process.exitCode = 2;
}

async function apply(plan, summary, target, writeReport) {
  const connection = mongoose.createConnection(target.uri, { dbName: target.dbName, autoCreate: false, autoIndex: false, bufferCommands: false, serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    if (connection.db?.databaseName !== PRODUCTION_DATABASE) throw new Error("Connected database is not the production database; stopping.");
    const status = await connection.db.command({ connectionStatus: 1 });
    assertProductionWriter((status.authInfo?.authenticatedUserRoles ?? []).map((r) => ({ role: r.role, db: r.db })));

    // Collections and indexes (docs/mongodb-schema-spec.md), non-destructive.
    for (const collection of [...PROMOTED_COLLECTIONS, "migration_runs"]) {
      const Model = modelsByCollection[collection];
      await (connection.models[Model.modelName] ?? connection.model(Model.modelName, Model.schema)).createIndexes();
    }
    const Run = connection.models[MigrationRun.modelName] ?? connection.model(MigrationRun.modelName, MigrationRun.schema);
    const startedAt = new Date();
    const runBase = { runId, track: "promotion", mode: "apply", planHash: plan.planHash, targetDatabase: PRODUCTION_DATABASE, sourceType: "staging_promotion", startedAt };
    await Run.create({ ...runBase, status: "running" });

    const adapter = createDriverPromotionAdapter(connection.db);
    const results = await applyPromotion(plan, adapter);
    const verification = await verifyPromotion(plan, adapter);
    const counts = countResults(results);
    const ok = verification.passed && !results.some((r) => PROBLEM_RESULTS.has(r.result));
    await Run.updateOne({ runId }, {
      status: ok ? "completed" : "completed_with_issues",
      finishedAt: new Date(),
      counts,
      items: results.map((r) => ({ collectionName: r.collection, importId: r.id, legacyKey: r.label ?? null, result: r.result, message: r.message ?? null })),
    });
    writeReport(`promotion-apply-${runId}`, { results, verification });
    console.log(JSON.stringify({ ...summary, results: counts, verification }, null, 1));
    if (!ok) process.exitCode = 2;
  } catch (error) {
    fail(`Promotion failed: ${clean(error)}`);
  } finally {
    await connection.close().catch(() => {});
  }
}

await main();
