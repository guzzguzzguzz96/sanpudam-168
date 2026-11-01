import "server-only";
import { assertDraftGrant } from "./draft-access.js";
import { collectAssetIds, createMediaResolver } from "./media.js";
import { assertReviewGrant } from "./review-access.js";
import {
  CONTENT_PROJECTION,
  DRAFT_SCOPE,
  MEDIA_PROJECTION,
  PUBLIC_SCOPE,
  REVIEW_SCOPE,
  draftContentFilter,
  draftMediaFilter,
  isPubliclyVisible,
  isValidSlug,
  publicContentFilter,
  publicMediaFilter,
} from "./policy.js";

// Server-side content repositories (read-only). Nothing here writes to the
// database, and nothing here is imported by public routes yet.
//
// Every repository returns a result object:
//   { status: "ok" | "empty" | "unavailable", data, media }
// - "unavailable": the database could not be read (public scope only; the
//   error is logged without connection details). Callers keep their
//   existing static UI. Drafts are never used as a fallback.
// - media: a resolver for the ImageRefs inside `data` (see media.js).

const QUERY_OPTIONS = { lean: true, maxTimeMS: 5000 };

function createScope(name, grant = null) {
  const isPublic = name === PUBLIC_SCOPE;
  return {
    name,
    grant,
    contentFilter: isPublic ? publicContentFilter : draftContentFilter,
    mediaFilter: isPublic ? publicMediaFilter : draftMediaFilter,
    // Defense in depth: the public rule is re-checked on every document.
    accept: isPublic ? isPubliclyVisible : (doc) => Boolean(doc) && doc.status !== "archived",
  };
}

// deps.models: { SiteSettings, Banner, SacredItem, Category, News, GalleryItem, Faq, Page, MediaAsset }
// deps.connect: async () => void, opens (or reuses) the Mongoose connection.
// deps.sanitize: (error) => Error without connection details.
// deps.logger: { error(message) }.
export function createContentService({ models, connect, sanitize = (error) => error, logger = console }) {
  if (!models || typeof connect !== "function") throw new TypeError("models and connect are required.");

  async function find(scope, Model, extraFilter, { sort, limit } = {}) {
    await connect();
    const docs = await Model.find(scope.contentFilter(extraFilter), CONTENT_PROJECTION, { ...QUERY_OPTIONS, sort, limit }).exec();
    return (docs ?? []).filter(scope.accept);
  }

  async function findOne(scope, Model, extraFilter) {
    await connect();
    const doc = await Model.findOne(scope.contentFilter(extraFilter), CONTENT_PROJECTION, QUERY_OPTIONS).exec();
    return scope.accept(doc) ? doc : null;
  }

  async function loadMedia(scope, docs) {
    const ids = collectAssetIds(docs);
    if (!ids.length) return createMediaResolver([], { scope: scope.name });
    await connect();
    const assets = await models.MediaAsset.find(scope.mediaFilter(ids), MEDIA_PROJECTION, QUERY_OPTIONS).exec();
    return createMediaResolver(assets, { scope: scope.name });
  }

  // Wraps a loader so public and review reads degrade to "unavailable"
  // instead of throwing. Draft reads throw: an editor must see real failures.
  function guarded(scope, empty, loader) {
    return async (...args) => {
      try {
        const { data, ...rest } = await loader(...args);
        const isEmpty = data === null || (Array.isArray(data) && data.length === 0);
        return { status: isEmpty ? "empty" : "ok", data: isEmpty ? empty() : data, ...rest };
      } catch (error) {
        if (scope.name === DRAFT_SCOPE) throw sanitize(error);
        logger.error(`[cms] content unavailable: ${sanitize(error).message}`);
        return { status: "unavailable", data: empty(), media: createMediaResolver([], { scope: scope.name }) };
      }
    };
  }

  function repositories(scope) {
    const list = () => [];
    const none = () => null;
    const withMedia = async (data) => ({ data, media: await loadMedia(scope, data) });

    return {
      scope: scope.name,

      siteSettings: guarded(scope, none, async () => withMedia(await findOne(scope, models.SiteSettings, { key: "default" }))),

      banners: guarded(scope, list, async ({ limit = 5 } = {}) => withMedia(await find(scope, models.Banner, {}, { sort: { sortOrder: 1, _id: 1 }, limit }))),

      // Sacred items with their categories. A category that is not visible
      // in this scope is dropped (category: null), never substituted.
      sacredItems: guarded(scope, list, async ({ limit = 12 } = {}) => {
        const items = await find(scope, models.SacredItem, {}, { sort: { sortOrder: 1, _id: 1 }, limit });
        const categoryIds = [...new Set(items.map((item) => item.categoryId).filter(Boolean).map(String))];
        const categories = categoryIds.length ? await find(scope, models.Category, { _id: { $in: categoryIds } }, { sort: { sortOrder: 1 } }) : [];
        return { ...(await withMedia(items)), categories: new Map(categories.map((c) => [String(c._id), c])) };
      }),

      // One sacred item by its slug: a validated string used as a literal
      // equality match (never an operator or a field name). An invalid slug
      // returns "empty" without a query.
      sacredItemBySlug: guarded(scope, none, async (slug) => {
        if (!isValidSlug(slug)) return { data: null, media: createMediaResolver([], { scope: scope.name }), category: null };
        const item = await findOne(scope, models.SacredItem, { slug: String(slug) });
        const category = item?.categoryId ? await findOne(scope, models.Category, { _id: item.categoryId }) : null;
        return { ...(await withMedia(item)), category };
      }),

      news: guarded(scope, list, async ({ limit = 3 } = {}) => withMedia(await find(scope, models.News, {}, { sort: { date: -1, _id: 1 }, limit }))),

      gallery: guarded(scope, list, async ({ galleryKey = "shrine-main", limit = 12 } = {}) => withMedia(await find(scope, models.GalleryItem, { galleryKey }, { sort: { sortOrder: 1, _id: 1 }, limit }))),

      faqs: guarded(scope, list, async ({ homeOnly = false, limit = 20 } = {}) => withMedia(await find(scope, models.Faq, homeOnly ? { showOnHome: true } : {}, { sort: { sortOrder: 1, _id: 1 }, limit }))),

      historyPage: guarded(scope, none, async () => withMedia(await findOne(scope, models.Page, { key: "history" }))),

      // Media assets by id, already filtered for this scope.
      mediaAssets: guarded(scope, list, async (ids = []) => {
        const unique = [...new Set(ids.map(String))];
        if (!unique.length) return { data: [] };
        await connect();
        const assets = await models.MediaAsset.find(scope.mediaFilter(unique), MEDIA_PROJECTION, QUERY_OPTIONS).exec();
        const media = createMediaResolver(assets, { scope: scope.name });
        return { data: (assets ?? []).filter((asset) => media.has(asset._id)), media };
      }),
    };
  }

  return {
    public: repositories(createScope(PUBLIC_SCOPE)),
    // Requires a grant from a draft access policy (draft-access.js). Without
    // one this throws DraftAccessDeniedError before any query runs.
    withDraftAccess(grant) {
      return repositories(createScope(DRAFT_SCOPE, assertDraftGrant(grant)));
    },
    // Requires a grant from the client review policy (review-access.js).
    // Without one this throws ReviewAccessDeniedError before any query runs.
    withReviewAccess(grant) {
      return repositories(createScope(REVIEW_SCOPE, assertReviewGrant(grant)));
    },
  };
}
