# Admin authentication (Google Sign-In via Auth.js)

Status (2026-11-09): **foundation implemented and verified locally without a completed Google login.** Sign-in initiation was checked against Google with the owner's local OAuth client. The full round trip (Google consent → callback → `/admin`) has **not** been tested, because no approved account is configured yet (§7). There are no CMS features, draft-preview routes, or database writes.

## 1. Dependency

- **Version:** `next-auth@5.0.0-beta.32`, pinned exactly (with `@auth/core@0.41.3`).
- **Why a prerelease:**
  - v5 is the version Auth.js documents for the App Router. Its installation guide installs `next-auth@beta`.
  - v5 provides `auth()` for Server Components, the `app/api/auth/[...nextauth]` handler, Next 16 `proxy.js` support, and the `AUTH_*` variable names.
  - The stable v4 line (`4.24.15`) also declares Next 16 support, but it is built around the older API.
- **Compatibility:**
  - Peer ranges `next ^14 || ^15 || ^16` and `react ^18.2 || ^19` cover Next.js 16.4.2 and React 19.3.0.
  - Runs on Node 24.
  - `npm audit` reports no advisories for next-auth or its dependencies.
- **Upgrades:** pinned because betas can change behaviour. Upgrade deliberately and re-run `tests/cms/admin-auth.test.mjs`.

## 2. Routes

| Route | Purpose |
|---|---|
| `/admin/login` | Thai explanation and the "เข้าสู่ระบบด้วย Google" button. It also shows the denied state (`?error=AccessDenied`, or a signed-in account that is not allowed, with a sign-out button), a generic error, or "not available" when the configuration is incomplete |
| `/admin` | Protected landing page: name, Google account email, role, and sign-out. Nothing else |
| `/api/auth/[...nextauth]` | Auth.js handlers (CSRF, sign-in, Google callback, session, sign-out). Returns **404** while the configuration is incomplete |

- **Headers:** all three answer with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store, max-age=0` in every environment (`next.config.mjs`). Pages also set `robots` metadata.
- **No link in:** the public site has no link to the admin area.

## 3. Architecture

| Module | Role | Change |
|---|---|---|
| `src/server/auth/config.js` | The only reader of `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_ALLOWED_ACCOUNTS`. Validates everything and fails closed. Reports problems as variable names only | **Adapted** (previously `AUTH_SECRET` + `CMS_PREVIEW_ALLOWED_SUBJECTS`) |
| `src/server/auth/identity.js` | Pure rules: Google identity validation, minimal token claims, per-request decision (`evaluateAdminSession`), redirect guard | **New** |
| `src/server/auth/auth-config.js` | The Auth.js configuration (Google provider, JWT session, callbacks, sanitized logger) | **New** |
| `src/server/auth/auth.js` | The Auth.js instance (`handlers`, `auth`, `signIn`, `signOut`), configured lazily per request | **New** |
| `src/server/auth/admin-access.js` | `getAdminAccess()`, `hasAdminRole()`, `requireAdminRole()`: the server-side authorization API for future CMS modules | **New** |
| `src/server/auth/preview-access.js` | Draft-preview authorization. Now accepts only principals issued by `getAdminAccess()` with role `owner` or `editor` | **Adapted** |
| `src/server/auth/request-session.js` | `getPreviewGrant()` now uses `getAdminAccess()` instead of reading a cookie | **Adapted** |
| `src/server/auth/session-token.js` | Custom HMAC token and the `__Host-sanpudam-cms-session` cookie | **Retired** (deleted) so no second session path exists. Its 8-hour policy is kept in `config.js` |
| `src/server/cms/draft-access.js`, `src/server/preview/*` | Draft grants and the preview loaders | **Retained** unchanged. Still no preview route |

**Data flow for a protected request:**
1. `getAdminAccess()` waits for the request (`connection()`), so nothing is prerendered.
2. It reads the configuration.
3. It reads the Auth.js session (`auth()`).
4. `evaluateAdminSession()` checks the identity claims and the session age.
5. It looks the email up in the **current** allowlist and returns a frozen principal `{ subject, email, name, role, authTime }`.
6. The principal is tracked in a WeakSet. An object of the same shape built elsewhere grants nothing.

## 4. Authorization rules

- **Sign-in:**
  - Only Google OIDC (`provider: "google"`, `type: "oidc"`).
  - Requires a subject (`sub`), an email, and `email_verified === true`.
  - The email is normalized (trimmed, lowercased) and must exactly match an entry in `ADMIN_ALLOWED_ACCOUNTS`.
  - Display name, email domain, and Google Workspace domain are never used.
- **Identity:** the Google subject is kept as the account identity. The email is the allowlist key.
- **Roles:**
  - `owner` and `editor` (the existing project roles; both may use the future draft preview).
  - The role is **never stored in the session**. It is read from `ADMIN_ALLOWED_ACCOUNTS` on every protected request, so a removed account or a changed role applies on the next request.
  - Browser-supplied session updates are ignored.
- **Session:**
  - JWT strategy, no database adapter.
  - `maxAge` 8 hours, and an absolute 8-hour bound from sign-in (`authTime`), matching the earlier project policy.
  - There is no proxy, so sessions do not roll.
  - The token holds `sub`, `email`, `name`, `provider`, and `authTime` only. Provider access, refresh, and ID tokens are discarded.
- **Fails closed:**
  - A missing variable, a short secret, an invalid `AUTH_URL`, an empty allowlist, an unknown role, a duplicate email, or any malformed entry disables sign-in completely.
  - So does a set `AUTH_REDIRECT_PROXY_URL`.
- **Origin:**
  - `AUTH_URL` must be an exact origin (https, or http on localhost).
  - With it set, Auth.js builds every sign-in and callback URL from it. `Host` and `X-Forwarded-Host` are ignored (verified in tests and against the running app).
- **Redirects:** after sign-in or sign-out, only same-origin paths under `/admin` are allowed. Everything else becomes `/admin`.
- **OAuth protections:**
  - The Auth.js CSRF token and default cookie settings are kept. Auth.js cookies are HttpOnly, SameSite=Lax, and `__Secure-` prefixed on https.
  - The Google checks are set explicitly to PKCE (S256), `state`, and `nonce`. The Auth.js default is PKCE only.
- **Logs:** Auth.js errors are logged as `[admin-auth] <ErrorType>` only (no causes, stacks, tokens, or cookie values). Unavailable configuration logs variable names only.

## 5. Separation from Client Review

- **No shared code in either direction:** admin authentication does not read `CLIENT_REVIEW_*`, Vercel variables, review modules, or any cookie other than through Auth.js. Review and site modules do not import admin authentication. Boundary tests enforce both directions.
- **Review flags grant nothing:** a review flag, a Vercel `_vercel_jwt` cookie, the retired `__Host-sanpudam-cms-session` cookie, or a forged Auth.js cookie never grants admin access (tested).
- **Client review needs no login:** Client Review still works without any login. There is no proxy/middleware, and public and review pages are unchanged.
- **Banner on admin pages:** in a review build the review banner and the review header and footer also appear on admin pages, because they share the root layout. This is cosmetic.

## 6. Verification

| Check | Result |
|---|---|
| Unit and integration tests (`tests/cms/admin-auth.test.mjs`, `auth-preview.test.mjs`, `boundaries.test.mjs`) | 115/115 pass. Covered: config validation and fail-closed cases; Google identity rules (missing or false `email_verified`, wrong provider, missing subject); exact allowlist match; server-derived roles; removed account and changed role with an existing session; client-supplied roles; review flags and legacy/Vercel cookies; redirect rejection; the real Auth.js pipeline offline (CSRF, Google redirect parameters, sanitized callback cookie, forged/foreign-secret/unsigned tokens rejected, sessions without roles); sanitized logging |
| Lint | Pass |
| Build without OAuth credentials | Pass. `/admin` and `/admin/login` are Partial Prerender (the access decision streams per request); `/api/auth/*` is dynamic and returns 404; the login page shows "not available"; no mock login |
| Production-context build (`VERCEL_ENV=production`, review flags present) | Pass. Review mode off; the only header rules are the three admin paths; none of the local credential values appear in `.next/static` or `.next/server/app` |
| Real sign-in initiation (local, owner's OAuth client) | Redirects to Google with the configured client id, `redirect_uri=http://localhost:3000/api/auth/callback/google`, scope `openid email profile`, PKCE, `state`, and `nonce`, no offline access, even with hostile `Host`/`X-Forwarded-Host`. External `callbackUrl` becomes `/admin` |
| Page states and layout at 390/768/1440 | Login, denied, signed-in-but-not-allowed, and the landing page. No overflow, 48 px buttons, visible focus ring. The landing page was rendered with a **locally minted test session** for a placeholder account (`layout-check@example.test`, process environment only), not a Google login |
| Public/review regression | Review pages keep their headers and banner; no admin link appears |
| End-to-end Google login | **Not tested** (no approved account configured) |

**Known behaviour:**
- **Redirect status:** an unauthenticated request to `/admin` returns HTTP 200 with a streamed redirect to `/admin/login`, not a 307. This is the same App Shell mechanism as the soft 404 in `docs/client-review-mode.md` §13. No protected content is rendered.
- **Sign-out scope:** signing out ends the site session only. The Google account stays signed in to Google.

## 7. Owner setup

No values belong in git. These names are also listed in `.env.example`.

**Google Cloud Console** (an OAuth 2.0 Client ID of type *Web application*):

- **Authorized redirect URIs:**
  - local: `http://localhost:3000/api/auth/callback/google`
  - dev Preview: `https://sanpudam-168-git-dev-guzzguzzguzz96s-projects.vercel.app/api/auth/callback/google`
  - Never a wildcard, and never per-deployment hash URLs.
- **Authorized JavaScript origins:** not required for this flow.
- **OAuth consent screen:**
  - Scopes: `openid`, `email`, `profile` only.
  - While the app is in *Testing*, add each approved Google account as a test user. Google refuses other accounts before they reach the site.
  - Publishing the app is a separate decision for production.

**Variables:**

| Variable | Local (`.env.local`) | Vercel Preview (branch `dev` only) |
|---|---|---|
| `AUTH_SECRET` | generate with `npx auth secret` (it writes to `.env.local`); keep **exactly one** `AUTH_SECRET` line | a separate value, generated the same way |
| `AUTH_URL` | `http://localhost:3000` | `https://sanpudam-168-git-dev-guzzguzzguzz96s-projects.vercel.app` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from the Web client | same client (with the Preview redirect URI) or a separate one |
| `ADMIN_ALLOWED_ACCOUNTS` | `your.email@gmail.com:owner` | approved accounts only |
| `AUTH_REDIRECT_PROXY_URL` | must be unset | must be unset |

- **Allowlist format:** comma-separated `email:role` pairs, for example `owner@example.com:owner,editor@example.com:editor`.
  - Roles: `owner`, `editor`.
  - Email matching ignores case and surrounding spaces; nothing else is normalized (no dot or `+` aliasing).
  - One malformed entry disables sign-in for everyone, so check the login page after editing.
- **Retired variable:** `CMS_PREVIEW_ALLOWED_SUBJECTS` is no longer read and can be removed.

**Initial rollout (Preview only):**
1. Set the variables above for the Preview environment of branch `dev` only, never for Production.
2. Redeploy `dev`.
3. Open `/admin/login` on the stable alias and sign in with an approved account.

Sign-in started from a per-deployment URL returns to the stable alias, because `AUTH_URL` fixes the origin.

**Vercel Deployment Protection:**
- Keep it on, and do not disable it to make OAuth work.
- Google's redirect back to the callback is a normal browser navigation from a user who has already passed protection, so it is expected to work. Confirm this during the first Preview sign-in.
- If the callback is blocked, report it rather than changing protection.

**Production** configuration (production origin, separate secret, published consent screen, production allowlist) is a separate future task.

## 8. Troubleshooting "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน"

The login page shows this generic message whenever the configuration is incomplete. The cause appears only in the **server log**, never in the page.
- **In development (`next dev`)** the log has safe reason codes (variable name + failed rule), once per distinct problem. For example:
  ```
  [admin-auth] sign-in unavailable (development diagnostic): ADMIN_ALLOWED_ACCOUNTS:entry_1_missing_role. ...
  ```
- **In other environments** it lists variable names only.

| Code | Fix |
|---|---|
| `AUTH_SECRET:missing` / `too_short` | generate with `npx auth secret`; keep exactly one line |
| `AUTH_URL:missing` / `not_an_allowed_origin` | an exact origin: `http://localhost:3000` locally, the https Preview URL on Vercel |
| `AUTH_GOOGLE_ID:missing`, `AUTH_GOOGLE_SECRET:missing` | from the Google OAuth Web client |
| `ADMIN_ALLOWED_ACCOUNTS:missing` | add the variable |
| `ADMIN_ALLOWED_ACCOUNTS:entry_<n>_missing_role` | entry *n* needs `:owner` or `:editor` (an email alone is not accepted, and no default role exists) |
| `ADMIN_ALLOWED_ACCOUNTS:entry_<n>_invalid_email` / `unknown_role` / `duplicate_email` | fix entry *n*; one bad entry disables sign-in for everyone |
| `AUTH_REDIRECT_PROXY_URL:must_be_unset` | remove it |

- **Applying changes:** the configuration is read on every request. `next dev` reloads `.env.local` automatically when it changes; `next start` and deployments need a restart or redeploy.
- **First local incident (2026-11-09):** the allowlist held an email without `:role`. That matched the earlier email-only format of the retired `CMS_PREVIEW_ALLOWED_SUBJECTS`.

## 9. Next step after login works

Add the first read-only CMS screen:
- an `/admin/content` list of draft and published records with their publication stage, using the existing `getPreviewGrant()` → `loadPreviewSection()` path;
- `getAdminAccess()` checked at the top of the page.

No editing, uploads, or database writes in that step. Write access (a separate staging `readWrite` database user and audited server actions with `requireAdminRole`) follows only after approval.
