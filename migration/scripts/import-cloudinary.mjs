// Imports the 17 verified legacy originals into Cloudinary.
//
// Dry run (default; offline, no credentials, no network):
//   node migration/scripts/import-cloudinary.mjs
// Read-only remote preflight (needs credentials; checks existing public IDs):
//   node --env-file=.env.local migration/scripts/import-cloudinary.mjs --preflight
// Real upload (only after explicit approval; plan hash from the latest dry run):
//   node --env-file=.env.local migration/scripts/import-cloudinary.mjs --apply --plan-hash=<hash>
//
// Options: --target=staging|production (default staging), --confirm-root=<root>
// (required for production), --only=<manifestId,...>
//
// Guarantees: originals are uploaded byte-for-byte (no resize/recompress);
// overwrite=false; an existing public ID is skipped only when its MD5 and size
// match the local file, otherwise reported as a conflict; no deletes.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { verifyAssets } from "./lib/verify.mjs";
import { assertTargetAllowed, createClient, formatContext, loadConfig, targetPublicId } from "./lib/cloudinary.mjs";
import { fromRoot, parseArgs, readJson, writeJson } from "./lib/files.mjs";

const args = parseArgs();
const mode = args.flags.has("apply") ? "apply" : args.flags.has("preflight") ? "preflight" : "dry-run";
const target = args.values.target ?? "staging";
const only = args.values.only ? new Set(args.values.only.split(",")) : null;
const config = loadConfig();
const { settings } = config;

// Output root for reports, state, and the media_assets-ready manifest.
// --out exists for isolated tests; the default is the migration folder.
const outDir = args.values.out ? resolve(args.values.out) : fromRoot("migration");
const outPath = (...parts) => join(outDir, ...parts);
mkdirSync(outPath("reports"), { recursive: true });
mkdirSync(outPath("manifests"), { recursive: true });

// Assets that show identifiable people (consent pending; see media docs).
const PEOPLE = new Set([
  "event-2569-03-16-newsletter-a", "event-2569-03-16-newsletter-b", "event-officer-paying-respect",
  "event-monks-holy-water", "event-monk-blessing-ceremony", "event-monk-blessing-devotees", "shrine-devotee-at-coat-of-arms",
]);

// --- 1. verify source files (stop on any failure) --------------------------
const manifest = readJson(fromRoot("migration/manifests/media-manifest.json"));
const masters = manifest.entries.filter((e) => e.role === "master" && (!only || only.has(e.id)));
const verification = await verifyAssets(masters);
const failedVerification = verification.filter((v) => !v.ok);
if (failedVerification.length) {
  console.error("Integrity check failed; nothing will be imported:");
  for (const v of failedVerification) console.error(`  ${v.id}: ${v.problems.join("; ")}`);
  process.exit(1);
}

// --- 2. build the deterministic plan ----------------------------------------
const longest = (list) => [...(list ?? [])].sort((a, b) => b.length - a.length)[0] ?? "";
const plan = masters.map((entry) => {
  const publicId = targetPublicId(entry.cloudinaryPublicId, settings.importRoot);
  const assetFolder = settings.folderMode === "dynamic" ? publicId.split("/").slice(0, -1).join("/") : null;
  return {
    manifestId: entry.id,
    localPath: entry.localPath,
    originalFilename: entry.originalFilename,
    sourceUrl: entry.sourceUrl,
    mimeType: entry.mimeType,
    bytes: entry.bytes,
    width: entry.width,
    height: entry.height,
    sha256: entry.sha256,
    md5: entry.md5,
    dhash: entry.dhash,
    category: entry.category,
    legacyReferences: entry.sourceRecords ?? [],
    sourcePages: entry.sourcePages ?? [],
    defaultAlt: longest(entry.sourceAltTexts),
    publicId,
    assetFolder,
    deliveryType: settings.deliveryType,
    tags: ["sanpudam168", "source:legacy-site", `category:${entry.category}`, "phase:02.5.4", ...(PEOPLE.has(entry.id) ? ["consent:pending"] : [])],
    context: {
      manifest_id: entry.id,
      sha256: entry.sha256,
      source_url: entry.sourceUrl,
      original_filename: entry.originalFilename,
      alt: longest(entry.sourceAltTexts),
    },
  };
});

const groupBy = (list, key) => Object.values(Object.groupBy(list, (item) => item[key])).filter((group) => group.length > 1);
const duplicateFiles = groupBy(plan, "sha256").map((g) => g.map((p) => p.manifestId));
const duplicatePublicIds = groupBy(plan, "publicId").map((g) => g.map((p) => p.manifestId));
const planHash = createHash("sha256")
  .update(JSON.stringify({ settings: { importRoot: settings.importRoot, folderMode: settings.folderMode, deliveryType: settings.deliveryType }, plan: plan.map(({ manifestId, publicId, sha256, md5, assetFolder, deliveryType, tags, context }) => ({ manifestId, publicId, sha256, md5, assetFolder, deliveryType, tags, context: formatContext(context) })) }))
  .digest("hex");

const summaryBase = {
  mode,
  planHash,
  target: { kind: target, api: settings.apiBase.startsWith("https://api.cloudinary.com") ? "cloudinary" : "local-test-server", cloudName: settings.cloudName ? "(set)" : "(not set)", importRoot: settings.importRoot, folderMode: settings.folderMode, deliveryType: settings.deliveryType },
  files: plan.length,
  totalBytes: plan.reduce((t, p) => t + p.bytes, 0),
  verification: { passed: verification.length, failed: 0 },
  duplicateFiles,
  duplicatePublicIds,
};

let targetError = null;
try {
  assertTargetAllowed(settings.importRoot, { target, confirmRoot: args.values["confirm-root"] ?? null });
} catch (error) {
  targetError = error.message;
}

// --- 3a. dry run: offline report only ---------------------------------------
if (mode === "dry-run") {
  const report = { ...summaryBase, generatedAt: new Date().toISOString(), targetCheck: targetError ?? "ok", expectedUploads: plan.length, remoteChecked: false, plan };
  writeJson(outPath("reports", "cloudinary-dry-run.json"), report);
  writeFileSync(outPath("reports", "cloudinary-dry-run.md"), [
    "# Cloudinary import dry run",
    "",
    `Plan hash: \`${planHash}\`  `,
    `Target: ${target}, root \`${settings.importRoot}\`, folder mode ${settings.folderMode}, delivery type \`${settings.deliveryType}\`  `,
    `Target check: ${targetError ?? "ok"}  `,
    "Remote state: not checked (offline dry run; run --preflight for read-only checks)",
    "",
    `Files: ${plan.length}, total ${(summaryBase.totalBytes / 1024 / 1024).toFixed(2)} MB, duplicates by SHA-256: ${duplicateFiles.length}, duplicate public IDs: ${duplicatePublicIds.length}`,
    "",
    "| Manifest ID | Size | Bytes | Public ID | Tags |",
    "|---|---|---:|---|---|",
    ...plan.map((p) => `| ${p.manifestId} | ${p.width}x${p.height} | ${p.bytes} | \`${p.publicId}\` | ${p.tags.slice(2).join(", ")} |`),
    "",
  ].join("\n"));
  console.log(JSON.stringify({ ...summaryBase, targetCheck: targetError ?? "ok", expectedUploads: plan.length }, null, 1));
  process.exit(targetError ? 1 : 0);
}

// --- 3b. remote modes need credentials and an allowed target -------------------
if (!config.hasCredentials) {
  console.error("Cloudinary credentials are not set. Run with: node --env-file=.env.local …");
  process.exit(1);
}
if (targetError) {
  console.error(targetError);
  process.exit(1);
}
if (mode === "apply" && args.values["plan-hash"] !== planHash) {
  console.error("--plan-hash does not match the current plan. Run the dry run again and review it before applying.");
  process.exit(1);
}

const client = createClient(config, { apiBase: settings.apiBase });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const logPath = outPath("reports", `cloudinary-import-${runId}.jsonl`);
const statePath = outPath("reports", "cloudinary-import-state.json");
const state = readJson(statePath, { assets: {} });
const log = (record) => appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), runId, ...record })}\n`);

const matches = (remote, item) => remote.etag === item.md5 && remote.bytes === item.bytes;
const results = [];

for (const item of plan) {
  let result;
  try {
    const remote = await client.getResource(item.publicId, item.deliveryType);
    if (remote) {
      result = matches(remote, item)
        ? { status: "already_present", remote }
        : { status: "conflict", reason: `existing asset differs (remote etag ${remote.etag}, bytes ${remote.bytes})` };
    } else if (mode === "preflight") {
      result = { status: "would_upload" };
    } else {
      const response = await client.upload({
        fileBuffer: readFileSync(fromRoot(item.localPath)),
        filename: item.originalFilename,
        mimeType: item.mimeType,
        publicId: item.publicId,
        deliveryType: item.deliveryType,
        assetFolder: item.assetFolder,
        tags: item.tags,
        context: item.context,
      });
      if (response.existing && !matches(response, item)) {
        result = { status: "conflict", reason: "asset appeared concurrently with different content; not overwritten" };
      } else {
        const problems = [];
        if (response.etag !== item.md5) problems.push("etag (MD5) mismatch");
        if (response.bytes !== item.bytes) problems.push(`bytes ${response.bytes} != ${item.bytes}`);
        if (response.width !== item.width || response.height !== item.height) problems.push(`dimensions ${response.width}x${response.height}`);
        result = problems.length ? { status: "verify_failed", reason: problems.join("; "), remote: response } : { status: response.existing ? "already_present" : "uploaded", remote: response };
      }
    }
  } catch (error) {
    result = { status: "failed", reason: error.message };
  }

  const remote = result.remote;
  const record = {
    manifestId: item.manifestId,
    publicId: item.publicId,
    status: result.status,
    reason: result.reason ?? null,
    cloudinary: remote ? { assetId: remote.asset_id ?? null, publicId: remote.public_id, version: remote.version, secureUrl: remote.secure_url, resourceType: remote.resource_type, type: remote.type, format: remote.format, width: remote.width, height: remote.height, bytes: remote.bytes, etag: remote.etag, createdAt: remote.created_at } : null,
  };
  results.push({ item, record });
  log(record);
  if (mode === "apply") {
    state.assets[item.manifestId] = { ...record, updatedAt: new Date().toISOString() };
    writeJson(statePath, state);
  }
  console.log(`${record.status.padEnd(15)} ${item.manifestId}${record.reason ? ` (${record.reason})` : ""}`);
}

// --- 4. media_assets-ready output (apply mode only) ----------------------------
if (mode === "apply") {
  const imported = results.filter(({ record }) => ["uploaded", "already_present"].includes(record.status));
  const existing = readJson(outPath("manifests", "cloudinary-assets.json"), { assets: [] });
  const byId = new Map(existing.assets.map((asset) => [asset.manifestId, asset]));
  for (const { item, record } of imported) {
    byId.set(item.manifestId, {
      manifestId: item.manifestId,
      category: item.category,
      resourceType: "image",
      cloudinary: { ...record.cloudinary },
      width: item.width,
      height: item.height,
      bytes: item.bytes,
      mimeType: item.mimeType,
      contentHash: { sha256: item.sha256, md5: item.md5, dhash: item.dhash },
      defaultAlt: item.defaultAlt || null,
      source: { type: "legacy-export", url: item.sourceUrl, originalFilename: item.originalFilename, localPath: item.localPath, pages: item.sourcePages },
      legacy: { references: item.legacyReferences },
      rights: {
        status: "approved",
        notes: ["Owner authorized reuse of legacy site media (Phase 02.5.3)."],
        containsIdentifiablePeople: PEOPLE.has(item.manifestId),
        consent: { status: PEOPLE.has(item.manifestId) ? "pending" : "not_required" },
      },
      approval: { status: "pending" },
      importedAt: byId.get(item.manifestId)?.importedAt ?? new Date().toISOString(),
      migration: { runId, importRoot: settings.importRoot },
    });
  }
  writeJson(outPath("manifests", "cloudinary-assets.json"), { schemaVersion: 1, updatedAt: new Date().toISOString(), assets: [...byId.values()] });
}

const counts = results.reduce((acc, { record }) => ({ ...acc, [record.status]: (acc[record.status] ?? 0) + 1 }), {});
console.log(JSON.stringify({ ...summaryBase, runId, counts, log: logPath.split(/[\\/]/).slice(-2).join("/") }, null, 1));
// exitCode instead of process.exit(): exiting while HTTP keep-alive sockets
// are open can crash Node on Windows.
if (results.some(({ record }) => ["conflict", "failed", "verify_failed"].includes(record.status))) process.exitCode = 2;
