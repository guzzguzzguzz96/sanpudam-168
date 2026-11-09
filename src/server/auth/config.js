import "server-only";

// Admin authentication settings, read only on the server and only in this
// file. Missing, weak, or malformed values disable admin sign-in entirely
// (fail closed); nothing here has a default credential or account.
//
//   AUTH_SECRET             >= 32 characters, random (npx auth secret)
//   AUTH_URL                exact origin of this deployment, e.g.
//                           http://localhost:3000 or the stable dev Preview
//                           URL. Required: sign-in URLs never come from
//                           request headers.
//   AUTH_GOOGLE_ID          Google OAuth Web client id
//   AUTH_GOOGLE_SECRET      Google OAuth Web client secret
//   ADMIN_ALLOWED_ACCOUNTS  comma-separated email:role pairs, e.g.
//                           owner@example.com:owner,editor@example.com:editor
//                           (empty or any malformed entry = nobody)
//
// AUTH_REDIRECT_PROXY_URL must not be set: Auth.js would otherwise relay
// OAuth callbacks through another deployment.

export const MIN_SECRET_LENGTH = 32;
export const MAX_SESSION_SECONDS = 8 * 60 * 60;
export const ADMIN_ROLES = Object.freeze(["owner", "editor"]);
// Both admin roles may read drafts in the (future) private preview.
export const PREVIEW_ROLES = ADMIN_ROLES;

const EMAIL_PATTERN = /^[^\s@:,]+@[^\s@:,]+\.[^\s@:,]+$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const text = (value) => (typeof value === "string" ? value.trim() : "");

export function normalizeEmail(value) {
  const email = text(value).toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null;
}

// "a@x.com:owner, b@x.com:editor" -> Map(email -> role), or null when the
// list is empty, an entry is malformed, a role is unknown, or an email
// repeats. One bad entry rejects the whole list.
export function parseAllowedAccounts(value) {
  const entries = text(value).split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) return null;
  const accounts = new Map();
  for (const entry of entries) {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) return null;
    const email = normalizeEmail(entry.slice(0, separator));
    const role = entry.slice(separator + 1).trim();
    if (!email || !ADMIN_ROLES.includes(role) || accounts.has(email)) return null;
    accounts.set(email, role);
  }
  return accounts;
}

// Origin only: https, or http on a loopback host; no path, query, or
// credentials.
export function parseAuthOrigin(value) {
  let url;
  try {
    url = new URL(text(value));
  } catch {
    return null;
  }
  const secure = url.protocol === "https:";
  const local = url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  if (!(secure || local) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin;
}

export function readAuthConfig(env = process.env) {
  const secret = text(env?.AUTH_SECRET);
  const origin = parseAuthOrigin(env?.AUTH_URL);
  const clientId = text(env?.AUTH_GOOGLE_ID);
  const clientSecret = text(env?.AUTH_GOOGLE_SECRET);
  const accounts = parseAllowedAccounts(env?.ADMIN_ALLOWED_ACCOUNTS);

  // Variable names only: never values.
  const problems = [
    ...(secret.length >= MIN_SECRET_LENGTH ? [] : ["AUTH_SECRET"]),
    ...(origin ? [] : ["AUTH_URL"]),
    ...(clientId ? [] : ["AUTH_GOOGLE_ID"]),
    ...(clientSecret ? [] : ["AUTH_GOOGLE_SECRET"]),
    ...(accounts ? [] : ["ADMIN_ALLOWED_ACCOUNTS"]),
    ...(text(env?.AUTH_REDIRECT_PROXY_URL) ? ["AUTH_REDIRECT_PROXY_URL (must be unset)"] : []),
  ];
  const enabled = problems.length === 0;

  return Object.freeze({
    enabled,
    problems: Object.freeze(problems),
    secret: enabled ? secret : null,
    origin: enabled ? origin : null,
    google: enabled ? Object.freeze({ clientId, clientSecret }) : null,
    accounts: enabled ? accounts : new Map(),
  });
}
