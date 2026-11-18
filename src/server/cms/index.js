import "server-only";
import { connectToDatabase, sanitizeError } from "../../lib/db.js";
import { Banner, Category, Faq, GalleryItem, MediaAsset, News, Page, SacredItem, SiteSettings } from "../../models/index.js";
import { createContentService } from "./content-service.js";

// Server-only entry point of the CMS data layer. The public site reads it
// through src/server/site/public.js (published scope only).

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

// Draft content: requires a grant from a draft access policy. The default
// policy denies everyone, so this currently always throws.
export function getDraftContent(grant) {
  return getContentService().withDraftAccess(grant);
}
