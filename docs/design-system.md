# Sanpudam 168 — design system

**Phase:** 02.1 — UI/UX design specification

**Status:** Direction approved; token values and component details below are proposals for validation, not a final identity or implemented UI.

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

These are preliminary proposals. Test every foreground/background pairing in the rendered UI and adjust tokens if contrast or legibility is insufficient.

| Token | Proposed value | Intended use |
|---|---|---|
| Deep Charcoal | `#1C2420` | Cinematic hero/footer surface; large headings on light surfaces only if contrast-checked |
| Heritage Green | `#34483B` | Primary actions, selected states, and restrained navigation emphasis |
| Antique Gold | `#A88448` | Small decorative accents, dividers, icon details, and highlights; not small text on ivory or white |
| Deep Gold | `#715323` | Gold-toned text or icons on light surfaces, after contrast verification |
| Warm Ivory | `#F8F5EE` | Primary warm page background |
| White | `#FFFFFF` | Cards, forms, and content surfaces |
| Dark Text | `#242824` | Main body copy and headings on light backgrounds |
| Muted Text | `#626860` | Secondary copy and supporting metadata on light backgrounds |
| Soft Border | `#E6E0D5` | Subtle dividers, card borders, and input outlines |

### Verified contrast pairs

| Foreground | Background | Contrast | Guidance |
|---|---|---:|---|
| Deep Charcoal | Warm Ivory | 14.58:1 | Suitable for essential text on this background |
| Dark Text | Warm Ivory | 13.74:1 | Suitable for essential text on this background |
| Muted Text | Warm Ivory | 5.26:1 | Suitable for normal-sized secondary text on this background |
| Deep Gold | Warm Ivory | 6.51:1 | Suitable for normal-sized text on this background |
| White | Heritage Green | 9.83:1 | Preferred high-contrast primary-action pairing |
| Antique Gold | Warm Ivory | 3.18:1 | Decorative or nonessential emphasis only; not normal-sized essential text |
| White | Antique Gold | 3.47:1 | Do not use for normal-sized button labels or other essential text |

### Application rules

- Keep long-form reading areas light; reserve dark surfaces for a small number of high-impact areas such as the hero and footer.
- Use Heritage Green for primary actions with a tested high-contrast label. Use Antique Gold sparingly and never rely on it alone to communicate state.
- Do not use Antique Gold for normal-sized essential text or as a button background with white normal-sized text. Pair it with Deep Charcoal for decorative treatments or use Deep Gold for essential text on light backgrounds.
- Provide separate hover, active, selected, disabled, error, and success states. State must also be conveyed through text, shape, or iconography, not color alone.
- Target WCAG 2.2 AA text contrast: at least 4.5:1 for normal text and 3:1 for large text. Interactive controls and focus indicators must have at least 3:1 contrast against adjacent colors; verify the rendered state, including on dark hero surfaces.

## 3. Typography

### Proposed families

- **Headings and editorial titles:** Noto Serif Thai, with a serif fallback suitable for Thai.
- **Body, navigation, labels, and controls:** Noto Sans Thai, with a sans-serif fallback suitable for Thai.
- Use self-hosted fonts or another owner-approved delivery method in implementation. Confirm font licensing and Thai glyph coverage before shipping. These fonts are recommendations, not a commitment to a provider.

### Hierarchy

| Role | Proposed size / line height | Weight | Typical use |
|---|---:|---:|---|
| Display | 48–64px / 1.12–1.2 | 500–600 | Homepage hero title; responsive down to 36–40px on small screens |
| H1 | 36–48px / 1.2–1.3 | 500–600 | One primary title per page |
| H2 | 28–36px / 1.25–1.35 | 500–600 | Major content sections |
| H3 | 20–24px / 1.35–1.45 | 500–600 | Cards and subsections |
| Lead | 18–20px / 1.6–1.75 | 400 | Introductory paragraphs |
| Body | 16px / 1.65–1.8 | 400 | Main reading text and form help |
| Small | 14px / 1.5–1.65 | 400–500 | Metadata, captions, and secondary labels |

These are starting values; test actual Thai text wrapping on all specified widths. Use natural Thai word wrapping, avoid forced letter spacing, and do not use long uppercase English labels as decoration. Keep paragraph measure around 60–75 Latin-equivalent characters, then adjust for Thai reading comfort.

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

- **Primary:** Heritage Green fill, high-contrast label, clear verb, minimum 44×44px touch target.
- **Secondary:** White or transparent surface with a Soft Border and Dark Text; use for a lower-priority action.
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
- Touch targets should generally be at least 44×44px; keep adjacent controls separated.
- Images conveying information receive useful alt text; decorative images use empty alt text. Do not repeat adjacent captions in alt text.
- Navigation, dialogs, gallery controls, and future accordions have accessible names and states.
- Check contrast, zoom/reflow at 200%, reduced motion, Thai text scaling, and screen-reader announcements during implementation QA.

## 9. Design-to-implementation guardrails

This document specifies direction only. Phase 02.1 does not change the existing application or load new fonts/dependencies. Future implementation should keep App Router pages and layouts server-rendered by default, use Client Components only for required interaction, and convert these tokens into a shared theme only after visual and contrast review.
