# Client Review Mode (Phase 02.5.6 — Step C1.1)

Status: **code complete; live staging verification is blocked by Atlas Network Access** (see §10, Step C1.1b). Review mode is off by default, and production cannot enable it. No database record, Cloudinary asset, or Vercel setting has been changed.

Client Review Mode renders the migrated draft content from `sanpudam168_staging` and its Cloudinary media on the existing homepage, so the owner can check it before anything is approved. It is a separate read-only path. It does not use the public publication rules or authenticated draft preview (Step B1), and it does not change either of them.

## 1. Activation

The decision comes from the server environment only (`src/lib/review-mode.js`). Request hostnames, headers, query strings, and cookies are never read, and no `NEXT_PUBLIC_*` variable is involved.

| Case | Required values | Result |
|---|---|---|
| Vercel Preview | `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=dev`, `CLIENT_REVIEW_ENABLED=true` | enabled (`vercel-preview`) |
| Local machine | `CLIENT_REVIEW_LOCAL=true`, with no hosting or CI variables present (`VERCEL*`, `CI`, `NETLIFY`, `RENDER`, …) | enabled (`local`) |
| `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production` | any value | **always denied** |
| Anything else | flags other than exactly `true`, other branches, `VERCEL_ENV=development`, missing values | denied |

### Local testing

Real staging content needs the review credentials from §3. Without them, the page shows the "unavailable" state.

```bash
# Development
CLIENT_REVIEW_LOCAL=true npm run dev

# Production build: set the flag for both build and start
CLIENT_REVIEW_LOCAL=true npm run build
CLIENT_REVIEW_LOCAL=true npm start
```

Put `CLIENT_REVIEW_MONGODB_URI` and `CLIENT_REVIEW_MONGODB_DB_NAME` in `.env.local`, which is gitignored. Vercel system variables are never needed locally.

The response headers and the image allowlist are fixed when `next.config.mjs` loads, which happens at build and at server start. The prerendered shell is fixed at build time. A local production build therefore needs the flag at build time as well as at start. On Vercel the same variables apply to both, so this is automatic.

## 2. Variables

None of these has a value in the repository. `.env.example` lists the names only.

| Variable | Scope | Purpose |
|---|---|---|
| `CLIENT_REVIEW_ENABLED` | Vercel **Preview** environment, `dev` branch only | must be `true` to enable deployed review |
| `CLIENT_REVIEW_LOCAL` | local `.env.local` only; never set on Vercel (that denies review) | local opt-in |
| `CLIENT_REVIEW_MONGODB_URI` | Preview (dev) and local; **never Production** | dedicated read-only user (§3) |
| `CLIENT_REVIEW_MONGODB_DB_NAME` | same | must be exactly `sanpudam168_staging` |
| `CLIENT_REVIEW_DNS_SERVERS` | local only, optional (ignored outside local review mode) | up to 4 resolver IPs, e.g. `8.8.8.8,1.1.1.1`, for machines whose system resolver refuses the SRV lookup that `mongodb+srv://` needs. Applied process-wide to the local server only |

Only `src/server/review/config.js` reads `CLIENT_REVIEW_MONGODB_*`, and there is **no fallback** to `MONGODB_URI` or `MONGODB_DB_NAME`. Tests check both points.

## 3. MongoDB read-only account (required, not yet created)

Create a separate Atlas database user for review:

- built-in role **`read` on `sanpudam168_staging` only**: no other roles, no `readAnyDatabase`, no `readWrite`, no `atlasAdmin`
- separate from the migration/admin user and from any future CMS user
- Atlas Network Access set for Vercel, and the password rotated when maintainers change

The app enforces this when it connects (`src/server/review/connection.js`):

1. It opens a separate Mongoose connection (`autoCreate`, `autoIndex`, and `bufferCommands` all off). The default connection in `src/lib/db.js` is never used.
2. The connected database must be exactly `sanpudam168_staging`.
3. It runs `connectionStatus` (a read-only command). The user must hold **only** `read@sanpudam168_staging`. An admin or read-write user is refused before any content query, and the page shows "unavailable".
4. Models are exposed through facades that offer only `find`/`findOne`.

## 4. Data flow

```
page.js / layout.js
  isClientReviewEnabled()            env policy (false in production)
   ├─ false → existing static homepage (homepage-preview.js), unchanged
   └─ true  → <Suspense> ReviewHomepage / ReviewSiteHeader / ReviewSiteFooter   (src/app/_review)
                getReviewHomepage()          src/server/review/index.js
                  await connection()        request time only; never prerendered
                  React cache()             one load per request (layout + page)
                  loadReviewHomepage()      re-checks the policy → review grant
                    readReviewDatabaseConfig()       no fallback
                    connectReviewDatabase()          read-only safeguards
                    contentService.withReviewAccess(grant)   review scope
                    buildReviewHomepage()   explicit-field DTO + labels
```

- **Review scope** (`src/server/cms/policy.js`, `review-access.js`): includes draft and published records, excludes archived ones, and excludes media with rejected rights. It needs a review grant, which comes from a WeakSet-backed issuer, so draft grants and review grants cannot be swapped. Errors degrade to `unavailable` instead of throwing.
- **Public scope is unchanged.** It still requires published + approved + no open placeholders. The public homepage still does not read MongoDB.
- **DTO** (`src/server/review/homepage.js`): plain JSON with string ids. It contains no `legacy`, `migration`, `review`, `placeholderFields`, `rights`, `assetId`, `mediaMapping`, or `publicId`. Contact values are text only, never `tel:` or LINE links.
- Only the presentation collections are read: site settings, banners, pages, sacred items, categories, news, gallery, FAQs, and media assets. Reviews, team members, and videos are not read.

## 5. Production isolation and leak prevention

- `VERCEL_ENV=production` always denies review. When review is off, `next.config.mjs` adds no headers and no image hosts, and `/` stays fully static. This was verified with a build: `/` is static (`○`).
- With review on, `/` becomes Partial Prerender (`◐`). The static shell holds only the public header, footer, and an empty fallback. Draft data is fetched only after `connection()`. A scan of the build found no staging URLs, contact values, or migrated text in `.next/server/app` or `.next/static`; a boundary test repeats this scan after every build.
- Response headers in review mode, on every path (HTML and RSC): `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store, max-age=0`. These were verified with a local production server. The root layout also sets `robots: noindex, nofollow`.
- There is no `"use cache"` on review queries, and no API route, sitemap, robots file, feed, or structured data exists.
- The image allowlist (review mode only) is `https://res.cloudinary.com/lov36obu/image/upload/*/sanpudam168/staging/**`.

## 6. Vercel Deployment Protection — release blocker

An environment flag cannot prove who can open a deployment. Deployed draft review relies on **Vercel Deployment Protection** (Vercel Authentication or password protection) on Preview deployments, including the `dev` branch alias.

**Deployed draft review must not be released or shared until someone verifies in the Vercel dashboard that protection is enabled, and confirms that an unauthenticated request to the Preview URL is refused.** That verification has **not** been done. No Vercel setting was read or changed in this step.

## 7. Homepage coverage

The figures below are expected values from the migration source (`migration/content/*.json`, imported 1:1 per the import report). They have **not** been confirmed with a live read, because review credentials do not exist yet.

| Section | Source | Available | Shown on homepage | Notes |
|---|---|---|---|---|
| Logo / identity | `site_settings.branding.logo`, `identity` | 1 logo (192×192) | header, 40 px | Low resolution: icon size only, never hero or OG |
| Hero | `banners` (sortOrder) | 4 | 1 (first resolvable) | No `enabled` field exists. Title = `identity.name`, text = `identity.tagline` |
| Quick info | `site_settings.openingHours`, `contact` | hours, location, phone/LINE | 3 items | `openingHours.daysText` labeled as sample. Contacts labeled unverified |
| Quick actions | — | — | in-page anchors only | No LINE or maps action (unverified) |
| About | `pages.history` (`homeIntroHeading`, `intro`, `historyImage`) | 1 | 1 | Labeled: `historyBody` still a placeholder |
| Featured items | `sacred_items` + `categories` | 5 | 3 (by sortOrder) | **No featured flag exists in the schema.** One item has a sample excerpt (หลวงปู่ศิลา); others have pending details |
| Worship guidance | `pages.worshipSteps` | 4 steps | 4 | The whole `worshipSteps` field is flagged placeholder, so the section is labeled sample |
| News | `news` (date desc) | 3 | 3 | One item has a sample title and date |
| Gallery | `gallery_items` (shrine-main) | 10 | 5 | Mosaic layout preserved |
| Visit | `site_settings.contact`, `openingHours` | — | 3 details | `directionsUrl` is a `share.google` link, rejected (not embedded, not linked) |
| FAQ | `faqs` with `showOnHome=true` | 6 | 3 | The 3 home FAQs have no placeholders |
| Footer | `site_settings` identity, contact, `socialLinks` | 3 social links | text only | All labeled unverified, none clickable |
| Reviews | `reviews` | 3 samples | **omitted** | Sample testimonials; consent pending |
| Team | `team_members` | 2 | **omitted** | Placeholders; no photos; consent pending |
| Video | `videos` | 1 | **omitted** | No video file (`videoAssetId` null) |

Missing source content: an owner-confirmed Google Maps link, a high-resolution logo, a mobile banner crop (`mobileImage` is null for every banner), confirmed opening days, confirmed worship steps, a video file, and genuine, consented testimonials.

## 8. Broken links (for C2)

The homepage links to routes that do not exist yet (they return 404):

- `/history`: navigation, footer, and the "อ่านประวัติเพิ่มเติม" button
- `/sakkara`: navigation and footer
- `/news`: navigation, footer, and "ดูข่าวสารทั้งหมด"
- `/visit`: navigation, footer, and the worship-guide "ข้อมูลการเยี่ยมชม" button

Newly found in migrated data:

- `site_settings.contact.directionsUrl = https://share.google/…` is not a Google Maps URL and is rejected.
- Social links (Facebook share link, TikTok, YouTube) are unverified. They are displayed as text only and have not been visited.

## 9. Remaining blockers

1. **Add this machine's public IP (or the Vercel egress range for Preview) to Atlas Network Access** for the cluster that hosts `sanpudam168_staging`. This requires Atlas project access and is not something the app can do.
2. Re-run §10 steps 2–5 once the network refusal is resolved: the role check, live counts and references, homepage rendering with real images, and visual QA.
3. Set the `CLIENT_REVIEW_*` variables in Vercel Preview (`dev`). This needs approval.
4. Verify Vercel Deployment Protection on Preview (§6) before sharing any deployed review URL.
5. Collect the owner content listed in §7 and fix the routes in §8 (C2).

## 10. Step C1.1b — live staging verification (2026-10-31)

Starting commit `2ff07df`. All checks used only `CLIENT_REVIEW_MONGODB_*`. The verification script removed `MONGODB_URI` and `MONGODB_DB_NAME` from its own process, so the admin/migration credentials could not be used even by accident. Only read commands were attempted.

| Check | Result |
|---|---|
| Review variables present locally | `CLIENT_REVIEW_LOCAL`, `CLIENT_REVIEW_MONGODB_URI`, `CLIENT_REVIEW_MONGODB_DB_NAME` set (values not printed) |
| SRV DNS lookup | **Failed** on this Windows machine with the system resolver (`querySrv ECONNREFUSED`; Node's resolver is `127.0.0.1`). Fixed for local review with the optional `CLIENT_REVIEW_DNS_SERVERS`; resolution then succeeds on every request |
| TLS connection to Atlas | **Refused by all 3 replica-set members**: `tlsv1 alert internal error` (SSL alert 80), topology `ReplicaSetNoPrimary`. This is Atlas's response to a client IP that is not on the project's Network Access list, and it happens before authentication. Outbound TCP 27017 and 443 to other hosts work. Running outside the command sandbox was not permitted |
| Database name / `read@staging` role check | **Not run**: blocked before authentication. The checks remain enforced in code (`connectReviewDatabase`) and covered by tests |
| Live counts, media/category references, ordering, `showOnHome`, status, placeholders | **Not run** (blocked). The baseline in §7 is still unconfirmed |
| Homepage with real content and images; Cloudinary / `next/image` delivery | **Not run** (blocked) |
| Visual QA with real content (390 / 768 / 1440) | **Not run** (blocked). Only the unavailable state was inspected (C1.1) |
| Local `next build` + `next start` with `CLIENT_REVIEW_LOCAL=true` | Pass: `/` is Partial Prerender; HTML and RSC responses carry `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store, max-age=0`; the page shows the honest unavailable state; logs are sanitized (no host or credentials) |
| Simulated Vercel production build (`VERCEL=1`, `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `CLIENT_REVIEW_ENABLED=true`, plus `CLIENT_REVIEW_LOCAL` and review credentials from `.env.local`) | Pass: `/` fully static; routes-manifest has no headers; `images.remotePatterns` is empty |
| Build output scan (review build) | Pass: no migrated text, staging URLs, contact values, or `CLIENT_REVIEW_*` names in `.next/server/app` or `.next/static` |
| Vercel Deployment Protection | **NOT VERIFIED** |
