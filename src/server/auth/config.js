import "server-only";
import { MAX_SESSION_SECONDS } from "./session-token.js";

// Authentication settings, read only on the server. Missing or weak values
// disable CMS sessions entirely (fail closed); nothing here has a default
// credential.
//
//   AUTH_SECRET                   >= 32 characters, random (openssl rand -base64 32)
//   CMS_PREVIEW_ALLOWED_SUBJECTS  comma-separated user ids allowed to preview
//                                 drafts (empty = nobody)

export const SESSION_COOKIE_NAME = "__Host-sanpudam-cms-session";
export const MIN_SECRET_LENGTH = 32;
export const PREVIEW_ROLES = Object.freeze(["owner", "editor"]);

// Cookie options for the future sign-in flow: HttpOnly, Secure, SameSite
// strict, host-only (__Host- prefix: no Domain, Path=/).
export const SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: MAX_SESSION_SECONDS,
});

export function readAuthConfig(env = process.env) {
  const secret = typeof env.AUTH_SECRET === "string" ? env.AUTH_SECRET : "";
  const allowedSubjects = new Set(
    String(env.CMS_PREVIEW_ALLOWED_SUBJECTS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const secretValid = secret.length >= MIN_SECRET_LENGTH;
  return {
    secret: secretValid ? secret : null,
    allowedSubjects,
    enabled: secretValid && allowedSubjects.size > 0,
    problems: [
      ...(secretValid ? [] : ["AUTH_SECRET is missing or shorter than 32 characters"]),
      ...(allowedSubjects.size ? [] : ["CMS_PREVIEW_ALLOWED_SUBJECTS is empty"]),
    ],
  };
}
