// Post-upload verification of imported legacy media (read-only).
//
//   node --env-file=.env.local migration/scripts/verify-cloudinary.mjs
//
// For every asset in migration/manifests/cloudinary-assets.json:
//   - Admin API read: asset ID, public ID, delivery type, format, size,
//     dimensions, etag (MD5), tags, context, and asset folder
//   - Public delivery: anonymous GET of the secure URL returns HTTP 200,
//     the expected content type, and bytes identical to the local original
// Output: migration/reports/cloudinary-verification.json and .md
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, loadConfig } from "./lib/cloudinary.mjs";
import { fromRoot, readJson, writeJson } from "./lib/files.mjs";

const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const config = loadConfig();
const client = createClient(config, { apiBase: config.settings.apiBase });
const imported = readJson(fromRoot("migration/manifests/cloudinary-assets.json"))?.assets ?? [];
const plan = new Map((readJson(fromRoot("migration/reports/cloudinary-dry-run.json"))?.plan ?? []).map((p) => [p.manifestId, p]));

const results = [];
for (const asset of imported) {
  const problems = [];
  const expected = plan.get(asset.manifestId);
  const remote = await client.getResource(asset.cloudinary.publicId, asset.cloudinary.type);
  if (!remote) {
    problems.push("asset not found via Admin API");
  } else {
    if (remote.asset_id !== asset.cloudinary.assetId) problems.push("asset ID differs from import record");
    if (remote.public_id !== expected?.publicId) problems.push("public ID differs from plan");
    if (remote.type !== "upload") problems.push(`delivery type ${remote.type}`);
    // The Admin API omits etag; the upload response's etag was recorded at import.
    if (remote.etag && remote.etag !== asset.contentHash.md5) problems.push("etag (MD5) differs from local original");
    if (asset.cloudinary.etag !== asset.contentHash.md5) problems.push("upload-time etag (MD5) differs from local original");
    if (remote.bytes !== asset.bytes) problems.push(`bytes ${remote.bytes} != ${asset.bytes}`);
    if (remote.width !== asset.width || remote.height !== asset.height) problems.push(`dimensions ${remote.width}x${remote.height}`);
    if (MIME[remote.format] !== asset.mimeType) problems.push(`format ${remote.format} does not match ${asset.mimeType}`);
    for (const tag of expected?.tags ?? []) if (!(remote.tags ?? []).includes(tag)) problems.push(`missing tag ${tag}`);
    if (remote.context?.custom?.sha256 !== asset.contentHash.sha256) problems.push("context sha256 missing or different");
    if (expected?.assetFolder && remote.asset_folder !== expected.assetFolder) problems.push(`asset folder ${remote.asset_folder ?? "(none)"}`);
  }

  // Anonymous public delivery check (no credentials sent).
  let delivery = null;
  try {
    const response = await fetch(asset.cloudinary.secureUrl, { signal: AbortSignal.timeout(30000) });
    const body = Buffer.from(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(body).digest("hex");
    delivery = { status: response.status, contentType: response.headers.get("content-type"), bytes: body.length, identicalToOriginal: sha256 === asset.contentHash.sha256 };
    if (response.status !== 200) problems.push(`public URL returned HTTP ${response.status}`);
    if (delivery.contentType?.split(";")[0] !== asset.mimeType) problems.push(`public content type ${delivery.contentType}`);
    if (!delivery.identicalToOriginal) problems.push("publicly delivered bytes differ from the local original");
  } catch (error) {
    problems.push(`public URL fetch failed: ${error.message}`);
  }

  const localSha = createHash("sha256").update(readFileSync(fromRoot(asset.source.localPath))).digest("hex");
  if (localSha !== asset.contentHash.sha256) problems.push("local original changed since import");

  results.push({
    manifestId: asset.manifestId,
    ok: problems.length === 0,
    problems,
    assetId: remote?.asset_id ?? null,
    publicId: remote?.public_id ?? null,
    type: remote?.type ?? null,
    format: remote?.format ?? null,
    dimensions: remote ? `${remote.width}x${remote.height}` : null,
    bytes: remote?.bytes ?? null,
    uploadEtagMatchesMd5: asset.cloudinary.etag === asset.contentHash.md5,
    adminApiEtag: remote?.etag ?? "not provided",
    assetFolder: remote?.asset_folder ?? null,
    secureUrl: asset.cloudinary.secureUrl,
    delivery,
  });
  console.log(`${problems.length ? "FAIL" : "ok  "} ${asset.manifestId}${problems.length ? `: ${problems.join("; ")}` : ""}`);
}

const missingFromImport = [...plan.keys()].filter((id) => !imported.some((a) => a.manifestId === id));
const summary = {
  verifiedAt: new Date().toISOString(),
  expected: plan.size,
  imported: imported.length,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  missingFromImport,
};
writeJson(fromRoot("migration/reports/cloudinary-verification.json"), { ...summary, results });
writeFileSync(fromRoot("migration/reports/cloudinary-verification.md"), [
  "# Cloudinary post-upload verification",
  "",
  `Verified: ${summary.verifiedAt}  `,
  `Expected ${summary.expected}, imported ${summary.imported}, passed ${summary.passed}, failed ${summary.failed}, missing ${missingFromImport.length}`,
  "",
  "| Manifest ID | Result | Type | Format | Size | Bytes | Upload MD5 | Public URL | Identical bytes |",
  "|---|---|---|---|---|---:|---|---|---|",
  ...results.map((r) => `| ${r.manifestId} | ${r.ok ? "ok" : `FAIL: ${r.problems.join("; ")}`} | ${r.type} | ${r.format} | ${r.dimensions} | ${r.bytes} | ${r.uploadEtagMatchesMd5 ? "match" : "differs"} | ${r.delivery?.status ?? "-"} | ${r.delivery?.identicalToOriginal ? "yes" : "no"} |`),
  "",
].join("\n"));
console.log(JSON.stringify(summary));
if (summary.failed || missingFromImport.length || summary.imported !== summary.expected) process.exitCode = 1;
