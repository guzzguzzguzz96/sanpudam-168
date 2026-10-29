import "server-only";

// Draft access guard. Draft content is readable only with a grant issued by
// a server-side authorizer. No authorizer exists yet (Auth.js and CMS roles
// are a later phase), so the default policy denies every request: draft
// access fails closed, and there is no preview route.
//
// Grants are opaque objects tracked in a WeakSet. An object built elsewhere,
// even with the same shape, is not a grant.

export class DraftAccessDeniedError extends Error {
  constructor(message = "Draft access is not authorized.") {
    super(message);
    this.name = "DraftAccessDeniedError";
  }
}

const issuedGrants = new WeakSet();

// authorize: async (request) => { subject: string, role: string } | null.
// Only a real, session-validating authorizer may be passed here.
export function createDraftAccessPolicy({ authorize }) {
  if (typeof authorize !== "function") throw new TypeError("authorize must be a function.");

  return {
    async requestGrant(request) {
      const principal = await authorize(request);
      if (!principal?.subject || !principal?.role) throw new DraftAccessDeniedError();
      const grant = Object.freeze({ subject: String(principal.subject), role: String(principal.role), issuedAt: Date.now() });
      issuedGrants.add(grant);
      return grant;
    },
  };
}

export function assertDraftGrant(grant) {
  if (!grant || typeof grant !== "object" || !issuedGrants.has(grant)) throw new DraftAccessDeniedError();
  return grant;
}

// The policy the application uses until an authorizer is approved: deny all.
export const defaultDraftAccessPolicy = createDraftAccessPolicy({ authorize: async () => null });
