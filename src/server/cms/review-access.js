import "server-only";

// Client Review access guard. Separate from draft access (draft-access.js):
// a review grant comes from the environment-based review policy
// (src/lib/review-mode.js), not from a signed-in editor, and it opens only
// the read-only review scope. A draft grant is not a review grant and vice
// versa.
//
// Grants are opaque objects tracked in a WeakSet. An object built elsewhere,
// even with the same shape, is not a grant.

export class ReviewAccessDeniedError extends Error {
  constructor(message = "Client review access is not enabled.") {
    super(message);
    this.name = "ReviewAccessDeniedError";
  }
}

const issuedGrants = new WeakSet();

// evaluate: () => { enabled, mode, reason } (evaluateReviewMode bound to the
// server environment). Request data is deliberately not an input.
export function createReviewAccessPolicy({ evaluate }) {
  if (typeof evaluate !== "function") throw new TypeError("evaluate must be a function.");

  return {
    requestGrant() {
      const decision = evaluate();
      if (decision?.enabled !== true || !decision.mode) throw new ReviewAccessDeniedError();
      const grant = Object.freeze({ kind: "client-review", mode: String(decision.mode), issuedAt: Date.now() });
      issuedGrants.add(grant);
      return grant;
    },
  };
}

export function assertReviewGrant(grant) {
  if (!grant || typeof grant !== "object" || !issuedGrants.has(grant)) throw new ReviewAccessDeniedError();
  return grant;
}
