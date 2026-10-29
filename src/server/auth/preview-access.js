import "server-only";
import { createDraftAccessPolicy } from "../cms/draft-access.js";
import { PREVIEW_ROLES, readAuthConfig } from "./config.js";
import { verifySessionToken } from "./session-token.js";

// Draft preview authorization. A request may read drafts only when:
//   1. CMS sessions are configured (valid AUTH_SECRET, non-empty allowlist);
//   2. its session cookie carries a token with a valid signature;
//   3. the token is within its lifetime (not expired, not issued in the future);
//   4. the role is a preview role (owner or editor);
//   5. the subject is listed in CMS_PREVIEW_ALLOWED_SUBJECTS.
// Only the session token is consulted. Query strings, headers, preview
// flags, and any other client-supplied value are ignored.

// Returns { allowed: true, principal } or { allowed: false, reason }.
export function authorizePreviewSession(token, { env = process.env, now } = {}) {
  const config = readAuthConfig(env);
  if (!config.enabled) return { allowed: false, reason: "not_configured" };
  const verified = verifySessionToken(token, { secret: config.secret, now });
  if (!verified.ok) return { allowed: false, reason: verified.reason };
  const { subject, role } = verified.session;
  if (!PREVIEW_ROLES.includes(role)) return { allowed: false, reason: "role_not_allowed" };
  if (!config.allowedSubjects.has(subject)) return { allowed: false, reason: "subject_not_allowed" };
  return { allowed: true, principal: { subject, role } };
}

// request: { sessionToken } built on the server from the session cookie
// (see request-session.js). Other properties are deliberately not read.
export function createPreviewAccessPolicy({ env = process.env, now } = {}) {
  return createDraftAccessPolicy({
    authorize: async (request) => {
      const result = authorizePreviewSession(request?.sessionToken, { env, now: typeof now === "function" ? now() : now });
      return result.allowed ? result.principal : null;
    },
  });
}

export const previewAccessPolicy = createPreviewAccessPolicy();
