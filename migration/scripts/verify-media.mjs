// Verifies the downloaded originals against the extraction manifest.
//
//   node migration/scripts/verify-media.mjs
//
// Exit code 1 if any file is missing or differs (MIME, size, dimensions,
// SHA-256, MD5). Nothing is modified.
import { verifyAssets } from "./lib/verify.mjs";
import { fromRoot, readJson } from "./lib/files.mjs";

const manifest = readJson(fromRoot("migration/manifests/media-manifest.json"));
const masters = manifest.entries.filter((entry) => entry.role === "master");
const results = await verifyAssets(masters);

for (const result of results) {
  console.log(`${result.ok ? "ok  " : "FAIL"} ${result.id}${result.ok ? "" : `: ${result.problems.join("; ")}`}`);
}
const failed = results.filter((result) => !result.ok);
const totalBytes = results.reduce((total, result) => total + (result.actual?.bytes ?? 0), 0);
console.log(JSON.stringify({ files: results.length, passed: results.length - failed.length, failed: failed.length, totalBytes }));
if (failed.length) process.exit(1);
