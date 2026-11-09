import "server-only";
import { connection } from "next/server";
import { ADMIN_ROLES, readAuthConfig } from "./config.js";
import { evaluateAdminSession } from "./identity.js";

// Server-side admin authorization for pages, route handlers, and server
// actions. The only authentication source is the Auth.js session; Client
// Review flags, Vercel access cookies, and any other cookie or header play
// no part. Call it in every protected request, before reading or changing
// anything:
//
//   const access = await getAdminAccess();
//   if (access.status !== "ok") ...            // deny on the server
//   requireAdminRole(access.principal, ["owner"]);
//
// Principals are frozen objects tracked in a WeakSet: an object built
// elsewhere, even with the same shape, is not a principal.

const issuedPrincipals = new WeakSet();

export class AdminAccessDeniedError extends Error {
  constructor(message = "Admin access is not authorized.") {
    super(message);
    this.name = "AdminAccessDeniedError";
  }
}

// readSession is injectable for tests; by default it is Auth.js `auth()`,
// loaded only when admin sign-in is configured.
async function defaultReadSession() {
  const { auth } = await import("./auth.js");
  return auth();
}

// Returns { status: "ok" | "forbidden" | "unauthenticated" | "unavailable", principal }.
// It always waits for the request first, so neither the configuration nor
// the decision is ever captured in a prerendered page. `waitForRequest` is
// injectable for tests only.
export async function getAdminAccess({ env = process.env, readSession = defaultReadSession, now, waitForRequest = connection } = {}) {
  await waitForRequest();
  const config = readAuthConfig(env);
  if (!config.enabled) return { status: "unavailable", principal: null };
  const session = await readSession();
  const result = evaluateAdminSession(session, config, { now: typeof now === "function" ? now() : now });
  if (result.principal) issuedPrincipals.add(result.principal);
  return result;
}

export function isAdminPrincipal(principal) {
  return Boolean(principal) && typeof principal === "object" && issuedPrincipals.has(principal);
}

export function hasAdminRole(principal, roles = ADMIN_ROLES) {
  return isAdminPrincipal(principal) && roles.includes(principal.role);
}

// For server actions and route handlers of future CMS modules.
export function requireAdminRole(principal, roles = ADMIN_ROLES) {
  if (!hasAdminRole(principal, roles)) throw new AdminAccessDeniedError();
  return principal;
}
