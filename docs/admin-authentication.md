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
| `/admin` | Protected landing page: name, Google account email, role, a "ดูรายการเนื้อหา" link, and sign-out |
| `/admin/content` | Read-only list of the staging content for owners and editors (§10) |
| `/admin/content/[type]/[id]` | Read-only detail of one record: fields, placeholder flags, images (§11) |
| `/admin/content/faqs/[id]/edit` | Owner-only FAQ edit form (question and answer), saved through the staging writer (§13) |
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

## 9. Owner verification (2026-11-12)

The owner verified on the `dev` Preview:
- Google sign-in;
- the `owner` role on `/admin`;
- sign-out;
- the redirect to `/admin/login` when logged out.

## 10. Read-only content inventory (`/admin/content`)

**Access:**
- On the server, before anything is read: `getAdminAccess()` must return `ok`, and `hasAdminRole(principal, CONTENT_INVENTORY_ROLES)` must pass. `CONTENT_INVENTORY_ROLES` is `owner` and `editor`, defined in `config.js`.
- Anyone else is redirected to `/admin/login`, and the response contains no content.
- `loadContentInventory(principal)` checks the principal again (`requireAdminRole`) before reading configuration or opening a connection.
- Client Review flags, Vercel access, and other cookies grant nothing.

**Data:**
- **Source:** the dedicated read-only staging connection (`src/server/review/connection.js`), which checks the database name and the `read` role. The same per-process connection serves the review pages.
- **Content collections only:** site settings, pages, sacred items, categories, news, banners, gallery items, FAQs, videos, reviews, team members. Media assets, migration runs, and other operational collections are not read.
- **Minimal fields:** each query projects only the title field(s), `status`, `review.status`, and an ordering field. The page receives `{ id, type, typeLabel, title, publication, review }` per record.
- **Titles:** banners and gallery items have no title field, so they use their image caption, or a neutral "ลำดับ n" title.
- **Labels:**
  - `status`: draft → ฉบับร่าง, published → เผยแพร่แล้ว, archived → เก็บถาวร.
  - `review.status`: pending_review → รอตรวจทาน, approved → อนุมัติแล้ว, changes_requested → ขอให้แก้ไข.
  - Any other stored value is shown as "ค่าที่ไม่รู้จัก (<value>)"; a missing value as "ไม่มีข้อมูล".

**Environment:**
- **Available:** a local machine (no hosting markers) and the Vercel Preview of branch `dev`.
- **Refused:** Production (`VERCEL_ENV` or `VERCEL_TARGET_ENV` = production) and every other hosted environment. It shows "ไม่เปิดใช้ในสภาพแวดล้อมนี้" without connecting.
- **Independent of review flags:** the gate does not use the Client Review flags.

**Filter:**
- `?type=<key>`, rendered as links (no client JavaScript).
- Only one known key applies. Anything else (unknown, repeated, or odd values) shows every type with a generic notice, and the value is never echoed.

**States:**
- empty database;
- empty type;
- unavailable (environment, configuration, connection, or query failure; logs carry no connection details).

**Responses:** `private, no-store, max-age=0` and `noindex, nofollow` (`/admin/:path*`).

**Read-only:** there are no edit or publish actions, and the module issues only `find`. A boundary test rejects write methods.

**Verification (local `next build` + `next start`, live staging, 2026-11-12):**
- **Session:** a locally minted session for placeholder accounts in the process environment, not a Google login.
- **Counts:** 39 records in 11 types, identical to the migration baseline. Site settings 1, pages 1, sacred items 5, categories 3, news 3, banners 4, gallery 10, FAQs 6, videos 1, reviews 3, team 2. All 39 are `draft` / `pending_review`, with no unknown or missing values.
- **Access:** logged-out, unlisted-account, and forged-cookie requests are redirected and contain no titles. Both owner and editor see the list.
- **Filter:** `news` shows 3 rows. Seven invalid values show all 39 with the notice and are never echoed.
- **Layout:** 390 px (cards), 768 and 1440 px (table). No overflow, 49–50 px filter targets, visible focus.
- **Production markers at runtime:** the unavailable message and no connection attempt.

## 11. Read-only content detail (`/admin/content/[type]/[id]`)

The owner verified `/admin/content` on the `dev` Preview (2026-11-12): 39 records, 3 under the news filter, and the login redirect after sign-out.

**Navigation:**
- Every title in the list links to its detail page.
- When a type filter is active, the link carries `?from=<type>`, and the "← กลับไปยังรายการเนื้อหา" link returns to that filtered list.
- Unknown or odd `from` values return to the full list.

**Access and validation, in order:**
1. `getAdminAccess()` + `hasAdminRole(principal, CONTENT_INVENTORY_ROLES)` on the server; anyone else is redirected to `/admin/login`.
2. `loadContentDetail(principal, ...)` checks the principal again.
3. `type` must be a key of the inventory's content types, and `id` must be a 24-character lowercase hex ObjectId. Both are checked before configuration, connection, or query; an invalid URL is "not found" without a database call.
4. The environment gate and the read-only staging connection are the same as for the list.
5. An exact `findOne({ _id })` in the requested collection only. A valid id under another type is "not found".

**States:**
- **"ไม่พบรายการนี้":** an invalid type, an invalid id, or no record.
- **"ยังแสดงรายการเนื้อหาไม่ได้":** the environment, configuration, connection, or query failed.

**Fields** (`src/server/admin/content-detail.js`):
- **Explicit field maps:** each of the 11 types has its own map with Thai labels, and only those fields are projected and returned.
- **Never read:** `legacy`, `migration`, created/updated-by ids, media-mapping legacy URLs and notes, consent notes, analytics settings, and media-asset owner, notes, and source.
- **Text:** shown exactly as stored (including legacy `**` markers), as React text with line breaks preserved. It is never HTML.
- **Contact URLs:** shown as text, not links.
- **Status:** publication and review status, and the review note when one is recorded.
- **Placeholder flags:**
  - Open flags (`status: placeholder`) are listed with the field name, status, note, and recorded date.
  - The matching fields are marked "ข้อความตัวอย่าง".
  - Resolved flags are counted.
- **Images:**
  - A 480 px Cloudinary thumbnail (rendered unoptimized, so it does not depend on review-mode image settings) for usable image assets.
  - Caption, alt text, and the file state ("เชื่อมไฟล์ภาพแล้ว", "ไม่มีการอ้างอิงไฟล์ภาพ", "ไม่พบไฟล์ภาพในคลังสื่อ", "ไฟล์ภาพถูกลบแล้ว").
  - Rights and approval exactly as recorded on the asset. A missing or unknown value is "ยังไม่ยืนยัน".
  - Assets with rejected rights or a deleted file have no thumbnail.

**Verification (local `next build` + `next start`, live staging, 2026-11-12):**
- **Session:** a locally minted session for placeholder accounts in the process environment, not a Google login.
- **All 39 records:** every list link opens its detail page. All 11 types are covered, each response is `private, no-store` + `noindex`, and none contains migration or credential metadata.
- **Placeholder flags:** all 32 open flags appear on their records and each maps to a displayed field (site settings 2, page 2, sacred items 7, news 3, FAQs 3, video 2, reviews 9, team 4). This matches the migration baseline.
- **Images:** 17 thumbnails, all loading. Every recorded rights status is "อนุมัติสิทธิ์แล้ว" and every approval status "รออนุมัติภาพ".
- **Missing media:** the video file and both team-member photos are absent and are shown as such.
- **Denied access:** logged-out, unlisted-account, and forged-cookie requests are redirected and contain no record content. The only images are the review header logo.
- **Invalid URLs:** nine cases (unknown or migration type, malformed, uppercase, short or operator-like ids, a valid id under another type, an unknown valid id, script in the type) all show "not found" and echo nothing.
- **Layout:** 390, 768, and 1440 px with no overflow, labels above values on mobile and beside them from 768 px, and a visible focus ring on the back link.
- **Production markers at runtime:** "ไม่เปิดใช้ในสภาพแวดล้อมนี้" with no connection attempt.

## 12. Gaps before the first edit form

Items 1–4 are addressed for FAQs in §13. Items 5–8 remain open.

1. **A write path:** a separate staging database user with `readWrite` on `sanpudam168_staging` only, its own variables, and the same database-name and role checks inverted for write. The current connection is read-only by design.
2. **Edit permissions:** decide which fields an `editor` may change and which are `owner`-only (for example contact details and site settings). Today both roles have the same read access.
3. **Server actions:** validation through the existing Mongoose schemas, and a concurrency check. The schemas use `optimisticConcurrency`, so the form must carry the record version.
4. **Audit trail:** who changed what and when (`updatedBy` exists but there is no user collection yet; a principal is a Google subject and email). Record changes before any edit ships.
5. **Placeholder workflow:** how an edit resolves a flag (`replaced` / `confirmed_correct`, `resolvedAt`, `resolvedBy`), and whether review status changes with it.
6. **Text format:** the editor for `legacy-text-v1` (paragraphs and `**bold**`), and how its preview matches the public renderer.
7. **Media:** the first form should only reuse existing assets. Uploads, rights confirmation, and approval are separate steps.
8. **Publishing:** stays out of scope. The publish rules in `models/shared.js` (approved review, no open placeholders, resolved media) will gate it later.

## 13. First edit form: FAQ question and answer (2026-11-12)

**Route:** `/admin/content/faqs/<id>/edit`, implemented as `/admin/content/[type]/[id]/edit` and accepting only `type = faqs`. A static `faqs/` folder would have shadowed the FAQ detail pages.

**Who and what:**
- **Who:** `owner` only (`FAQ_EDIT_ROLES` in `config.js`). Editors see a Thai permission notice, and no stored text is read for them.
- **Which FAQs:** existing FAQs whose stored values are `status: "draft"` and `review.status: "pending_review"` (the schema's enums), with a numeric `__v`. All six staging FAQs qualify.
- **What changes:** only `question` (max 140) and `answer` (max 800), with the limits read from the FAQ schema.
- **Unchanged by a save:** `status`, `review`, `showOnHome`, `sortOrder`, and the placeholder flags stay exactly as stored.
- **Placeholder flags:** an open flag on an edited field is shown in the form. After saving, the detail page says the field still carries it.
- **Text format:** plain text. CRLF becomes LF and the ends are trimmed. The question must be one line. Control characters are refused.
- **Preview:** the same markup and React text rendering as the public FAQ (`components/home/faq.js`).

**Request flow:**
1. **The page:**
   - `getAdminAccess()`;
   - the owner role;
   - writer readiness (configuration only, no connection);
   - the FAQ loaded through the **read-only** staging reader.
2. **Every save** (`actions.js` → `saveFaqEdit`):
   - the session and the current allowlist again;
   - the owner role;
   - the id;
   - a field allowlist: exactly `question`, `answer`, and `version`. Next.js `$ACTION_*` entries are ignored; anything else, a repeat, or a non-text value is refused.
   - field validation;
   - environment (local or the `dev` Preview only);
   - writer configuration;
   - the writer connection.
3. **One MongoDB transaction** (snapshot read concern, majority write concern):
   - read the FAQ;
   - check eligibility and that the submitted version equals the stored `__v`;
   - stop with **no write and no audit entry** if nothing changed;
   - otherwise `updateOne({ _id, __v, status: "draft", "review.status": "pending_review" }, { $set: { changed fields, updatedAt }, $inc: { __v: 1 } })`. A match count other than 1 means "stale".
   - insert the audit entry.

   If the insert fails, the transaction aborts and the FAQ is unchanged.
4. **Messages:** the Thai messages cover permission, invalid request, validation (per field), stale form, no longer eligible, unavailable, and failed. Every error message says nothing was saved.

**Audit entry** (`admin_audit_log`):
`{ at, action: "faq.update", collection: "faqs", recordId, actor: { provider: "google", subject, email, role }, changes: { <field>: { before, after } }, version: { before, after } }`. Only changed fields are recorded.

**Writer configuration** (`src/server/cms-writer/`, the only write path in `src/`):
- **Variables:**
  - `CMS_WRITER_MONGODB_URI`: the dedicated writer user, never the review or migration account; there is no fallback.
  - `CMS_WRITER_MONGODB_DB_NAME`: exactly `sanpudam168_staging`.
  - `CMS_WRITER_DNS_SERVERS`: optional, IPv4, local only.
- **Values:** names only in `.env.example`; values never logged.
- **On connect it refuses unless:**
  - the database name matches;
  - `connectionStatus` with `showPrivileges` shows **only** `find` + `update` on `sanpudam168_staging.faqs` and `insert` (optionally `find`) on `sanpudam168_staging.admin_audit_log`. Built-in `readWrite`, admin roles, other collections, other databases, `remove`, and `createCollection` are all refused.
  - the audit collection already exists.

**Minimum database privileges:** an Atlas custom role `cmsFaqWriter`:

| Resource | Actions |
|---|---|
| `sanpudam168_staging.faqs` | `find`, `update` |
| `sanpudam168_staging.admin_audit_log` | `insert` (`find` optional, for reading the log later) |

**Transactions:** they need a replica set. Atlas clusters are replica sets, and transactions need no extra privilege.

**Verification (2026-11-12):**
- **Unit and integration:** `tests/cms/faq-editor.test.mjs`, 16 tests. It uses an isolated in-memory store with transaction semantics (staged writes applied only on commit).
  - **Covered:** successful save with an exact audit entry; unchanged submissions (also with CRLF and spaces); stale versions; a concurrent commit during the transaction; audit failure rolling back the FAQ; editor, forged, and missing principals; 16 malformed requests and 6 bad ids rejected before any connection; schema-limit validation; ineligible records; fail-closed configuration in Production, other hosts, or with only the reader configured.
  - **Writer checks covered:** 13 privilege shapes, database-name, privilege, and audit-collection refusals, and the store's session, snapshot, and majority wiring.
  - **Not covered:** the real MongoDB transaction engine. Installing a local test database (`mongodb-memory-server`) was not permitted in this round.
- **Local build, read-only staging:**
  - **Setup:** placeholder owner/editor sessions; the writer pointed at a closed local port, so no write was possible.
  - **Link and access:** the "แก้ไข FAQ" link appears for the owner on FAQs only. The form shows the stored values and version 0 from staging. Editors get the permission notice. Logged-out, unlisted, and forged sessions are redirected. Four invalid URLs show "not found".
  - **Submissions:** a real change got "ระบบบันทึกยังไม่พร้อมใช้งาน" with the typed text kept. An empty question, a 141-character question, and an injected `status` field got their Thai errors.
  - **Layout:** 390 and 1440 px with no overflow.
  - **Missing writer:** the notice, with no form.
  - **Production-built server:** "แก้ไขไม่ได้ในสภาพแวดล้อมนี้".
  - **Afterwards:** staging still showed version 0 and the original answer.

**Staging smoke test (pending owner approval; not run):**
1. **Owner setup:**
   - create the collection `admin_audit_log` in `sanpudam168_staging`;
   - create the custom role above and a user `cms-faq-writer-staging` with only that role;
   - put its connection string in `.env.local` as `CMS_WRITER_MONGODB_URI`, with `CMS_WRITER_MONGODB_DB_NAME=sanpudam168_staging` (plus `CMS_WRITER_DNS_SERVERS=8.8.8.8,1.1.1.1` if local DNS needs it).
2. **Target:** FAQ `f108969e97d5375e1e5cb190`. It is FAQ 4, "ไหว้ศาลปู่ดำต้องใช้ของไหว้อะไรบ้าง", not shown on the homepage, with an open placeholder flag on `answer`.
3. **Temporary change:** in `/admin/content/faqs/f108969e97d5375e1e5cb190/edit`, append " (ทดสอบระบบแก้ไข)" to the end of the answer and save.
4. **Expected after saving:**
   - the detail page says "บันทึกการแก้ไขแล้ว" and that คำตอบ still has the placeholder status;
   - `__v` is 1;
   - one audit entry has `before` = the original answer;
   - the status and flags are unchanged;
   - the public review pages are unchanged (the FAQ is not on the homepage).
5. **Restore:** open the form again, remove the appended text so the answer is exactly the original (it is also the audit entry's `before` value), and save. Expect `__v` 2 and a second audit entry whose `after` equals the original text.
6. **Also check:**
   - submitting again without changes reports "ไม่มีการเปลี่ยนแปลง" and adds no audit entry;
   - a second browser tab opened before step 3 reports the stale-form message.
