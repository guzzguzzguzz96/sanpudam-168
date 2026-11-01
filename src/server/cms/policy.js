import "server-only";

// Publication policy for CMS content (docs/frontend-data-integration.md §3).
//
// Public content must be, at the same time:
//   - status "published"
//   - review.status "approved"
//   - free of open placeholder flags
// The rule is applied twice: in the MongoDB query (publicContentFilter) and
// again on every returned document (isPubliclyVisible), so a wrong query or
// a mock that ignores filters can never leak a draft.

export const PUBLIC_SCOPE = "public";
export const DRAFT_SCOPE = "draft";
// Client Review (review-access.js): same content and media rules as draft,
// but opened by the review policy and degraded to "unavailable" on errors.
export const REVIEW_SCOPE = "review";

// Route slugs (models/shared.js SLUG_PATTERN, plus a length cap). A value
// that fails this check is never sent to the database.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidSlug(value) {
  return typeof value === "string" && value.length <= 100 && SLUG_PATTERN.test(value);
}

export function publicContentFilter(extra = {}) {
  return {
    ...extra,
    status: "published",
    "review.status": "approved",
    "placeholderFields.status": { $ne: "placeholder" },
  };
}

// Draft scope: everything except archived records.
export function draftContentFilter(extra = {}) {
  return { ...extra, status: { $in: ["draft", "published"] } };
}

export function isPubliclyVisible(doc) {
  if (!doc || doc.status !== "published") return false;
  if (doc.review?.status !== "approved") return false;
  return !(doc.placeholderFields ?? []).some((flag) => flag.status === "placeholder");
}

// Media may appear publicly only when its rights are approved and it has not
// been removed (spec §6: rights.status = approved for media in use).
export function publicMediaFilter(ids) {
  return { _id: { $in: ids }, "rights.status": "approved", deletedAt: null };
}

export function draftMediaFilter(ids) {
  return { _id: { $in: ids }, "rights.status": { $ne: "rejected" }, deletedAt: null };
}

export function isMediaPubliclyUsable(asset) {
  return Boolean(asset) && asset.rights?.status === "approved" && !asset.deletedAt;
}

export function isMediaDraftUsable(asset) {
  return Boolean(asset) && asset.rights?.status !== "rejected" && !asset.deletedAt;
}

// Internal fields never needed for rendering. Excluding them keeps legacy
// raw payloads and migration bookkeeping out of the render context.
export const CONTENT_PROJECTION = {
  legacy: 0,
  migration: 0,
  createdBy: 0,
  updatedBy: 0,
};

export const MEDIA_PROJECTION = {
  cloudinary: 1,
  width: 1,
  height: 1,
  defaultAlt: 1,
  resourceType: 1,
  rights: 1,
  deletedAt: 1,
};
