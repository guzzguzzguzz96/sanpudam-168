import "server-only";
import { isMediaDraftUsable, isMediaPubliclyUsable, PUBLIC_SCOPE } from "./policy.js";

// Media resolution: content stores ImageRefs ({ assetId, alt, caption,
// focalPoint, mediaMapping }); media_assets stores the Cloudinary identity.
// Components receive only the resolved image shape used by MediaFrame:
//   { src, width, height, alt, focalPoint, publicId }
// Cloudinary URLs are built here and nowhere else.

const CLOUDINARY_HOST = "res.cloudinary.com";

// Every ImageRef in a document (same detection rule as the models).
export function collectImageRefs(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectImageRefs(item, out);
  } else if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("mediaMapping" in value && "alt" in value) out.push(value);
    else for (const inner of Object.values(value)) collectImageRefs(inner, out);
  }
  return out;
}

export function collectAssetIds(docs) {
  const ids = new Set();
  for (const ref of collectImageRefs(docs)) if (ref.assetId) ids.add(String(ref.assetId));
  return [...ids];
}

// { x: 0.55, y: 0.5 } -> "55% 50%" (CSS object-position).
export function focalPointToPosition(focalPoint) {
  const valid = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!focalPoint || !valid(focalPoint.x) || !valid(focalPoint.y)) return null;
  const percent = (n) => `${Math.round(n * 1000) / 10}%`;
  return `${percent(focalPoint.x)} ${percent(focalPoint.y)}`;
}

function cloudNameOf(secureUrl) {
  try {
    const url = new URL(secureUrl);
    if (url.protocol !== "https:" || url.hostname !== CLOUDINARY_HOST) return null;
    return url.pathname.split("/")[1] || null;
  } catch {
    return null;
  }
}

// Delivery URL for a stored asset with optional responsive transformations.
// Without options it returns the stored secureUrl unchanged.
export function cloudinaryImageUrl(asset, { width, height, crop = "limit", gravity, format = "auto", quality = "auto" } = {}) {
  const cloudinary = asset?.cloudinary;
  if (!cloudinary?.secureUrl || !cloudinary.publicId) return null;
  if (!width && !height) return cloudinary.secureUrl;
  const cloudName = cloudNameOf(cloudinary.secureUrl);
  if (!cloudName) return null;
  const transformation = [
    `f_${format}`,
    `q_${quality}`,
    `c_${crop}`,
    width ? `w_${Math.round(width)}` : null,
    height ? `h_${Math.round(height)}` : null,
    gravity ? `g_${gravity}` : null,
  ].filter(Boolean).join(",");
  const version = cloudinary.version ? `v${cloudinary.version}/` : "";
  const extension = cloudinary.format ? `.${cloudinary.format}` : "";
  return `https://${CLOUDINARY_HOST}/${cloudName}/image/upload/${transformation}/${version}${cloudinary.publicId}${extension}`;
}

// assets: media_assets documents (already filtered by the query).
// scope: "public" applies the public rights rule again on each asset.
export function createMediaResolver(assets, { scope = PUBLIC_SCOPE } = {}) {
  const usable = scope === PUBLIC_SCOPE ? isMediaPubliclyUsable : isMediaDraftUsable;
  const byId = new Map();
  for (const asset of assets ?? []) {
    if (asset?._id && asset.resourceType !== "video" && usable(asset) && asset.cloudinary?.secureUrl) byId.set(String(asset._id), asset);
  }

  return {
    // Returns null when the reference is missing, unresolved, or not usable
    // in this scope. Components then show their approved placeholder.
    resolve(ref) {
      if (!ref?.assetId || ref.mediaMapping?.status !== "resolved") return null;
      const asset = byId.get(String(ref.assetId));
      if (!asset) return null;
      return {
        src: asset.cloudinary.secureUrl,
        width: asset.width ?? null,
        height: asset.height ?? null,
        alt: ref.alt || asset.defaultAlt || "",
        caption: ref.caption ?? null,
        focalPoint: focalPointToPosition(ref.focalPoint),
        publicId: asset.cloudinary.publicId,
      };
    },
    has(assetId) {
      return byId.has(String(assetId));
    },
    get size() {
      return byId.size;
    },
  };
}
