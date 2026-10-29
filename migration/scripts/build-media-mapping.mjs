// Builds the final mapping for the future media_assets collection from local
// files only (no MongoDB connection).
//
//   node migration/scripts/build-media-mapping.mjs
//
// Inputs: manifests/cloudinary-assets.json (import results),
//         manifests/media-manifest.json (sources), content/<collection>.json
// Output: migration/manifests/media-assets-mapping.json
import { fromRoot, readJson, writeJson } from "./lib/files.mjs";

const COLLECTIONS = ["categories", "sacred_items", "news", "gallery_items", "banners", "videos", "reviews", "faqs", "team_members", "pages", "site_settings"];
const imported = readJson(fromRoot("migration/manifests/cloudinary-assets.json"))?.assets ?? [];
const sources = new Map(readJson(fromRoot("migration/manifests/media-manifest.json")).entries.map((e) => [e.id, e]));

// Usage-level image references in the normalized content (alt per placement).
const usages = new Map();
for (const collection of COLLECTIONS) {
  for (const record of readJson(fromRoot("migration/content", `${collection}.json`))?.records ?? []) {
    const visit = (value, path) => {
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
      else if (value && typeof value === "object") {
        if ("assetManifestId" in value && value.assetManifestId) {
          const list = usages.get(value.assetManifestId) ?? [];
          list.push({
            collection,
            importId: record.importId,
            legacyId: record.legacy.id,
            record: record.slug ?? record.key ?? record.legacy.id,
            field: path,
            alt: value.alt || null,
            caption: value.caption ?? null,
            focalPoint: value.focalPoint ?? null,
            legacyUrl: value.mediaMapping?.legacyUrl ?? null,
            legacyMobileUrl: value.mediaMapping?.legacyMobileUrl ?? null,
          });
          usages.set(value.assetManifestId, list);
        } else {
          for (const [key, inner] of Object.entries(value)) visit(inner, path ? `${path}.${key}` : key);
        }
      }
    };
    visit(record, "");
  }
}

// The legacy CMS has no logo field (the logo was a static file), so its
// planned association is added explicitly (docs/content-extraction-results.md §4.9).
const settingsRecord = readJson(fromRoot("migration/content/site_settings.json"))?.records?.[0];
if (settingsRecord && !usages.has("brand-logo-mark")) {
  usages.set("brand-logo-mark", [{
    collection: "site_settings",
    importId: settingsRecord.importId,
    legacyId: settingsRecord.legacy.id,
    record: "default",
    field: "branding.logo",
    alt: "",
    caption: null,
    focalPoint: null,
    legacyUrl: null,
    legacyMobileUrl: null,
    note: "No legacy CMS field; the logo was the static file /img/logo-192.png.",
  }]);
}

const assets = imported.map((asset) => {
  const source = sources.get(asset.manifestId);
  const used = usages.get(asset.manifestId) ?? [];
  return {
    manifestId: asset.manifestId,
    category: asset.category,
    resourceType: asset.resourceType,
    cloudinary: {
      assetId: asset.cloudinary.assetId,
      publicId: asset.cloudinary.publicId,
      version: asset.cloudinary.version,
      secureUrl: asset.cloudinary.secureUrl,
      type: asset.cloudinary.type,
      format: asset.cloudinary.format,
      etag: asset.cloudinary.etag,
    },
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    contentHash: asset.contentHash,
    defaultAlt: asset.defaultAlt,
    source: {
      type: "legacy-export",
      url: source.sourceUrl,
      originalFilename: source.originalFilename,
      localPath: source.localPath,
      localSha256: source.sha256,
      pages: source.sourcePages,
    },
    legacy: {
      // URLs the legacy CMS used for this file (original and its 800px resize).
      mediaUrls: [...new Set(used.flatMap((u) => [u.legacyUrl, u.legacyMobileUrl]).filter(Boolean))],
      references: (source.adminUsages ?? []).map((u) => `${u.collection}:${u.legacyId}:${u.field}`),
    },
    suggestedAssociations: used.map(({ legacyUrl, legacyMobileUrl, ...rest }) => (void legacyUrl, void legacyMobileUrl, rest)),
    rights: asset.rights,
    approval: asset.approval,
    importedAt: asset.importedAt,
    migration: asset.migration,
  };
});

const unused = assets.filter((a) => a.suggestedAssociations.length === 0).map((a) => a.manifestId);
writeJson(fromRoot("migration/manifests/media-assets-mapping.json"), {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: "media_assets (not yet written; MongoDB import requires separate approval)",
  count: assets.length,
  assetsWithoutContentAssociation: unused,
  assets,
});
console.log(JSON.stringify({ assets: assets.length, associations: assets.reduce((t, a) => t + a.suggestedAssociations.length, 0), withoutAssociation: unused }));
