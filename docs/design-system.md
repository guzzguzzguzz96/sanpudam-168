# Sanpudam 168 — design system

**Phase:** 02.1 — UI/UX design specification; palette and typography revised and implemented in Phase 02.4

**Status:** Direction approved. The Thai Heritage Navy palette and Thai typography in sections 2–3 are implemented in `src/app/globals.css` as provisional tokens, approved by the owner in the Phase 02.4 visual review. They replace the earlier Deep Charcoal / Heritage Green / Antique Gold palette and Noto Serif Thai headings, which are no longer in use. Other component details remain proposals for validation, not a final identity.

## 1. Design direction

### Contemporary Heritage

Use a contemporary Thai cultural editorial style: calm, respectful, warm, and professionally composed. The experience should communicate trust, heritage, respect, and authenticity without looking like a generic online shop, a casino, or a heavily ornamented temple souvenir site.

The visual balance is intentionally even between:

- the shrine's history, cultural context, worship guidance, gallery, and visiting information; and
- the sacred-items catalog, item stories, production history, and inquiry/reservation by LINE.

Use generous whitespace, a clear editorial hierarchy, authentic photography, restrained heritage cues, and simple geometry. A cinematic dark hero and dark footer may frame the site; informational content should primarily use light surfaces. Avoid decorative motifs that imply religious facts, authority, or provenance unless the site owner approves them.

### Reference and content integrity

The supplied public reference was reviewed to understand the kinds of content and functions currently presented. Its visual treatment is not a design template. Operational details, cultural claims, testimonials, product availability, production counts, contact information, and dates must be independently confirmed by the owner before they appear in the redesigned site. Where approval or source material is missing, use **TBD** rather than inferred copy.

## 2. Color tokens

**Thai Heritage Navy + Gold + Soft Blue** (provisional, Phase 02.4). Values below are the implemented CSS custom properties. Re-verify any new foreground/background pairing in the rendered UI before use.

| Token (CSS variable) | Value | Intended use |
|---|---|---|
| Primary Navy (`--navy`) | `#173B70` | Primary actions on light surfaces, active navigation, icons, selected states |
| Deep Navy (`--deep-navy`) | `#102C52` | Hero and footer surfaces, headings on light surfaces, focus ring on light surfaces |
| Royal Gold (`--royal-gold`) | `#C99A42` | Hero primary-button fill, dividers and decorative accents; text only on Deep Navy |
| Royal Gold hover (`--royal-gold-hover`) | `#D6AC5C` | Hover state of the gold button |
| Deep Gold (`--deep-gold`) | `#8A6420` | Gold-toned text (eyebrows, labels) on light surfaces |
| Warm Ivory (`--warm-ivory`) | `#FAF8F3` | Primary page background; light text and focus ring on dark surfaces |
| Soft Blue (`--soft-blue`) | `#EDF4FB` | Prototype notice, hover and active backgrounds, icon circles |
| White (`--white`) | `#FFFFFF` | Header, cards, panels, and content surfaces |
| Dark Text (`--dark-text`) | `#253247` | Main body copy on light backgrounds |
| Muted Text (`--muted-text`) | `#5B6A7E` | Secondary copy and metadata on light backgrounds |
| Soft Border (`--soft-border`) | `#DCE3EC` | Decorative dividers and card borders (non-essential boundaries only) |

Muted Text was darkened from the proposed `#64748B`, which measured 4.48:1 on Warm Ivory and 4.29:1 on Soft Blue (below AA). Deep Gold was added because Royal Gold cannot carry text on light surfaces.

### Verified contrast pairs

| Foreground | Background | Contrast | Guidance |
|---|---|---:|---|
| Dark Text | Warm Ivory / White / Soft Blue | 12.17 / 12.92 / 11.65:1 | Essential text |
| Deep Navy | Warm Ivory | 13.15:1 | Headings and essential text |
| Primary Navy | Warm Ivory / White / Soft Blue | 10.44 / 11.08 / 9.99:1 | Text links, outline buttons, active indicators, icons |
| White | Primary Navy | 11.08:1 | Primary-button label on light surfaces |
| Warm Ivory | Deep Navy | 13.15:1 | Hero/footer text, light outline button, focus ring on dark surfaces |
| Deep Navy | Royal Gold | 5.44:1 | Hero primary-button label |
| Deep Navy | Royal Gold hover | 6.59:1 | Hover state of the hero primary button |
| Royal Gold | Deep Navy | 5.44:1 | Gold text on dark surfaces (eyebrows) |
| Muted Text | Warm Ivory / White / Soft Blue | 5.20 / 5.52 / 4.97:1 | Normal-sized secondary text |
| Deep Gold | Warm Ivory / Soft Blue | 5.04 / 4.82:1 | Normal-sized gold-toned text |
| Royal Gold | Warm Ivory / White | 2.42 / 2.57:1 | Decorative only; never text or the only state indicator |
| White | LINE green `#06C755` | 2.26:1 | Do not place white normal-sized text on LINE green |

### Application rules

- Keep long-form reading areas light; reserve Deep Navy surfaces for a small number of high-impact areas such as the hero and footer.
- On light surfaces, primary actions use Primary Navy with a white label. On Deep Navy, the primary action uses a Royal Gold fill with a Deep Navy label and the secondary action uses a Warm Ivory outline — never navy-on-navy.
- Use Royal Gold sparingly. Never use it for text on light surfaces or rely on it alone to communicate state; use Deep Gold for gold-toned text on light backgrounds.
- LINE actions appear only for an owner-verified destination and follow LINE's brand guidelines; use the LINE mark in its brand color on an accessible button rather than white text on LINE green.
- Provide separate hover, active, selected, disabled, error, and success states. State must also be conveyed through text, shape, weight, or iconography, not color alone (for example, the navigation active state uses a solid navy bar plus semibold weight).
- Target WCAG 2.2 AA text contrast: at least 4.5:1 for normal text and 3:1 for large text. Interactive controls and focus indicators must have at least 3:1 contrast against adjacent colors; verify the rendered state, including on dark hero surfaces.

## 3. Typography

### Families (implemented)

- **Headings, brand name, and editorial titles:** Noto Sans Thai (loopless), weights 600–700, fallback `"Leelawadee UI", Tahoma, sans-serif`.
- **Body, navigation, labels, and controls:** Noto Sans Thai Looped, weights 400–600, fallback `Tahoma, Arial, sans-serif`. Looped forms are easier for older Thai readers.
- Both load through `next/font/google` (self-hosted at build time) as variable fonts with Thai and Latin subsets. Confirm licensing before production launch.

### Hierarchy (implemented tokens)

| Role | Size / line height | Weight | Typical use |
|---|---:|---:|---|
| Display | 36–60px / 1.3 | 700 | Homepage hero title |
| H1 | 32–48px / 1.35 | 600 | One primary title per page |
| H2 | 28–36px / 1.4 | 600 | Major content sections |
| H3 | 20–24px / 1.5 | 600 | Cards and subsections |
| Lead | 19–21px / 1.75 | 400 | Introductory paragraphs |
| Body | 17px mobile, 18px from 768px / 1.8 | 400 | Main reading text |
| Navigation | 17px desktop, 18px mobile menu | 500–600 | Header and menu links |
| Button | 16px / 1.5 | 600 | All buttons |
| Small | 16px / 1.65 | 400–600 | Metadata, captions, and secondary labels; the minimum size for essential text |

Thai stacked vowels and tone marks need taller line boxes than Latin text, so heading line heights are deliberately looser than typical Latin values. Thai has no spaces between words: keep owner-approved names intact by wrapping only at the spaces between phrases (`ThaiPhrases` component), and test wrapping at every QA width. Avoid forced letter spacing and long uppercase English labels as decoration. Keep paragraph measure around 60–75 Latin-equivalent characters, then adjust for Thai reading comfort.

## 4. Spacing, grid, and shape

### Spacing scale

Use a 4px base rhythm: `4, 8, 12, 16, 24, 32, 48, 64, 80, 96px`. Prefer the nearest token over arbitrary spacing. Larger editorial gaps should create clear section boundaries rather than compress content.

### Layout grid

- Center page content in a maximum width of approximately **1200–1280px**.
- Desktop: 12-column grid, 24px gutters.
- Tablet: 8-column grid, 20px gutters.
- Mobile: 4-column grid, 16px gutters.
- Approximate outer padding: 20px on small mobile, 24px on mobile, 32px on tablet, and 40–48px on desktop.
- Do not force every section into the same grid pattern; allow editorial asymmetry in hero, history, and gallery sections while retaining consistent alignment.

### Shapes and surfaces

- Prefer square-to-softly-rounded editorial panels, approximately 8–16px radius.
- Use pill shapes only for compact tags or explicitly button-like controls.
- Use thin Soft Border rules and restrained shadows. Avoid ornamental frames around every image/card.
- Admin tables and forms should favor scanability and clear grouping over decorative presentation.

## 5. Responsive ranges

These are design and QA ranges. Align implementation breakpoints to them deliberately; do not assume Tailwind's defaults exactly match.

| Range | Width | Design behavior |
|---|---:|---|
| Small mobile | 320–375px | Single-column content; compact but readable spacing; no horizontal overflow |
| Mobile | 376–767px | Single-column reading flow; stack cards and actions where needed |
| Tablet | 768–1023px | Two-column editorial layouts where they remain balanced; simplify dense grids |
| Desktop | 1024–1439px | Full navigation and multi-column editorial/catalog layouts |
| Large desktop | 1440px and above | Preserve readable content width; do not stretch text or cards across the viewport |

Use mobile-first rules. Images should preserve their subject and focal point at every crop. Avoid autoplay carousels; prefer a static featured image or an accessible, user-controlled gallery.

## 6. Component guidance

### Buttons and links

- **Primary:** Primary Navy fill with a white label on light surfaces, or Royal Gold fill with a Deep Navy label on dark surfaces; clear verb; minimum 48×48px touch target.
- **Secondary:** White or transparent surface with a Soft Border and Dark Text, a navy outline, or a Warm Ivory outline on dark surfaces; use for a lower-priority action.
- **Text link:** Underlined or otherwise clearly distinguishable in body copy; include a visible keyboard focus treatment.
- **LINE inquiry:** A distinct external action, visually consistent with primary actions but clearly identified as leaving the site. Use only an owner-verified LINE destination.
- Provide hover, focus-visible, active, and disabled states. Never make the entire card an ambiguous cluster of nested links.

### Cards

- **Sacred item card:** Owner-approved image, category, item title, concise factual summary, and a clear detail action. Availability or reservation status is shown only when maintained and verified. Never include cart, checkout, price, or payment affordances in this phase.
- **News card:** Cover image, published date, title, short summary, and a single article link.
- **Gallery tile:** Image-first, meaningful alt text, optional approved caption, and a keyboard-operable way to open any larger view.
- **Informational card:** Short heading, concise content, and one clear follow-up link when relevant.
- Use consistent image ratios within a collection; provide an intentional empty/loading/error state for future data-backed components.

### Forms and admin controls

Forms are future product work, not Phase 02.1 implementation. When designed later:

- Place a persistent visible label above each input; placeholder text is not a label.
- Explain required fields and validation in text, associate help/error text programmatically, and preserve entered data after validation errors.
- Use explicit consent and data-retention language for contact submissions.
- Distinguish destructive actions and require confirmation for irreversible admin operations.
- Provide save, validation, empty, loading, success, and failure states.

## 7. Photography and motion

- Prioritize authentic, owner-approved site and item photography with accurate captions and rights/consent cleared.
- Avoid stock imagery that falsely suggests a particular ritual, item, location, or person.
- Use a cinematic hero only when a suitable image is available; maintain a readable overlay and a separate text layer in markup.
- Keep transitions short and subtle. Respect `prefers-reduced-motion`; no essential information should depend on animation.

## 8. Accessibility acceptance criteria

- Semantic landmarks, one clear H1 per page, ordered headings, descriptive link labels, and a skip link.
- Full keyboard support with a visible focus indicator, logical focus order, and no keyboard traps.
- Touch targets should be at least 48×48px; keep adjacent controls separated.
- Images conveying information receive useful alt text; decorative images use empty alt text. Do not repeat adjacent captions in alt text.
- Navigation, dialogs, gallery controls, and future accordions have accessible names and states.
- Check contrast, zoom/reflow at 200%, reduced motion, Thai text scaling, and screen-reader announcements during implementation QA.

## 9. Design-to-implementation guardrails

Phase 02.1 specified direction only. Phase 02.4 implemented the palette and typography above as shared tokens in `src/app/globals.css`; other values remain proposals. Future implementation should keep App Router pages and layouts server-rendered by default, use Client Components only for required interaction, and convert these tokens into a shared theme only after visual and contrast review.
