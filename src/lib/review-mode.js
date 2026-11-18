// Client Review Mode policy (docs/client-review-mode.md). Pure and
// dependency-free so next.config.mjs and the server data layer apply the
// same decision. It reads only the environment object it is given, never
// request data: hostnames, headers, query strings, and cookies cannot
// enable review mode.
//
// Review mode is enabled only in one of two cases; everything else,
// including missing or unexpected values, is denied:
//
//   Vercel Preview   VERCEL=1, VERCEL_ENV=preview, VERCEL_GIT_COMMIT_REF=dev,
//                    CLIENT_REVIEW_ENABLED=true
//   Local machine    CLIENT_REVIEW_LOCAL=true and no hosting-platform
//                    variables present (works with `next dev` and with a
//                    local `next build && next start`)
//
// VERCEL_ENV=production always denies, whatever the flags say. Flags must be
// exactly "true". The Vercel system variables are never needed locally.

export const REVIEW_FLAG = "CLIENT_REVIEW_ENABLED";
export const LOCAL_REVIEW_FLAG = "CLIENT_REVIEW_LOCAL";
export const REVIEW_BRANCH = "dev";

// Variables that indicate a hosted or CI environment. Local review mode is
// refused when any of them is present.
export const HOSTED_ENVIRONMENT_MARKERS = Object.freeze([
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "VERCEL_URL",
  "VERCEL_GIT_COMMIT_REF",
  "CI",
  "NETLIFY",
  "RENDER",
  "RAILWAY_ENVIRONMENT",
  "FLY_APP_NAME",
  "K_SERVICE",
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV",
]);

const isSet = (env, name) => typeof env?.[name] === "string" && env[name] !== "";
const deny = (reason) => Object.freeze({ enabled: false, mode: null, reason });
const allow = (mode) => Object.freeze({ enabled: true, mode, reason: null });

// Returns { enabled, mode: "vercel-preview" | "local" | null, reason }.
// reason is for server logs and tests, never for visitors.
export function evaluateReviewMode(env) {
  if (!env || typeof env !== "object") return deny("no_environment");
  if (env.VERCEL_ENV === "production" || env.VERCEL_TARGET_ENV === "production") return deny("production");

  if (isSet(env, "VERCEL") || isSet(env, "VERCEL_ENV") || isSet(env, "VERCEL_TARGET_ENV")) {
    if (env.VERCEL !== "1") return deny("unexpected_platform");
    if (env.VERCEL_ENV !== "preview") return deny("not_preview");
    if (isSet(env, "VERCEL_TARGET_ENV") && env.VERCEL_TARGET_ENV !== "preview") return deny("not_preview");
    if (env.VERCEL_GIT_COMMIT_REF !== REVIEW_BRANCH) return deny("branch_not_allowed");
    if (isSet(env, LOCAL_REVIEW_FLAG)) return deny("local_flag_on_hosted");
    if (env[REVIEW_FLAG] !== "true") return deny("flag_not_enabled");
    return allow("vercel-preview");
  }

  if (HOSTED_ENVIRONMENT_MARKERS.some((name) => isSet(env, name))) return deny("hosted_environment");
  if (env[LOCAL_REVIEW_FLAG] !== "true") return deny("local_opt_in_missing");
  return allow("local");
}

// Response headers for every path while review mode is enabled; none
// otherwise, so production responses are unchanged.
export function reviewResponseHeaders(decision) {
  if (!decision?.enabled) return [];
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ],
    },
  ];
}
