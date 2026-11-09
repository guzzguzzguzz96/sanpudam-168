import "server-only";
import { DraftAccessDeniedError } from "../cms/draft-access.js";
import { getAdminAccess } from "./admin-access.js";
import { previewAccessPolicy } from "./preview-access.js";

// Next.js request binding for preview authorization. Call it at the top of
// a private preview page or route handler, before any draft query:
//
//   const grant = await getPreviewGrant();
//   if (!grant) notFound();   // no hint that a preview exists
//
// The Auth.js session is read per request, so preview output is never
// prerendered or shared with other visitors. Not used by any route yet.

export async function getPreviewGrant({ getAccess = getAdminAccess, policy = previewAccessPolicy } = {}) {
  const access = await getAccess();
  if (access?.status !== "ok") return null;
  try {
    return await policy.requestGrant({ principal: access.principal });
  } catch (error) {
    if (error instanceof DraftAccessDeniedError) return null;
    throw error;
  }
}
