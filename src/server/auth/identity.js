import "server-only";
import { ADMIN_ROLES, MAX_SESSION_SECONDS, normalizeEmail } from "./config.js";

// Pure identity and authorization rules for admin sign-in. Auth.js proves
// who signed in (Google OIDC); these functions decide what that identity
// may do, using only server configuration.
//
// The session carries identity claims only (provider, Google subject,
// verified email, display name, sign-in time). Roles are never stored in
// it: every protected request looks the email up in the current allowlist,
// so a removed account or a changed role takes effect immediately.

export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";
const CLOCK_SKEW_SECONDS = 60;
const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const MAX_NAME_LENGTH = 200;

const nowSeconds = (now) => Math.floor((now ?? Date.now()) / 1000);

function displayName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name ? name.slice(0, MAX_NAME_LENGTH) : null;
}

// Accepts only a Google OIDC sign-in whose profile has a subject, an email,
// and email_verified === true. Returns { subject, email, name } or null.
export function resolveGoogleIdentity({ account, profile } = {}) {
  if (account?.provider !== "google" || account?.type !== "oidc") return null;
  if (profile?.email_verified !== true) return null;
  const subject = profile?.sub;
  if (typeof subject !== "string" || !SUBJECT_PATTERN.test(subject)) return null;
  if (account.providerAccountId !== undefined && account.providerAccountId !== subject) return null;
  const email = normalizeEmail(profile?.email);
  if (!email) return null;
  return { subject, email, name: displayName(profile?.name) };
}

// The JWT payload written at sign-in. Nothing from the provider's tokens
// (access, refresh, or ID token) is kept.
export function sessionClaims(identity, { now } = {}) {
  return { sub: identity.subject, email: identity.email, name: identity.name, provider: "google", authTime: nowSeconds(now) };
}

// What `auth()` returns on the server (and /api/auth/session to the signed-in
// browser): identity only, no role, no provider tokens.
export function sessionFromClaims(session, token) {
  return {
    expires: session?.expires,
    user: { name: token?.name ?? null, email: token?.email ?? null },
    identity: { provider: token?.provider ?? null, subject: token?.sub ?? null, email: token?.email ?? null, authTime: token?.authTime ?? null },
  };
}

// Decides access for one request from the session and the current
// configuration. Returns { status, principal }:
//   unavailable      admin sign-in is not configured
//   unauthenticated  no session, or a malformed, foreign, or expired one
//   forbidden        a valid Google identity that is not (or no longer) allowed
//   ok               principal = { subject, email, name, role, authTime }
export function evaluateAdminSession(session, config, { now } = {}) {
  if (!config?.enabled) return { status: "unavailable", principal: null };
  const identity = session?.identity;
  if (!identity || identity.provider !== "google") return { status: "unauthenticated", principal: null };
  const { subject, authTime } = identity;
  const email = normalizeEmail(identity.email);
  if (typeof subject !== "string" || !SUBJECT_PATTERN.test(subject) || !email || email !== identity.email) {
    return { status: "unauthenticated", principal: null };
  }
  const current = nowSeconds(now);
  if (!Number.isInteger(authTime) || authTime > current + CLOCK_SKEW_SECONDS || current - authTime > MAX_SESSION_SECONDS) {
    return { status: "unauthenticated", principal: null };
  }
  const role = config.accounts.get(email);
  if (!ADMIN_ROLES.includes(role)) return { status: "forbidden", principal: null };
  return {
    status: "ok",
    principal: Object.freeze({ subject, email, name: displayName(session?.user?.name), role, authTime }),
  };
}

// Post-sign-in and sign-out destinations: same origin and under /admin
// only. Anything else, including other origins, protocol-relative URLs,
// and URLs with credentials, falls back to the admin home.
export function safeAdminRedirect(url, baseUrl) {
  const base = new URL(baseUrl);
  const fallback = `${base.origin}${ADMIN_HOME}`;
  let target;
  try {
    target = new URL(url, base);
  } catch {
    return fallback;
  }
  if (target.origin !== base.origin || target.username || target.password) return fallback;
  if (target.pathname !== ADMIN_HOME && !target.pathname.startsWith(`${ADMIN_HOME}/`)) return fallback;
  return `${target.origin}${target.pathname}${target.search}`;
}
