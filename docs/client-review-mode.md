# Client Review Mode (Phase 02.5.6 — Step C1.1)

Status: **verified locally against live staging data** (§10, §12, §13). The owner has demonstrated the real homepage and its images working on a Vercel Preview deployment. That demonstration does **not** verify the C2 routes, the current Atlas Network Access configuration for Vercel, or Vercel Deployment Protection, and none of those has been checked here. Review mode is off by default, and production cannot enable it. No database record, Cloudinary asset, or Vercel setting has been changed.

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

The figures below were confirmed with a live read of `sanpudam168_staging` on 2026-10-31 (§10, round 3).

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
| Visit | `site_settings.contact`, `openingHours` + review override | — | 3 details + directions button | Directions use the owner-confirmed link (§11). The imported `share.google` value is still rejected and never shown |
| FAQ | `faqs` with `showOnHome=true` | 6 | 3 | The 3 home FAQs have no placeholders |
| Footer | `site_settings` identity, contact, `socialLinks` | 3 social links | text only | All labeled unverified, none clickable |
| Reviews | `reviews` | 3 samples | **omitted** | Sample testimonials; consent pending |
| Team | `team_members` | 2 | **omitted** | Placeholders; no photos; consent pending |
| Video | `videos` | 1 | **omitted** | No video file (`videoAssetId` null) |

Missing source content: an owner-confirmed Google Maps link, a high-resolution logo, a mobile banner crop (`mobileImage` is null for every banner), confirmed opening days, confirmed worship steps, a video file, and genuine, consented testimonials.

## 8. Broken links (for C2)

`/history`, `/sakkara`, and `/sakkara/[slug]` exist since C2.1 (§12); `/news`, `/news/[slug]`, and `/visit` exist since C2.2 (§13). A crawl of a local review build (2026-11-01) followed every internal link from `/`:

- it reached 13 pages, all rendering content (no not-found UI);
- all 17 in-page anchors resolve;
- the only external link is the owner-confirmed Maps URL.

The crawl did not cover public mode or a deployed environment.

Newly found in migrated data:

- `site_settings.contact.directionsUrl = https://share.google/…` is not a Google Maps URL and is rejected. In review mode it is superseded by the owner-confirmed link (§11); the staging record is unchanged.
- Social links (Facebook share link, TikTok, YouTube) are unverified. They are displayed as text only and have not been visited.

## 9. Remaining blockers

1. Confirm the `CLIENT_REVIEW_*` variables in Vercel Preview (`dev`) and Atlas Network Access for Vercel. The owner showed the homepage working on Preview; the C2 routes there and the current Atlas configuration are unverified.
2. If the admin connection string used in round 2 was shared beyond the migration operator, rotate that password.
3. Design decision: the approved 5-tile gallery mosaic leaves empty cells at 768 px and 1440 px with real photos (round 3). The same geometry applies to the prototype placeholders.
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

### Round 2 (2026-10-31, from `10130eb`, after the owner updated Atlas Network Access)

Execution environment: the local Windows host, with Node v24 running as a Claude Code child process and no proxy variables set. Two independent services reported the same public egress address, and that address is the one that has to be on the Atlas list. One verification attempt was made, using only `CLIENT_REVIEW_MONGODB_*`.

| Check | Result |
|---|---|
| DNS (with `CLIENT_REVIEW_DNS_SERVERS`), TLS, authentication | **Pass.** The earlier TLS refusal is gone |
| Connected database | `sanpudam168_staging` (pass) |
| Read-only role check | **Refused (correctly).** The authenticated user holds `atlasAdmin@admin`, not `read@sanpudam168_staging`. `connectReviewDatabase` rejected it before any content query, and the running app showed the unavailable state with the sanitized message `Review connection user must hold only read@sanpudam168_staging.` |
| Live counts, references, ordering, placeholders | **Not run.** Reading content with an admin account would break §3; the enforcement was not relaxed |
| Real homepage, Cloudinary images, visual QA at 390/768/1440 | **Not run** (blocked by the item above) |
| Local review build (`CLIENT_REVIEW_LOCAL=true`) + `next start` | Pass: `/` is Partial Prerender; HTML and RSC responses carry `noindex, nofollow` and `private, no-store, max-age=0`; no staging content in the response |
| Public build (local review disabled: `CLIENT_REVIEW_LOCAL` empty) | Pass: `/` static, no review headers, no remote image patterns |
| Simulated Vercel production (`VERCEL=1`, `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `CLIENT_REVIEW_ENABLED=true`, plus the review credentials and local flag present) | Pass: `/` static, no review headers, no remote image patterns |
| Lint / tests | Pass / 77 of 77 |
| Vercel Deployment Protection, Preview connectivity | **NOT VERIFIED** |

### Round 3 (2026-10-31, from `c464a99`, after the owner replaced the review account)

Same local host and egress address as round 2. Only `CLIENT_REVIEW_MONGODB_*` was used; the verification script removed `MONGODB_URI` from its process. The intermediate account (`readAnyDatabase@admin`) was also refused by the role check before this round.

**Connection and safeguards:** pass. Database `sanpudam168_staging`; roles exactly `[{ role: "read", db: "sanpudam168_staging" }]`; connection and schemas have `autoCreate`/`autoIndex` off. The collection list was identical before and after, and only read commands were issued.

**Live data vs. the migration baseline:** all 12 collection counts match (56 records; `migration_runs` excluded): media_assets 17, categories 3, site_settings 1, pages 1, sacred_items 5, news 3, banners 4, gallery_items 10, faqs 6, videos 1, reviews 3, team_members 2.

- All 39 content records are `draft` / `pending_review`, with 32 open placeholder flags across 16 records.
- Media: 17 assets with rights `approved`, none deleted, all delivered from `res.cloudinary.com/lov36obu/.../sanpudam168/staging/`.
- References: 31/31 image references and 5/5 sacred-item categories resolve. `sortOrder` is contiguous (banners 1–4, items 1–5, gallery 1–10).
- News dates: 2026-03-20, 2026-03-16, 2026-03-16. FAQ `showOnHome`: 1–3 true, 4–6 false.
- Site settings: logo `brand-logo-mark` (192×192), `contact.verified=false`, directions host `share.google`. The video has no asset (`videoAssetId` null).
- **No discrepancies found.**

**Real homepage** (local `next build` + `next start` with `CLIENT_REVIEW_LOCAL=true`):

| Check | Result |
|---|---|
| Content | Hero (`identity.name` + tagline) over banner 1 at focal point 55% 50%; about (`ศรัทธาที่อยู่คู่ใจ` + statue image); sacred items 3 of 5 with category `สถานที่ศักดิ์สิทธิ์`; worship steps 4 of 4; news 3 of 3; gallery 5 of 10; home FAQs 3 of 6; footer identity and contacts |
| Labels | Sample label on หลวงปู่ศิลา (คำอธิบายย่อ), on the news item with placeholder title/date, on the worship steps section, and on opening hours (quick info and visit). Pending label on องค์ปู่ดำ (รายละเอียด, ของไหว้) and on the about section (เนื้อหาประวัติ). Ten "imported, unverified" contact labels (location, contact ×2, address, phone, LINE, 3 social) |
| Not rendered (correct) | No `tel:` or LINE links, no `share.google`, no iframe or video, no testimonials, no team members, no non-home FAQs. The map area shows the invalid-link note |
| Images | 14 per page, 0 broken, 0 incomplete after scrolling; served through `/_next/image` from Cloudinary; the logo renders at 40 px. Content-to-image mapping matches the records |
| Headers (HTML and RSC) | `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store, max-age=0` |
| Leak check | Real content appears only in request-time HTML/RSC. Prerendered output and browser bundles contain none of the content markers, staging paths, or Cloudinary hosts |

**Visual QA** (headless Chrome via CDP device emulation, full page and per section):

| Width | Result |
|---|---|
| 390 | No horizontal overflow; Thai text wraps inside cards; labels stay within cards; footer contacts wrap; keyboard focus visible (3 px outline) |
| 768 | No overflow; gallery mosaic leaves an empty column and cell |
| 1440 | No overflow. Gallery mosaic leaves an empty cell in row 2, and the "wide" tile stays square because only the feature tile overrides `aspect-ratio`. The featured news card stretches to the height of the two supporting cards, leaving white space below its text (existing layout) |

Fixes: none. The observed layout points come from the approved mosaic and news layout and also apply to the public prototype, so they are recorded for design review rather than changed here.

Builds: the local review build is Partial Prerender; the public build (`CLIENT_REVIEW_LOCAL` empty) and the simulated Vercel production build are fully static with no review headers or image hosts (round 2, no code change since). Lint passes; 77 of 77 tests pass.

## 11. Owner-confirmed review overrides

`src/server/review/overrides.js` holds values the owner has confirmed. They take precedence over the migrated staging record in Client Review Mode only:

- The staging record is never modified.
- The public `siteConfig` and the public homepage do not read this file.
- It is server-only.

| Field | Value | Confirmed | Replaces |
|---|---|---|---|
| `directionsUrl` | `https://maps.app.goo.gl/xTiyZjWJcKTH3sHR7` | 2026-11-01 | the imported `share.google` link |

How the directions link works:

- **Validation:** HTTPS, hostname exactly `maps.app.goo.gl` (no suffix matching, no other Google hosts), no credentials or port, and a non-empty path. An override that fails validation is ignored; the imported value is never used in its place.
- **Where it appears:**
  - the "นำทางด้วย Google Maps" button in Visit;
  - the "นำทาง" action in the header and mobile menu;
  - the footer contact section;
  - the "นำทางไปศาล" quick action.
- **How it opens:** every placement uses `getContactActions`, so links open in a new tab with `rel="noopener noreferrer"`.
- **No embed:** there is no iframe and no embed URL. The map area keeps its placeholder and points to the button.
- **Scope:** only the directions link is confirmed. Address, phone, LINE, and social links stay labeled "imported, unverified" and are not clickable.
- **Imported links:** a valid imported link (none exists today) would show only in Visit, labeled unverified, and never in the header, footer, or quick actions.
- **Verified on 2026-11-01:** the short link redirects (302) to `www.google.com/maps/place/…`. In a local review build all 5 anchors carry the exact URL with the external-link attributes, and there is no layout overflow at 390, 768, or 1440 px. The public build contains no copy of the link.

## 12. Content pages: /history, /sakkara, /sakkara/[slug] (C2.1, 2026-11-01)

### Routes and data

| Route | Source | Loader |
|---|---|---|
| `/history` | `pages` (`key=history`): `title`, `intro`, `historyImage`, `historyBody`, `quote`, `coatOfArms` (heading, body, image, parts), `wishTopics`, `worshipSteps` | `getHistoryPage()` |
| `/sakkara` | `sacred_items` (sorted `sortOrder`, `_id`) + `categories` | `getSacredItemsPage()` |
| `/sakkara/[slug]` | one `sacred_items` record by `slug` + its category: name, category, `primaryImage`, `excerpt`, `body`, `prayerTopics`, `offerings`, variant names | `getSacredItemPage(slug)` |

- **Code:** `src/server/site/` (entry `index.js`, scope selection `service.js`, view data `pages.js`) and `src/components/pages/`. Route files import only `@/server/site` (boundary test).
- **Scope:** chosen by the environment-based review policy only:
  - review on: the dedicated read-only review repositories (§3); if they cannot be opened, the page is "unavailable" and never falls back to public or sample data;
  - review off: the existing public repositories (published + approved + no open placeholders).
- **Slug lookup:** the slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (at most 100 characters) before any query. It is then used only as a literal string equality on `slug`; invalid values return not found without a query.
- **Page states:**
  - "ok": page content;
  - "empty": list only, honest empty state "ยังไม่มีรายการวัตถุมงคลที่เผยแพร่";
  - "not_found": `notFound()`;
  - "unavailable": "ยังโหลดเนื้อหาไม่ได้ในขณะนี้" (a database failure is not shown as 404).
- **Text:** `legacy-text-v1` is parsed on the server into paragraphs and bold segments and rendered as React text. No CMS HTML exists, and none is injected (no `dangerouslySetInnerHTML` anywhere; boundary test).
- **Not shown:** `inquiryText` (the legacy price note, "สอบถามราคาและสั่งจองทางไลน์") and variant quantities (`showVariantQuantities=false`). There is no price, stock, ordering, or contact action. The coin's body text mentions ordering via LINE as plain text, without a link.
- **Labels:** sample labels appear next to the affected block or field (history body, worship steps, item excerpt/body/offerings). List cards also show "pending details", like the homepage cards.

### Caching, metadata, indexing

- **Request-time data:** every loader awaits `connection()` inside `<Suspense>`. There is no `"use cache"` and no static params list; `/sakkara/[slug]` has no prerendered pages.
- **Build output:** a scan of the review, public, and simulated-production builds found no titles, body text, slugs, variant names, or Cloudinary URLs in `.next/server/app` or `.next/static`.
- **Metadata:** generic titles only ("ประวัติ", "วัตถุมงคล"), with no CMS content in `<head>`, Open Graph, or structured data. No sitemap, robots file, feed, or API route exists.
- **Review headers:** `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store, max-age=0` on HTML and RSC responses of every route, including the not-found UI (via `next.config.mjs`).
- **Not-found status:** `notFound()` runs after streaming starts (runtime params inside Suspense). Next.js therefore renders the not-found UI with HTTP 200 and injects `noindex`. Unmatched routes such as `/does-not-exist` return a real 404. See §13 for why a pre-stream 404 is not available in this architecture.

### Navigation

- **Review homepage:**
  - featured cards link to `/sakkara/<slug>`;
  - "ดูวัตถุมงคลทั้งหมด" goes to `/sakkara`;
  - the "ประวัติศาล" and "วัตถุมงคล" quick actions go to `/history` and `/sakkara`;
  - "อ่านประวัติเพิ่มเติม" goes to `/history`.
- **Public homepage:** "ดูวัตถุมงคลทั้งหมด" goes to `/sakkara` (which lists published items only); its placeholder cards stay unlinked.
- **Elsewhere:** the header, mobile menu, and footer already linked `/history` and `/sakkara`. Every content page has a breadcrumb, and each detail page links back to the collection.

### Verification (local, live staging, read-only account only)

**Review build** (`CLIENT_REVIEW_LOCAL=true`):

| Check | Result |
|---|---|
| `/history` | Real title, 3 body paragraphs including the bold sample notice, quote, coat of arms with 8 parts, 4 wish topics, 4 worship steps. Sample labels on the body and worship steps. 2 Cloudinary images |
| `/sakkara` | All 5 items in `sortOrder` (องค์ปู่ดำ 168, ตราแผ่นดินสยาม, รูปเหมือนหลวงปู่ศิลา สิริจันโท, เหรียญปู่ดำ 168 รุ่น เจริญลาภ เจริญยศ, ซุ้มประตูศาลปู่ดำ ตราแผ่นดิน). Categories: สถานที่ศักดิ์สิทธิ์ ×3, สายมู ×1, จุดเช็กอิน ×1. Every card links to its slug |
| Detail pages | `pu-dam-168`, `tra-phaendin-siam`, `luang-pu-sila`, `coin-charoenlap-charoenyot`, and `shrine-gate` each resolve with the matching title, category, and image (statue, coat of arms, interior altar, coin poster, front entrance) |
| Unknown slugs | `not-a-real-item`, `PU-DAM-168`, and `%24ne` render "ไม่พบรายการนี้" |
| Homepage | Card, catalog, and history links work; all 5 Maps links are intact |

**Public build** (review off; public path pointed at the same read-only account by a scratch preload, never the admin URI):

| Check | Result |
|---|---|
| `/sakkara` | Empty state |
| `/history` | Site not-found |
| All 5 detail slugs | "ไม่พบรายการนี้" |
| Draft content | No draft title, slug, or image in any HTML or RSC payload |
| No database configured | All three routes show the unavailable state |

**Simulated Vercel production** (all review flags set): `/` static; no review headers or image hosts.

**Automated:** lint passes; 92 of 92 tests pass. They cover slug validation and literal lookup, operator and invalid slugs (no query runs), review ordering, categories, labels, missing media and excerpts, public isolation (drafts and placeholder records hidden), unavailable vs. not found, no public fallback when review is down, `legacy-text-v1` parsing (markup stays literal), DTO safety, and boundaries (route imports, no static params, metadata, cache, or HTML injection).

**Visual QA:** headless Chrome via CDP at 390, 768, and 1440 px on `/history`, `/sakkara`, and three detail pages. No horizontal overflow, no broken images, visible focus on breadcrumb links, Thai text wraps inside cards and prose.

Two fixes came from that QA:

- Page titles now wrap at phrase boundaries (`ThaiPhrases`; previously "เจริญ/ลาภ" split at 390 px).
- Review badges fit their text instead of stretching across grid and flex columns. This also affects the homepage cards.

### Content gaps (owner)

- `historyBody` and `worshipSteps` are placeholders: the real history (origin of the name "ปู่ดำ 168", the founding year, the stories) and confirmed worship steps.
- Item details: placeholder bodies for องค์ปู่ดำ, หลวงปู่ศิลา, and the shrine gate; offerings for องค์ปู่ดำ; the excerpt and prayer topics for หลวงปู่ศิลา; the coin's `inquiryText`.
- Each item has one image only; there is no item gallery field. หลวงปู่ศิลา uses the shared interior-altar photo.

### Remaining

- **C2.2:** done (§13).
- **Preview:** the C2 routes on Vercel Preview, Atlas Network Access for Vercel, and Deployment Protection are **NOT VERIFIED** (the owner verified only the homepage on Preview).
- **Production:** public mode needs a read-only production database user before any public page reads MongoDB in production.

## 13. News and visit pages: /news, /news/[slug], /visit (C2.2, 2026-11-01)

### Routes and data

| Route | Source | Loader |
|---|---|---|
| `/news` | `news`, sorted `date` descending then `_id` (the documented news order; `date` is the article's own `YYYY-MM-DD` field, never a migration or `createdAt` timestamp) | `getNewsPage()` |
| `/news/[slug]` | one `news` record by `slug`: `title`, `date`, `coverImage`, `excerpt`, `body` (`legacy-text-v1`), `images[]` | `getNewsArticlePage(slug)` |
| `/visit` | `site_settings`: `openingHours`, `contact.address`, `contact.locationShort`, `contact.phoneNumber`, `contact.lineId`, `socialLinks`; directions from the review override (§11) in review mode only | `getVisitPage()` |

- **Conventions from §12:** the same scope selection, slug validation, literal lookup, page states, request-time loading, generic metadata, and safe text rendering apply. The news list reuses the approved `NewsCard`.
- **Article images:** shown uncropped (each frame takes the image's own aspect ratio), because they include portrait newsletters and an infographic. There is no author, no captions (none stored), and no invented dates.
- **`/visit` scopes:**
  - **Review mode:**
    - hours, address, and landmark are shown with labels (hours carry the sample label for `openingHours.daysText`);
    - phone, LINE, and social links appear as text labeled "imported, unverified", never as links;
    - the only action is "นำทางด้วย Google Maps", built from the owner-confirmed override with `target="_blank" rel="noopener noreferrer"`.
  - **Public mode:**
    - only the published, approved, placeholder-free record is used, and the review override is never read;
    - phone, LINE, and directions become actions only when `contact.verified` is true, and only verified social links appear;
    - if no eligible record exists, the page shows "ข้อมูลการเยี่ยมชมยังไม่เผยแพร่" (not a 404).
- **Not used on `/visit`:**
  - `mapEmbedQuery`: no embed; using it would invent a destination;
  - `contactTopics`: a placeholder, and there is no contact form;
  - transport routes, parking, and coordinates: none exist in the source.
- **Navigation:**
  - review homepage news cards link to `/news/<slug>`;
  - "ดูข่าวสารทั้งหมด" goes to `/news`;
  - the header, mobile menu, footer, and worship-guide button already linked `/news` and `/visit`;
  - the five homepage/header/footer directions links are unchanged.

### HTTP status of not-found pages

The pre-stream 404 was attempted and is **not feasible** in this architecture:

- **What was tried:** `/news/[slug]` was changed to look up the article before any Suspense boundary, with `instant = false` to pass static-shell validation.
- **Why it fails:** with Cache Components, a dynamic route without `generateStaticParams` gets a prerendered App Shell (`renderingMode: PARTIALLY_STATIC`, response header `x-nextjs-postponed: 1`). Next.js sends that shell before the page code runs, so the status is already 200 when `notFound()` fires.
- **Decision:** the attempt was reverted to the §12 pattern.

| Request | Status | Rendered UI |
|---|---|---|
| Unknown or ineligible `/news/[slug]` or `/sakkara/[slug]` | **200** | Not-found UI ("ไม่พบข่าวนี้" / "ไม่พบรายการนี้") with `<meta name="robots" content="noindex">`, plus `X-Robots-Tag` in review mode |
| `/history` with no eligible page | **200** | Site not-found UI |
| An unmatched path | **404** | Site not-found UI |

**Production-readiness issue (soft 404):** a real 404 for unknown slugs needs either:

- `generateStaticParams` with `dynamicParams = false`, built from **public, published** slugs only (never in review builds); or
- a `proxy.js` existence check.

Both are design decisions for the owner and were not implemented.

### Verification (local, live staging, read-only account only)

**Review build:**

| Check | Result |
|---|---|
| `/news` | All 3 articles in order with dates 20 / 16 / 16 มีนาคม 2569. Slugs: `know-tra-phaendin-siam`, `tra-phaendin-ceremony-2569`, `monks-blessing-ceremony`. The placeholder article's card shows the sample label (หัวข้อ, วันที่) |
| `know-tra-phaendin-siam` | Matching title and date; cover is the infographic; 1 article image (coat of arms); bold segments preserved |
| `tra-phaendin-ceremony-2569` | Cover is newsletter A; images are newsletter B and the officer photo; bold names preserved |
| `monks-blessing-ceremony` | Cover is the monks/holy-water photo; 2 article images; sample labels on title, date, and body |
| Unknown slugs | `not-a-real-article`, `KNOW-TRA-PHAENDIN-SIAM`, and `%24ne` render "ไม่พบข่าวนี้" |
| `/visit` | Real hours with the sample label, full address, landmark; phone, LINE, and 3 social links as labeled text. 4 Maps anchors on the page (header ×2, footer, visit action), all exact and opening in a new tab. No `tel:`, LINE link, `share.google`, iframe, embed query, or contact topics |
| Regression | The homepage links all 3 news cards, `/news`, `/visit`, and the sakkara cards; all 5 homepage Maps links remain; the C2.1 pages unchanged |

**Public build** (review off; public path pointed at the read-only account, never the admin URI):

| Check | Result |
|---|---|
| `/news` | Empty state "ยังไม่มีข่าวสารที่เผยแพร่" |
| All 3 article slugs | "ไม่พบข่าวนี้" |
| `/visit` | Empty state |
| Draft content | No draft title, contact value, opening hours, Maps override, `share.google`, or Cloudinary URL in any HTML or RSC payload (the requested slug itself appears only as the echoed URL, same as for a made-up slug) |
| No database configured | All three routes show "ยังโหลดเนื้อหาไม่ได้ในขณะนี้" |

**Simulated Vercel production** (`VERCEL_ENV=production` with review flags set): `/` static; no review headers; no remote image patterns.

**Headers:** in review mode, every HTML and RSC response of the new routes has `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store, max-age=0`. In public mode, the dynamic routes send Next.js's `private, no-cache, no-store, max-age=0, must-revalidate`.

**Build output:** in the review, public, and simulated-production builds, `.next/server/app` and `.next/static` contain no article titles, slugs, contact values, address, Maps override URL, or Cloudinary URLs.

**Automated:** lint passes; 99 of 99 tests pass. The tests cover:

- news ordering and `date` (no migration timestamps);
- slug validation and literal lookup;
- labels, uncropped images, and unresolvable images dropped;
- public isolation for news and visit;
- the review-only override never reaching public pages, with verified-only public channels;
- unavailable vs. not found vs. empty;
- DTO safety and boundaries.

**Visual QA:** headless Chrome via CDP at 390, 768, and 1440 px on `/news`, two articles, and `/visit`. No horizontal overflow, no broken images, visible focus, Thai titles wrap at phrases.

One fix came from that QA: on linked news cards the review label shared a line with "อ่านข่าวสาร". It is now on its own line, which also applies to the homepage news cards.

### Content gaps (owner)

- `monks-blessing-ceremony`: the title, date, and body are placeholders (event name, date, and the names of the monks).
- `openingHours.daysText` (opening days) is a placeholder. All contact values (address, phone, LINE, social links) are unverified; only the directions link is confirmed.
- `tra-phaendin-ceremony-2569` uses two near-identical newsletter images (A as cover, B in the article). That is the real data; the owner may want to choose one.

### Remaining

- **Visual refinement:** gallery gaps, the featured news card's empty space, and cropped poster thumbnails are addressed in §14 (Step G).
- **Soft 404:** a design decision, see above.
- **Preview and production:**
  - verify the C2 routes on Vercel Preview, Atlas Network Access for Vercel, and Deployment Protection (all **NOT VERIFIED**);
  - create a read-only production database user for public mode.

## 14. Homepage visual refinement (Phase 02.4 Step G, 2026-11-01)

Started from `79ea6ee`, which the owner had pushed and reviewed on Vercel Preview. The goal was to fix four issues visible in the owner's screenshots: the gallery's unused space, the stretched featured news card, the lone fourth worship step, and the tall footer. Branding, colours, typography, section order, content, labels, and access boundaries are unchanged.

### Changes

| Area | Before | After |
|---|---|---|
| Gallery | 12-column mosaic with a "wide" last tile: empty cells at 768 and 1440 px | **Desktop:** 4 columns; image 1 spans 2 columns × 2 rows on the left, images 2–5 fill a 2×2 on the right by normal grid flow (DOM order = reading order, no visual reordering). The small tiles are square, so the feature tile covers exactly 2×2 cells plus the gap: no empty cells. **Tablet and mobile:** 2 columns, image 1 across both (3:2), the other four as squares in two rows. The ≤375 px single-column override was removed. Sizes are reserved by `aspect-ratio`, so there is no layout shift |
| Homepage news | One featured card stretched beside two stacked cards | One flat list in reading order. **Desktop:** 3 equal columns, `align-items: start`, so each card keeps its natural height. **Tablet:** one card per row with the image beside the text. **Mobile:** stacked. Titles, dates, excerpts, sample labels, and article links unchanged. `/news` keeps its own grid; article pages are unchanged |
| Worship guide | Fixed 3 columns at desktop; step 4 alone on row 2 | Columns follow the step count: `min(steps, 4)` on desktop, `min(steps, 2)` on tablet, 1 on mobile (CSS variables set by the component). 4 steps → 4 columns. `/history` uses the same component and shows the same result |
| Footer (review mode) | Address, phone, LINE, and 3 raw social URLs, each with its own note (~765 px tall at 1440, ~1236 px at 390) | The confirmed "นำทางด้วย Google Maps" action (unchanged URL and `target="_blank" rel="noopener noreferrer"`), then a summary: ที่ตั้ง (the record's own `locationShort` field, not a cut address), โทรศัพท์ / LINE (both values in full), โซเชียลมีเดีย (platform names, no URLs). One shared note "นำเข้าจากระบบเดิม · ยังไม่ยืนยัน" covers the group, followed by a link to `/visit`, which keeps every value in full. Nothing is clickable except the Maps action and the `/visit` link. About 430 px at 1440 and 920 px at 390. The public footer is unchanged |

### Image-fit decisions

- **Why hints:** the CMS has no fit field, and media categories cannot separate a cutout from a photograph (the statue and the coat-of-arms photo are both `shrine-sacred-object`).
- **How the cutout was identified:** the source files were checked first.
  - None of them has an alpha channel (all lossy WebP), so there is no true transparency.
  - The border pixels were then measured. Only `pu-dam-168-statue` has a uniform near-white border (standard deviation 2.4); every other image is ≥25.
- **Where the hints live:** `src/server/cms/media-presentation.js` keys each hint by Cloudinary public id without the `sanpudam168/<env>/legacy/` prefix. No CMS record or asset was changed.
- **The hints:**
  - `contain` on a white matte: the statue cutout (the whole figure stays visible);
  - `contain` on a neutral matte (warm ivory with a faint border): the newsletters A and B, the infographic, and the coin poster;
  - everything else: `cover` (scene photography, existing focal points).
- **Where they apply:** only the gallery and news cards opt in (`MediaFrame` `fit`/`matte` props). Other cards, the hero, and the article page's full uncropped images are unchanged.

### QA (local review build, live staging, read-only account)

- **Screenshots:** before and after section screenshots at 390, 768, and 1440 px (headless Chrome via CDP) were kept in the session scratchpad, not in git.

| Check | Result |
|---|---|
| Gallery | 5 images, 1 feature tile, a complete composition at all widths. Statue contained on white; scene photos cropped sensibly |
| News | 3 equal cards with natural heights; newsletters and infographic shown whole on the neutral matte; sample label and links present |
| Worship | 4 columns at 1440, 2 at 768, 1 at 390; sample label present |
| Footer | Compact; shared unverified note; `/visit` link; no raw URLs; no `tel:` or LINE links |
| Homepage overall | No horizontal overflow, 14 images, 0 broken or incomplete, visible keyboard focus. 5 Maps links all exact with safe attributes. Review headers unchanged |
| `/news` | Same cards, posters now whole |
| `/history` | Worship guide in 4 columns |
| Public prototype homepage (review off, no database) | Gallery placeholders form the same complete composition; no overflow |

**Automated:** lint passes; 100 of 100 tests pass. They now cover the footer summary (no raw URLs, full values, shared note) and the presentation-hint lookup (environment-independent, cover by default). No CSS-duplicating tests were added.

### Remaining before client presentation

- **Owner content:** the content gaps in §12 and §13.
- **Gallery source:** the owner may want a different first gallery image. The order follows `sortOrder`, and image 1 is the interior altar.
- **Release blockers:**
  - the soft 404 (§13);
  - the C2 routes on Vercel Preview, Atlas Network Access for Vercel, and Deployment Protection (all **NOT VERIFIED**);
  - a read-only production database user.

Step H and production readiness are **not** complete.
