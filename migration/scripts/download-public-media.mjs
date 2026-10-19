// Downloads owner-authorized original media from the legacy public site.
//
//   node migration/scripts/download-public-media.mjs --dry-run
//   node migration/scripts/download-public-media.mjs
//   node migration/scripts/download-public-media.mjs --include-derivatives
//
// Source list: docs/reference-media-manifest.json (Phase 02.5.1).
// Output: migration/assets/<folder>/<filename> and
//         migration/manifests/media-manifest.json (merged, idempotent).
import { existsSync, readFileSync } from "node:fs";
import { politeGet } from "./lib/http.mjs";
import { describeImage, dhash, md5, sha256, sniff } from "./lib/media.mjs";
import { fromRoot, parseArgs, readJson, toRootRelative, writeFileAtomic, writeJson } from "./lib/files.mjs";

const args = parseArgs();
const includeDerivatives = args.flags.has("include-derivatives");
const reference = readJson(fromRoot("docs/reference-media-manifest.json"));
const manifestPath = fromRoot("migration/manifests/media-manifest.json");
const manifest = readJson(manifestPath, { schemaVersion: 1, entries: [] });

// Folder by asset subject; one file per asset even when used by many modules.
const folderFor = {
  branding: "branding",
  "shrine-sacred-object": "shrine",
  "shrine-place": "shrine",
  surroundings: "shrine",
  "shrine-people": "shrine",
  "sacred-item": "sacred-items",
  event: "news",
  editorial: "news",
};

// Requested priority: logo, banners, sacred items, shrine, gallery, news, history/article, OG.
const priority = [
  "brand-logo-mark",
  "shrine-interior-altar", "shrine-front-entrance", "shrine-signboard-side", "surroundings-phraratchawang-police-station",
  "shrine-pu-dam-168-statue", "shrine-tra-phaendin-coat-of-arms", "item-coin-charoenlap-charoenyot-poster",
  "shrine-devotee-at-coat-of-arms",
  "event-2569-03-16-newsletter-a", "event-2569-03-16-newsletter-b", "event-officer-paying-respect",
  "event-monks-holy-water", "event-monk-blessing-ceremony", "event-monk-blessing-devotees",
  "editorial-tra-phaendin-infographic",
  "brand-og-default",
];

const candidates = reference.assets
  .filter((asset) => asset.role === "master" || includeDerivatives)
  .sort((a, b) => {
    const rank = (asset) => (priority.indexOf(asset.id) === -1 ? 999 : priority.indexOf(asset.id));
    return rank(a) - rank(b);
  });

const byUrl = new Map(manifest.entries.map((entry) => [entry.sourceUrl, entry]));
const results = { downloaded: 0, unchanged: 0, planned: 0, failed: 0, sourceChanged: 0 };

for (const asset of candidates) {
  const masterCategory = asset.category ?? "other";
  const folder = folderFor[masterCategory] ?? "other";
  const localPath = fromRoot("migration/assets", asset.role === "derivative" ? `${folder}/derivatives` : folder, asset.filename);
  const previous = byUrl.get(asset.sourceUrl);
  const base = {
    id: asset.id ?? `derivative:${asset.filename}`,
    sourceUrl: asset.sourceUrl,
    sourceAttribution: "Legacy public website (owner-authorized reuse)",
    localPath: toRootRelative(localPath),
    originalFilename: asset.filename,
    role: asset.role,
    derivativeOf: asset.derivativeOf,
    category: masterCategory,
    sourceModule: "public-site",
    sourceRecords: asset.mongoAssociation ? asset.mongoAssociation.split(";").map((s) => s.trim()) : [],
    sourcePages: asset.sourcePages,
    sourceAltTexts: asset.sourceAltTexts,
    sourceCaptions: asset.sourceCaptions,
    cloudinaryPublicId: asset.cloudinary?.publicId ?? null,
    mongoAssociation: asset.mongoAssociation ?? null,
    inventorySha256: asset.sha256,
  };

  // Idempotency: an existing local file with the recorded hash is kept as is.
  if (previous?.sha256 && existsSync(localPath) && sha256(readFileSync(localPath)) === previous.sha256) {
    byUrl.set(asset.sourceUrl, { ...previous, ...base, status: "unchanged" });
    results.unchanged++;
    continue;
  }

  if (args.dryRun) {
    byUrl.set(asset.sourceUrl, { ...previous, ...base, status: previous?.status === "downloaded" ? previous.status : "planned" });
    results.planned++;
    console.log(`[plan] ${asset.filename} -> ${base.localPath}`);
    continue;
  }

  const issues = [];
  try {
    const response = await politeGet(asset.sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const kind = sniff(buffer);
    if (!kind || !kind.mime.startsWith("image/")) throw new Error(`Not a supported image (content-type ${response.headers.get("content-type")})`);
    const declared = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (declared && declared !== kind.mime) issues.push(`content-type header ${declared} differs from file signature ${kind.mime}`);
    const info = await describeImage(buffer);
    const hash = sha256(buffer);
    if (asset.sha256 && hash !== asset.sha256) {
      issues.push("SHA-256 differs from the Phase 02.5.1 inventory: the source file has changed");
      results.sourceChanged++;
    }
    writeFileAtomic(localPath, buffer);
    byUrl.set(asset.sourceUrl, {
      ...base,
      mimeType: kind.mime,
      bytes: buffer.length,
      width: info.width,
      height: info.height,
      hasAlpha: info.hasAlpha,
      hasExif: info.hasExif,
      sha256: hash,
      md5: md5(buffer),
      dhash: await dhash(buffer),
      extractedAt: new Date().toISOString(),
      status: "downloaded",
      issues,
    });
    results.downloaded++;
    console.log(`[ok]   ${asset.filename} ${info.width}x${info.height} ${buffer.length}B`);
  } catch (error) {
    byUrl.set(asset.sourceUrl, { ...previous, ...base, status: "failed", issues: [String(error.message ?? error)] });
    results.failed++;
    console.log(`[fail] ${asset.filename}: ${error.message ?? error}`);
  }
}

manifest.generatedAt = new Date().toISOString();
manifest.entries = [...byUrl.values()];
// A dry run reports only; it never writes the manifest or any file.
if (!args.dryRun) writeJson(manifestPath, manifest);
console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "download", candidates: candidates.length, ...results }));
