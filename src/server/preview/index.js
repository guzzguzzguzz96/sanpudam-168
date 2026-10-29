import "server-only";
import { getPreviewGrant } from "../auth/request-session.js";
import { getContentService } from "../cms/index.js";
import { loadPreviewSection } from "./preview-content.js";

export { PREVIEW_SECTIONS } from "./preview-content.js";
export { STAGE_LABELS, describePublicationState } from "./publication-state.js";

// Entry point for a future private preview page. Returns null when the
// request is not authorized; the page must then call notFound() and render
// nothing else. Authorization happens here, on the server, before any draft
// query. Not used by any route yet.
export async function getAuthorizedPreview(section) {
  const grant = await getPreviewGrant();
  if (!grant) return null;
  return loadPreviewSection(section, grant, { service: getContentService() });
}
