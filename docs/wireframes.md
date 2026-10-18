# Sanpudam 168 — wireframes and page templates

**Phase:** 02.1 — UI/UX design specification

**Status:** Structural wireframes; not final visual comps, production copy, or implemented routes.

The layout follows the approved **Contemporary Heritage** direction: calm editorial spacing, warm light content areas, a restrained cinematic hero, dark readable typography, and sparing antique-gold accents. The wireframes describe hierarchy and responsive behavior, not a final logo, photography, colors, or factual copy. See `design-system.md` for proposed tokens and `information-architecture.md` for route and CMS rules.

## 1. Homepage — desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ BRAND        ประวัติ   วัตถุมงคล   ข่าวสาร   เยี่ยมชม [สอบถาม LINE if valid]│
├──────────────────────────────────────────────────────────────────────────────┤
│                         HERO BANNER (cinematic, dark)                        │
│         [approved shrine image with readable dark overlay]                   │
│         [desktop/mobile asset + focal point handled responsively]             │
│         [eyebrow / approved context]                                         │
│         [H1: owner-approved shrine/site name]                                │
│         [short introduction — copy TBD]                                      │
│         [ดูวัตถุมงคล]  [รู้จักประวัติ]                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ QUICK INFORMATION: verified visit / location / contact highlights            │
├──────────────────────────────────┬───────────────────────────────────────────┤
│ ABOUT SANPUDAM                   │ approved editorial image                  │
│ H2 + concise intro               │ caption / source where required            │
│ [อ่านประวัติเพิ่มเติม]           │                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ FEATURED SACRED ITEMS                         [ดูรายการทั้งหมด]              │
│       [item card]          [item card]          [item card]                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORSHIP GUIDE                                                                  │
│ short respectful introduction + [approved step] [step] [step] [step]         │
│ [อ่านคำแนะนำก่อนมา]                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ LATEST NEWS                                          [ดูข่าวสารทั้งหมด]       │
│ [featured story with image]        [story card]        [story card]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHOTO GALLERY                                                                  │
│ [large approved image]   [image]   [image]                                    │
│ [image]                  [image]   [ดูภาพในหน้านี้]                           │
├──────────────────────────────────┬───────────────────────────────────────────┤
│ VISIT US                         │ verified map/directions preview            │
│ address / hours / channels TBD   │ no map embed until approved                │
│ [ข้อมูลการเดินทาง] [สอบถาม LINE] │                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ FAQ: concise question / answer rows                        [ดูเพิ่ม → /visit#faq]│
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER: brand / main links / verified contact / legal links if approved       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Desktop behavior

- Use a full-width hero image with a constrained text column and strong contrast overlay; keep text separate in semantic markup, not baked into the image.
- Future banner content should support a desktop image and optional mobile-specific image, a focal point for each asset, and responsive crop/selection behavior. Banner Management is not implemented in Phase 02.2.
- Quick Information can use three or four concise highlights only when each value is verified.
- Use asymmetric image/text layouts for editorial sections, balanced item cards, and a curated gallery mosaic. Do not let the catalog visually dominate the shrine/history content.
- Keep section widths and headings aligned to a shared content grid; allow dark hero and footer surfaces without turning every section into a dark panel.
- Keep primary and secondary actions visually distinct; one primary action per section is preferred.

## 2. Homepage — mobile wireframe

```text
┌───────────────────────────────┐
│ BRAND                 [MENU]  │
├───────────────────────────────┤
│ [hero image / dark overlay]   │
│ eyebrow                       │
│ H1 (Thai, 2–4 lines max)      │
│ short intro                   │
│ [ดูวัตถุมงคล]                 │
│ [รู้จักประวัติ]               │
├───────────────────────────────┤
│ QUICK INFORMATION             │
│ verified item                 │
│ verified item                 │
│ [ดูข้อมูลการเดินทาง]          │
├───────────────────────────────┤
│ ABOUT SANPUDAM                │
│ image                         │
│ H2 + short copy               │
│ [อ่านประวัติเพิ่มเติม]        │
├───────────────────────────────┤
│ FEATURED SACRED ITEMS         │
│ [item card, full width]       │
│ [item card, full width]       │
│ [ดูรายการทั้งหมด]             │
├───────────────────────────────┤
│ WORSHIP GUIDE                 │
│ H2 + short intro              │
│ 01  approved step             │
│ 02  approved step             │
│ 03  approved step             │
│ 04  approved step             │
├───────────────────────────────┤
│ LATEST NEWS                   │
│ [story card]                  │
│ [story card]                  │
│ [ดูข่าวสารทั้งหมด]            │
├───────────────────────────────┤
│ PHOTO GALLERY                 │
│ [image]           [image]     │
│ [image]           [image]     │
├───────────────────────────────┤
│ VISIT US                      │
│ verified details, stacked    │
│ [directions] [LINE if valid]  │
├───────────────────────────────┤
│ FAQ                           │
│ [question row]                │
│ [question row]                │
│ [ดูคำถามทั้งหมด → /visit#faq] │
├───────────────────────────────┤
│ FOOTER                        │
│ brand / links / contact       │
└───────────────────────────────┘
```

### Mobile behavior

- Keep the header compact. The menu trigger must have an accessible name, visible focus, and a touch area of at least 44×44px; expose expanded state and allow keyboard dismissal.
- Stack the hero title, introduction, and calls to action. Maintain readable contrast if the image is behind text; if contrast cannot be assured, place the copy on a solid panel below the image.
- Stack quick-information details; do not create a horizontally scrolling strip for essential visit data.
- Prefer single-column item and news cards at 320–375px. Add a two-column gallery grid only when images remain comfortably tappable.
- Avoid horizontal overflow, hover-only controls, autoplay, sticky overlays that cover reading, or carousels that hide content from keyboard/screen-reader users.
- Make image crops responsive and retain the subject's focal point. Use responsive source sizes and fixed aspect ratios to reduce layout shift.
- Select a mobile banner asset at the appropriate viewport when one is supplied; otherwise use the approved desktop asset with a tested mobile crop.

## 3. Homepage section specification

| Section | Purpose and content hierarchy | Desktop / tablet / mobile layout | Primary CTA | Future CMS source |
|---|---|---|---|---|
| Header + Hero Banner | Establish identity, context, and the next two useful paths. Use approved name, short intro, atmospheric image, and two concise CTAs. | Desktop: full-width dark hero with constrained copy. Tablet: retain two actions, reduce overlay content. Mobile: stack image/copy/actions; accessible menu. | Browse items `/sakkara`; learn history `/history` | Site Settings + Banner |
| Quick Information | Surface only the facts people need before a visit: verified location, hours, and contact availability. | Desktop: compact horizontal facts. Tablet: two columns. Mobile: stacked labeled facts. | Visit details `/visit` | Site Settings |
| About Sanpudam | Explain the site's identity and introduce its history/cultural significance. | Desktop: two-column editorial image/text. Tablet: balanced columns or stack. Mobile: image then short copy. | Read history `/history` | Page Content |
| Featured Sacred Items | Make catalog discovery visible without turning the homepage into a shop. Show approved images, titles, category, short factual summary. | Desktop: 3 cards. Tablet: 2 columns. Mobile: one card per row at small widths. | View catalog `/sakkara`; card to item detail | Published featured Sacred Items |
| Worship Guide | Provide respectful, practical preparation or guidance, only when approved. | Desktop: concise intro plus numbered steps. Tablet: 2×2 steps. Mobile: vertical numbered list. | Read visit guidance `/visit` | Page Content |
| Latest News | Show recent approved updates with clear publication dates. | Desktop: one featured story + two compact cards. Tablet: 2-column grid. Mobile: stacked cards. | Browse `/news`; each card to article | Published News |
| Photo Gallery | Communicate atmosphere and place through approved photography. | Desktop: curated mosaic. Tablet: 2–3 column grid. Mobile: 2 columns only if tap targets remain adequate; otherwise stack. | Browse gallery items in this homepage section; a dedicated route is not in the sitemap | Published Gallery |
| Visit Us | Help visitors plan a visit with verified details and optional directions. | Desktop: editorial details beside map/directions preview. Tablet: equal columns or stack. Mobile: all details stacked before directions. | Visit details `/visit`; external contact only if verified | Site Settings + Page Content |
| FAQ | Answer owner-approved common questions; do not make promises or spiritual guarantees. | Desktop: 2-column question list or restrained accordion. Tablet/mobile: single column; disclose each answer accessibly. | `/visit#faq` | Published FAQ |
| Footer | Provide a stable endpoint for navigation and verified public contact. | Desktop: 3–4 columns. Tablet: 2 columns. Mobile: stacked groups with clear spacing. | Route links and verified contact channels | Site Settings |

The visual weight of the **About**, **Featured Sacred Items**, **Worship Guide**, and **Visit Us** sections should remain balanced across breakpoints; the hero should not crowd out practical information.

## 4. Public page-template outlines

These layouts supplement the route definitions in `information-architecture.md`.

### `/history`

- **Desktop:** breadcrumb and title; readable narrative column; occasional full-width or side-by-side approved images; optional verified timeline; related visit/guidance callout.
- **Mobile:** single reading column; images between related text blocks; timeline becomes a vertical sequence; no two-column prose.
- **Hierarchy:** H1 and introduction → verified historical narrative → cultural significance/context → optional sourced chronology → image captions → related route.
- **CTA:** continue to `/visit`; optional link to `/sakkara` only when the editorial relationship is clear.

### `/sakkara` listing

- **Desktop:** breadcrumb/title/intro; planned search and category filters when the catalog is ready; responsive item grid; pagination if needed.
- **Tablet:** compact filters above or beside a two-column grid.
- **Mobile:** title/intro first; category controls wrap or use an accessible filter panel; single-column cards at narrow widths; filter state is announced and clearable.
- **Hierarchy:** title/intro → approved categories or filters → results count if meaningful → cards → pagination/empty state.
- **CTA:** item detail `/sakkara/[slug]`; no cart/checkout/payment CTA.
- Search and Category Filter are planned controls; implement their query/data behavior in Phase 03, not Phase 02.2.

### `/sakkara/[slug]` detail

- **Desktop:** breadcrumb; image gallery beside title, summary, verified facts, and inquiry action; long-form history/production story below; related items last.
- **Tablet:** balanced columns or image above details; keep inquiry visible without sticky obstruction.
- **Mobile:** image/gallery first, title and facts in reading order, inquiry button full-width where appropriate, story and related content below.
- **CTA:** LINE inquiry/reservation only if destination and process are verified; otherwise omit or mark as pending in design/content review.

### `/news` listing and `/news/[slug]` article

- **Listing desktop:** title/intro, editorial featured story, then dated card grid. **Mobile:** featured story and remaining cards in one column.
- **Article desktop:** narrow reading column with title/date, approved cover, body, related articles. **Mobile:** same order at full readable width with generous Thai line height.
- **CTA:** browse `/news`, related published article, or a clearly relevant public route.

### `/visit`

- **Desktop:** verified address/hours/contact next to a directions/map area; guidance and FAQ follow in distinct sections.
- **Tablet/mobile:** stack critical location, schedule, and contact details before map/directions; make phone and verified LINE destinations tappable, labeled links.
- **Hierarchy:** title/intro → location and schedule → travel guidance → contact → FAQ anchored as `#faq`.
- **CTA:** directions or a verified contact channel. The Contact Form and Contact Messages Management are essential planned CMS features for a later phase, not Phase 02.2 implementation.
- The form must not launch without a published, legally reviewed Privacy Policy page, privacy notice, validation, spam protection, access controls, and data-retention policy. The policy route/content remain TBD; do not create the page in this phase.

## 5. Interaction and responsive QA notes

- Test all templates at 320, 375, 376, 767, 768, 1023, 1024, 1439, and 1440px widths.
- Confirm no clipped Thai glyphs, overlapping labels, horizontal scroll, inaccessible menus, or CTA collisions.
- Check keyboard order from skip link through header, main content, and footer; focus must remain visible.
- For accordions, if used, expose button semantics and expanded/collapsed state; preserve access to answers without pointer-only interaction.
- Treat loading, empty, unavailable, and error states as design requirements for future CMS data, while never presenting placeholder content as live facts.
- Test reduced motion, zoom/reflow, contrast, touch-target spacing, image alt text, and screen-reader landmarks.

## 6. Content and implementation boundaries

- All real-world facts, contact data, item availability, history, visitor claims, and cultural wording require owner verification; otherwise mark them **TBD** in content planning.
- The current public app has only the Phase 01 foundation. The routes and sections above are planned—not implemented.
- This phase creates documentation only: no page, component, CMS screen, API, database, Cloudinary, Auth.js, or new dependency.
- Future pages should use Next.js App Router and Server Components by default, with dynamic metadata and SEO behavior as specified in `information-architecture.md`.
