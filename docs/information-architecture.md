# Sanpudam 168 — information architecture

**Phase:** 02.1 — UI/UX design specification

**Status:** Proposed public sitemap and future CMS mapping. No route, CMS, database, auth, or integration is implemented by this document.

## 1. Product and content principles

- Treat the site as an official cultural and informational destination, not a full e-commerce platform.
- Give the shrine's history, cultural significance, worship guidance, photography, and visiting information the same editorial importance as sacred items and their stories.
- Keep item discovery and item inquiries clear, but do not add cart, checkout, online payment, or customer registration.
- Write in Thai first. Use owner-approved names, dates, rituals, claims, contact details, and product information only.
- The supplied current public page was reviewed for content/functionality context only. It is not a visual reference. Details shown there may change; have the owner verify them before reuse. Missing facts remain **TBD**.

## 2. Public sitemap

```text
/
├── /history
├── /sakkara
│   └── /sakkara/[slug]
├── /news
│   └── /news/[slug]
└── /visit
```

| Route | Page purpose | Main user task |
|---|---|---|
| `/` | Balanced introduction to the shrine, featured items, useful guidance, and visit information | Understand what the site offers and choose a next step |
| `/history` | Explain the shrine's history and cultural significance using verified material | Learn the background and context |
| `/sakkara` | Browse the sacred-items catalog and owner-managed categories | Discover items and find an item of interest |
| `/sakkara/[slug]` | Present one item's factual story, verified details, and inquiry path | Understand an item and ask about it or make a reservation through LINE, if enabled |
| `/news` | Browse approved announcements and articles | Find current, published information |
| `/news/[slug]` | Read one article or announcement | Understand the complete story and find related content |
| `/visit` | Combine visiting guidance, verified contact/location details, and FAQs | Plan a visit or contact the site |

The named routes are the Phase 02.1 target sitemap, not existing application routes. Do not add a public gallery route, search route, account route, or checkout route without a separate product decision.

## 3. Navigation and content hierarchy

### Global header

Recommended order:

1. Owner-approved wordmark linking to `/`.
2. Primary links: ประวัติ, วัตถุมงคล, ข่าวสาร, เยี่ยมชม.
3. A persistent inquiry action only if a verified LINE destination is configured.

At tablet/mobile sizes, use an accessible menu button with an explicit expanded/collapsed state, an operable close path, visible focus, and appropriate Escape behavior. Keep core route choices easy to reach without requiring hover.

### Breadcrumbs and page hierarchy

- Use breadcrumbs on history, listing, detail, and visit pages where they aid orientation.
- Keep one page H1, followed by short introductory context and clearly named sections.
- Use Thai route labels in navigation while retaining the specified stable route paths.
- Link items to their detail routes, articles to their article routes, and visiting CTAs to `/visit`. Use `#faq` for the FAQ region on `/visit`.

### Footer

Include verified contact channels, visit information, a LINE link if configured, links to the main public routes, and legal/privacy links when approved content exists. Do not fabricate address, hours, phone, social account, legal entity, or copyright dates.

## 4. Page-template outlines

### Homepage `/`

Follow the sequence in `wireframes.md`: header and hero; quick information; about; featured sacred items; worship guide; latest news; gallery; visit; FAQ; footer. Use a balanced mixture of shrine and item content rather than making the page a product grid. Each section must have a clear purpose and no unsupported claims.

### History `/history`

1. Breadcrumb and page title/lead.
2. Verified history narrative and cultural significance.
3. Optional timeline only when dates and events are sourced and approved.
4. Worship/context or site features using owner-approved language.
5. Approved supporting photography with captions and alt text.
6. Related worship/visit guidance and link to `/visit`.

Use a readable single-column text measure, with occasional image/text editorial spreads on wide screens. Do not invent origin stories, dates, titles, or spiritual guarantees.

### Sacred-items listing `/sakkara`

1. Breadcrumb, title, introduction, and any owner-approved category guidance.
2. Optional search and filters only when the catalog size and maintained fields justify them.
3. Responsive cards with item image, title, category, factual summary, and detail action.
4. Clear empty state and pagination/load-more behavior if the catalog becomes large.
5. LINE inquiry action only when the destination is verified and inquiry/reservation availability is current.

Category names, filter dimensions, item ordering, and availability fields are **TBD** until the owner supplies the taxonomy. Do not display pricing, inventory, or “available” labels unless there is a defined, maintained source of truth.

### Sacred-item detail `/sakkara/[slug]`

1. Breadcrumb and item title/category.
2. Main image and optional gallery with accurate image alternatives.
3. Short summary, followed by approved description and item history/production details.
4. Structured item facts only when verified (for example: material, edition, or production date).
5. Inquiry/reservation via LINE, if configured; communicate what the user should ask and avoid promising stock or fulfillment.
6. Related items, only if their association is meaningful and maintained.

No cart, checkout, payment, customer account, shipping promise, price, edition quantity, or authenticity assertion is implied by this template.

### News listing `/news` and article `/news/[slug]`

**Listing:** page title and introduction, featured story if editorially selected, date-ordered cards, and pagination if needed.

**Article:** breadcrumbs, title, publication date, optional approved author/category, cover image, readable article body, related articles, and share metadata. Clearly distinguish publication date from event date if both are used. Draft content is never public.

### Visit and contact `/visit`

1. Breadcrumb, title, and short visit introduction.
2. Verified location/address, opening schedule, contact channels, and a map/directions link if approved.
3. Practical visit guidance and etiquette, written without unsupported claims.
4. FAQ list with stable anchors, including `#faq`.
5. Contact-message form only if a future implementation has approved privacy notice, validation, spam protection, access controls, retention, and delivery/monitoring.

Every operational detail is **TBD until reverified**. The reference site contains visit/contact information; do not assume it remains current.

## 5. SEO and rendering architecture (future)

These are architecture requirements for later route implementation, not active features:

- Use Next.js App Router and React Server Components by default. Load public content on the server; add Client Components only for necessary interactive controls.
- Generate unique Thai metadata per page and per published detail item/article. Keep unpublished or invalid slugs out of public metadata and indexing.
- Set canonical URLs from an owner-confirmed production origin. Do not assume a hostname based on the preview/reference domain.
- Provide Open Graph title, description, and approved image for shareable pages.
- Generate `sitemap.xml` from published public routes and `robots.txt` that excludes admin and private/draft content.
- Use structured data only when the underlying facts are verified. Consider `BreadcrumbList` and appropriate article/organization schemas; do not assert a business type, rating, address, hours, or event data without evidence.
- Use Next image optimization with appropriate `sizes`, dimensions, format, and alt text. Store approved media in Cloudinary only after that integration is separately implemented.
- Keep page payloads and images efficient; measure Core Web Vitals on representative mobile devices.
- Admin pages must be authenticated and non-indexable. No public registration is planned.

### Future integration boundaries

These services are architectural options for later phases only; this specification does not connect or configure them.

- **MongoDB Atlas + Mongoose:** keep persistence behind server-side model and service boundaries. Do not query the database directly from presentation components; validate and authorize all write operations on the server.
- **Cloudinary:** centralize upload and delivery operations in media services. Store asset identifiers and descriptive metadata, including approved alt text and focal point, rather than embedding provider-specific behavior in page components.
- **Auth.js:** protect future CMS routes and privileged actions with server-validated sessions. Decide roles, access policy, and audit requirements before implementation. Do not build public registration or production-usable mock authentication.
- **LINE:** treat the inquiry destination and reservation procedure as verified Site Settings; omit the external action until both are confirmed.

## 6. Future CMS content model map

| CMS module | Public use | Suggested owner-managed content | Governance / notes |
|---|---|---|---|
| Banner | Homepage hero or approved campaign placements | Title, summary, image, alt text, focal point, CTA label/destination, order, publish window, status | Validate CTA destinations; allow only approved public images |
| Site Settings | Header, footer, visit, metadata, global LINE inquiry | Verified site name, contact channels, address, schedule, LINE destination, social links, default SEO values | Treat as source of truth; require explicit verification and restricted edit access |
| Page Content | History, visit, worship guidance, homepage sections | Route/section key, title, body blocks, media references, order, locale, SEO fields, publish status | Preserve review and revision history; no unreviewed cultural claims |
| Sacred Items | `/sakkara` and `/sakkara/[slug]` | Slug, title, category reference, summary, description, history/production story, images, alt text, optional verified facts, featured/order/status | No price/cart/payment fields in this phase; availability and reservation terms are optional and require an owner-maintained source |
| News | `/news` and `/news/[slug]` | Slug, title, excerpt, body, cover image, alt text, category/tags if approved, publication date, status | Only published items are public; preserve edits and publication history |
| Gallery | Homepage gallery and future approved media placements | Image/video asset, alt text/caption, collection, order, status, rights/consent note | Confirm permissions; avoid exposing private/unapproved media |
| FAQ | Homepage and `/visit#faq` | Question, answer, group, order, status | Keep factual answers linked to verified settings/content; keyboard-accessible presentation |
| Contact Messages | Future `/visit` inquiry flow and admin inbox | Submitted fields, timestamp, consent record, status, internal notes | Define data minimization, privacy notice, retention/deletion, spam handling, and least-privilege access before launch |

### Homepage-to-CMS mapping

| Homepage section | Primary source |
|---|---|
| Header + Hero Banner | Site Settings + Banner |
| Quick Information | Verified Site Settings |
| About Sanpudam | Page Content; optional link to History |
| Featured Sacred Items | Published Sacred Items marked featured |
| Worship Guide | Approved Page Content |
| Latest News | Published News |
| Photo Gallery | Published Gallery |
| Visit Us | Verified Site Settings + Page Content |
| FAQ | Published FAQ |
| Footer | Site Settings + approved public-page links |

## 7. Future Admin CMS navigation

This is an information-architecture proposal only; it does not add `/admin` routes or UI.

```text
Admin (protected; route and role policy TBD)
├── Overview
├── Page Content
├── Banners
├── Sacred Items
├── News
├── Gallery
├── FAQ
├── Contact Messages
└── Site Settings
```

Authentication is a future Auth.js integration. Roles, approval workflow, audit retention, and privileged access policy are **TBD** and must be decided before CMS implementation. Do not create public registration or mock production auth.

## 8. Open content decisions

- Confirm official shrine name, history, terminology, cultural descriptions, and approved worship guidance.
- Verify all address, opening schedule, map, phone, LINE, and social destinations before launch.
- Approve product taxonomy and decide which item facts and reservation/availability states can be maintained.
- Define content owners, editorial approval and revision workflow, privacy policy, and contact-message retention.
- Confirm canonical production domain and whether English localization is in scope.
