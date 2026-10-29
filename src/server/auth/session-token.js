import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Stateless, signed CMS session tokens (HMAC-SHA256).
//
// Format: "v1.<base64url(JSON payload)>.<base64url(signature)>"
// Payload (minimal, no personal data):
//   { sub, role, sid, iat, exp }   times in seconds since the epoch
//
// The format is fixed: there is no algorithm field to negotiate, so a token
// cannot ask to be verified differently. Tokens are issued only by a future
// server-side sign-in flow; this module never creates users or credentials.

export const TOKEN_VERSION = "v1";
export const MAX_SESSION_SECONDS = 8 * 60 * 60;
export const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 4096;
const SUBJECT_PATTERN = /^[A-Za-z0-9_.:@-]{1,128}$/;
const ROLE_PATTERN = /^[a-z_]{1,32}$/;

const encode = (value) => Buffer.from(value).toString("base64url");
const nowSeconds = (now) => Math.floor((now ?? Date.now()) / 1000);

function sign(secret, data) {
  return createHmac("sha256", secret).update(data).digest();
}

// Server-side issuance for a future, approved sign-in flow (and for tests).
export function signSessionToken({ subject, role, ttlSeconds = MAX_SESSION_SECONDS }, { secret, now } = {}) {
  if (!secret) throw new Error("A session secret is required.");
  if (!SUBJECT_PATTERN.test(subject ?? "") || !ROLE_PATTERN.test(role ?? "")) throw new Error("Invalid session subject or role.");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_SESSION_SECONDS) throw new Error("Invalid session lifetime.");
  const iat = nowSeconds(now);
  const payload = encode(JSON.stringify({ sub: subject, role, sid: randomUUID(), iat, exp: iat + ttlSeconds }));
  const data = `${TOKEN_VERSION}.${payload}`;
  return `${data}.${sign(secret, data).toString("base64url")}`;
}

// Returns { ok: true, session } or { ok: false, reason }. Never throws for
// bad input; reasons are for server logs and tests, not for clients.
export function verifySessionToken(token, { secret, now } = {}) {
  if (!secret) return { ok: false, reason: "not_configured" };
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "missing" };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: "malformed" };
  const [, payloadPart, signaturePart] = parts;

  const expected = sign(secret, `${TOKEN_VERSION}.${payloadPart}`);
  let given;
  try {
    given = Buffer.from(signaturePart, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const { sub, role, sid, iat, exp } = payload ?? {};
  if (!SUBJECT_PATTERN.test(sub ?? "") || !ROLE_PATTERN.test(role ?? "") || typeof sid !== "string" || !Number.isInteger(iat) || !Number.isInteger(exp)) {
    return { ok: false, reason: "malformed" };
  }

  const current = nowSeconds(now);
  if (iat > current + CLOCK_SKEW_SECONDS) return { ok: false, reason: "not_yet_valid" };
  if (exp - iat > MAX_SESSION_SECONDS || exp <= iat) return { ok: false, reason: "invalid_lifetime" };
  if (exp <= current) return { ok: false, reason: "expired" };

  return { ok: true, session: { subject: sub, role, sessionId: sid, issuedAt: iat, expiresAt: exp } };
}
