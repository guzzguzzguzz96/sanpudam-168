import "server-only";
import { createDraftAccessPolicy } from "../cms/draft-access.js";
import { isAdminPrincipal } from "./admin-access.js";
import { PREVIEW_ROLES } from "./config.js";

// Draft preview authorization. A request may read drafts only when:
//   1. it carries an admin principal issued by getAdminAccess() for this
//      request (Auth.js session + current allowlist);
//   2. the principal's role is a preview role (owner or editor).
// Query strings, headers, preview flags, Client Review flags, and objects
// shaped like a principal are ignored.

// Returns { allowed: true, principal } or { allowed: false, reason }.
export function authorizePreviewPrincipal(principal) {
  if (!isAdminPrincipal(principal)) return { allowed: false, reason: "not_signed_in" };
  if (!PREVIEW_ROLES.includes(principal.role)) return { allowed: false, reason: "role_not_allowed" };
  return { allowed: true, principal: { subject: principal.subject, role: principal.role } };
}

// request: { principal } built on the server by getPreviewGrant(). Other
// properties are deliberately not read.
export function createPreviewAccessPolicy() {
  return createDraftAccessPolicy({
    authorize: async (request) => {
      const result = authorizePreviewPrincipal(request?.principal);
      return result.allowed ? result.principal : null;
    },
  });
}

export const previewAccessPolicy = createPreviewAccessPolicy();
