import "server-only";
import { adaptFeaturedItems, adaptGallery, adaptLatestNews, composeHomepageData } from "../cms/adapters.js";
import { loadHomepageContent } from "../cms/homepage.js";
import { homepagePreviewData } from "../../data/homepage-preview.js";
import { describePublicationState } from "./publication-state.js";

// Private preview loaders. Each one requires a draft grant (checked by
// service.withDraftAccess before any query), reuses the public adapters and
// media resolver, and returns view data plus a per-record publication state
// (stage label and open placeholder fields).
//
// Read-only: nothing here changes status, review, or any other field.
// Not used by any route yet (docs/frontend-data-integration.md §13).

export const PREVIEW_SECTIONS = Object.freeze(["homepage", "sacred-items", "news", "history", "gallery"]);

// Every link is enabled in preview; preview routes mirror the public ones
// under the private prefix.
const PREVIEW_ROUTES = { sacredItems: true, sacredItemDetail: true, newsDetail: true };

function recordStates(collection, result) {
  const docs = result?.data == null ? [] : Array.isArray(result.data) ? result.data : [result.data];
  return docs.map((doc) => ({ collection, id: String(doc._id), ...describePublicationState(doc) }));
}

function historyView(result) {
  const page = result.data;
  if (!page) return null;
  const media = result.media;
  const byOrder = (list) => [...(list ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    title: page.title ?? null,
    intro: page.intro ?? null,
    historyBody: page.historyBody ?? null,
    historyImage: media.resolve(page.historyImage),
    quote: page.quote ?? null,
    homeIntroHeading: page.homeIntroHeading ?? null,
    coatOfArms: page.coatOfArms
      ? {
          heading: page.coatOfArms.heading ?? null,
          body: page.coatOfArms.body ?? null,
          image: media.resolve(page.coatOfArms.image),
          parts: byOrder(page.coatOfArms.parts).map((p) => ({ id: p.key, part: p.part, meaning: p.meaning })),
        }
      : null,
    wishTopics: byOrder(page.wishTopics).map((t) => ({ id: t.key, topic: t.topic, description: t.description ?? null, icon: t.icon })),
    worshipSteps: byOrder(page.worshipSteps).map((s) => ({ id: s.key, title: s.title, description: s.detail ?? null })),
  };
}

const loaders = {
  async homepage(repos) {
    const content = await loadHomepageContent(repos);
    return {
      view: composeHomepageData(content, homepagePreviewData, { routes: PREVIEW_ROUTES }),
      records: [
        ...recordStates("site_settings", content.siteSettings),
        ...recordStates("banners", content.banners),
        ...recordStates("pages", content.historyPage),
        ...recordStates("sacred_items", content.sacredItems),
        ...recordStates("news", content.news),
        ...recordStates("gallery_items", content.gallery),
        ...recordStates("faqs", content.faqs),
      ],
    };
  },
  async "sacred-items"(repos) {
    const result = await repos.sacredItems({ limit: 200 });
    const view = result.status === "ok" ? adaptFeaturedItems(result, { catalogHref: null, items: [] }, { limit: 200, routes: PREVIEW_ROUTES }).items : [];
    return { view, records: [...recordStates("sacred_items", result), ...[...(result.categories?.values() ?? [])].flatMap((c) => recordStates("categories", { data: c }))] };
  },
  async news(repos) {
    const result = await repos.news({ limit: 200 });
    return { view: result.status === "ok" ? adaptLatestNews(result, [], { limit: 200, routes: PREVIEW_ROUTES }) : [], records: recordStates("news", result) };
  },
  async history(repos) {
    const result = await repos.historyPage();
    return { view: historyView(result), records: recordStates("pages", result) };
  },
  async gallery(repos) {
    const result = await repos.gallery({ limit: 200 });
    return { view: result.status === "ok" ? adaptGallery(result, [{ layout: "" }], { limit: 200 }) : [], records: recordStates("gallery_items", result) };
  },
};

// service: the content service (src/server/cms/index.js getContentService()).
export async function loadPreviewSection(section, grant, { service }) {
  if (!PREVIEW_SECTIONS.includes(section)) throw new Error(`Unknown preview section: ${section}`);
  // Throws DraftAccessDeniedError before any query when the grant is invalid.
  const repos = service.withDraftAccess(grant);
  const { view, records } = await loaders[section](repos);
  return {
    section,
    isPreview: true,
    // Shown on every preview page; preview pages are never indexed.
    robots: { index: false, follow: false },
    viewer: { subject: grant.subject, role: grant.role },
    view,
    records,
    summary: {
      records: records.length,
      openPlaceholders: records.reduce((n, r) => n + r.openPlaceholders.length, 0),
      byStage: records.reduce((counts, r) => ({ ...counts, [r.stage]: (counts[r.stage] ?? 0) + 1 }), {}),
    },
  };
}
