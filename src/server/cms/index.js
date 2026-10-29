import "server-only";
import { connectToDatabase, sanitizeError } from "../../lib/db.js";
import { Banner, Category, Faq, GalleryItem, MediaAsset, News, Page, SacredItem, SiteSettings } from "../../models/index.js";
import { createContentService } from "./content-service.js";
import { loadHomepageContent } from "./homepage.js";

// Server-only entry point of the CMS data layer. Not used by any route yet;
// connecting public pages needs separate approval
// (docs/frontend-data-integration.md §8).

export { composeHomepageData } from "./adapters.js";
export { DraftAccessDeniedError, defaultDraftAccessPolicy } from "./draft-access.js";
export { cloudinaryImageUrl } from "./media.js";

let service = null;

export function getContentService() {
  service ??= createContentService({
    models: { Banner, Category, Faq, GalleryItem, MediaAsset, News, Page, SacredItem, SiteSettings },
    connect: () => connectToDatabase(),
    sanitize: (error) => sanitizeError(error, process.env.MONGODB_URI),
  });
  return service;
}

// Published content only.
export function getPublicContent() {
  return getContentService().public;
}

export function getPublicHomepageContent() {
  return loadHomepageContent(getPublicContent());
}

// Draft content: requires a grant from a draft access policy. The default
// policy denies everyone, so this currently always throws.
export function getDraftContent(grant) {
  return getContentService().withDraftAccess(grant);
}
