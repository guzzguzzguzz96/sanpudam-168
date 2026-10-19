// Integrity check of downloaded originals against media-manifest.json.
// Read-only: files are hashed and measured, never modified or re-encoded.
import { existsSync, readFileSync, statSync } from "node:fs";
import { describeImage, md5, sha256, sniff } from "./media.mjs";
import { fromRoot } from "./files.mjs";

export async function verifyAssets(entries) {
  const results = [];
  for (const entry of entries) {
    const path = fromRoot(entry.localPath);
    const problems = [];
    let actual = null;
    if (!existsSync(path)) {
      problems.push("file missing");
    } else {
      const buffer = readFileSync(path);
      const kind = sniff(buffer);
      const info = kind?.mime.startsWith("image/") ? await describeImage(buffer) : {};
      actual = {
        bytes: statSync(path).size,
        mimeType: kind?.mime ?? null,
        width: info.width ?? null,
        height: info.height ?? null,
        sha256: sha256(buffer),
        md5: md5(buffer),
      };
      if (actual.mimeType !== entry.mimeType) problems.push(`MIME ${actual.mimeType} != manifest ${entry.mimeType}`);
      if (actual.bytes !== entry.bytes) problems.push(`size ${actual.bytes} != manifest ${entry.bytes}`);
      if (actual.width !== entry.width || actual.height !== entry.height) problems.push(`dimensions ${actual.width}x${actual.height} != manifest ${entry.width}x${entry.height}`);
      if (actual.sha256 !== entry.sha256) problems.push("SHA-256 does not match the manifest");
      if (entry.inventorySha256 && actual.sha256 !== entry.inventorySha256) problems.push("SHA-256 does not match the Phase 02.5.1 inventory");
      if (actual.md5 !== entry.md5) problems.push("MD5 does not match the manifest");
    }
    results.push({ id: entry.id, localPath: entry.localPath, ok: problems.length === 0, problems, actual });
  }
  return results;
}
