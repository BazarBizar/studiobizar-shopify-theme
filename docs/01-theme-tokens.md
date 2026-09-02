# Theme Tokens

Source of truth: `app/globals.css`. Tailwind v4 (`@theme` / `@theme inline`), no `tailwind.config`.

Every value below was extracted from the PDFs in `/public/figma` by parsing the PDF content
streams directly — colours from `scn`/`rg` fill operators, type sizes from the text matrices,
geometry from image placement matrices. Nothing was sampled by eye.

## Colour

Declared in `@theme` so Tailwind publishes `--color-*` on `:root` **and** generates
`bg-earth` / `text-dark-wood` / `border-black-olive` utilities.

| Token | Hex | Status | Appears in |
|---|---|---|---|
| `--color-earth` | `#EBE8E3` | measured | Primary ground; text colour on dark pages |
| `--color-dark-wood` | `#302F2D` | measured | Body copy; ground of Landing + some footers |
| `--color-black-olive` | `#41473E` | measured | Footer ground on 11 of 14 pages |
| `--color-charcoal-blue` | `#47515C` | measured | Collections Detail, Service, Our Story |
| `--color-deep-mocha` | `#521011` | measured | Full-page ground of Contact, Our Designers |
| `--color-off-black` | `#1D1D1B` | measured | Gallery, Projects Detail |
| `--color-slate` | `#6E7784` | **provisional** | Absent from all 14 designs |
| `--color-earl-grey` | `#8A8880` | **provisional** | Absent from all 14 designs |
| `--color-terracotta` | `#A65A3F` | **provisional** | Absent from all 14 designs |
| `--color-camel` | `#C4A582` | **provisional** | Absent from all 14 designs |

The four provisional values are placeholders for names given in the brief that do not occur
anywhere in the artwork. **Confirm before any component uses them.** No surface references them,
so nothing unconfirmed is currently load-bearing.

Figma's own annotation colours `#9747FF` and `#CB30E0` appear in the PDFs (the "hover animation
(similar to B2C)" notes on Collections Detail, the `01/04 VIEW GALLERY` markers on Gallery).
They are not design tokens.

## Surfaces, not dark mode

The designs are one palette with sections sitting on different grounds — this is **not** a
light/dark preference. There is deliberately no `prefers-color-scheme` block.

Wrap a section in `data-surface` and every semantic utility inside it rebinds:

```html
<footer data-surface="olive"> <!-- bg-background is now #41473E, text-foreground #EBE8E3 -->
```

Available: `light` (default), `dark`, `olive`, `mocha`, `black`.

Semantic aliases, all rebound per surface: `--color-background`, `--color-foreground`,
`--color-surface`, `--color-muted`, `--color-border`, `--color-primary`,
`--color-primary-foreground`, `--color-accent`.

**Rule:** components use semantic utilities (`bg-background`, `text-foreground`, `border-border`)
or palette utilities (`text-earth`). Never a stock Tailwind colour (`bg-white`, `text-gray-500`),
never a hex literal, never an arbitrary colour value.

## Typography

Utilities are generated from `--text-*` keys pointing at `--fs-*` variables, so the responsive
step happens at runtime via one media query — no `md:` variants needed on every heading.

| Utility | Desktop | Mobile (≤749px) | Seen as |
|---|---|---|---|
| `text-h1` | 36px / 2.25rem | 30px | "Contact", "Products", "The Bryan Sofa" |
| `text-h2` | 24px / 1.5rem | 20px | "The Idea", "Selected Projects", page ledes |
| `text-h3` | 20px / 1.25rem | 15px | "General Inquiries", project titles, service names |
| `text-h4` | 16px / 1rem | 13px | Spec labels, footer columns |
| `text-body` | 18px / 1.125rem | 15px | All running copy |
| `text-secondary` | 16px / 1rem | 13px | Product titles in grid, primary nav |
| `text-tertiary` | 14px / 0.875rem | 12px | Card sub-line, spec values |
| `text-caption` | 16px / 1rem | 13px | Image captions |
| `text-button` | 14px / 0.875rem | 12px | "enquire", "view all", "read more" |
| `text-sku` | 16px / 1rem | 13px | SKU |
| `text-display` | 64px / 4rem | 40px | Collection wordmarks (Collections All) — NEW |
| `text-display-lg` | 128px / 8rem | 64px | ARC / TEAK hero (Collections Detail) — NEW |
| `text-micro` | 9px / 0.5625rem | 9px | "EN" language switch — NEW |

Line-height is `normal` throughout, matching Figma's "Auto".

The last three are additions to the brief's table, measured in the designs.

### Typeface — UNRESOLVED

The PDFs export text as **Type 3 fonts with glyph outlines** and carry no `BaseFont`,
`FontFile` or XMP metadata, so the family is not recoverable from `/public/figma`.

`Inter` is wired as a placeholder in `app/layout.tsx` behind `--font-sb-heading` and
`--font-sb-body`. Swapping it is a one-line change in that file.

## Layout

Measured from the Shop All product grid (image placement matrices):

- Canvas **1728px**, gutter **20px** each side → content width **1688px**
- 4 columns of **415px** on a **10px** gap; card x-origins at 20 / 445 / 869 / 1294
- Card media frame **415×519** → `--sb-ratio-card: 4/5`

| Token | Value | Utility |
|---|---|---|
| `--sb-canvas` | 108rem (1728px) | `max-w-canvas` |
| `--sb-gutter` | 1.25rem (20px) | `px-gutter` |
| `--sb-grid-gap` | 0.625rem (10px) | `gap-grid-gap` |
| `--sb-space-2xl` | 7.5rem → 4rem mobile | `py-section` |
| `--sb-ratio-card` | 4 / 5 | `aspect-card` |

Custom utilities: `sb-container` (max-width + gutter), `sb-grid-4` (2-up mobile → 4-up ≥750px).

**No `px` in Tailwind classes.** Use the scale (`p-4`, `gap-6`) or rem-based arbitrary values.

## Radius and motion

Corners are **square**. Every panel, field and button in the PDFs is drawn from straight-line
paths — `--sb-radius-none: 0px` is the default. `--sb-radius-sm` and `--sb-radius-pill` exist
but are unused.

Durations 150 / 220 / 300ms with `--sb-ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`), exposed as
`ease-out-soft`. A global `prefers-reduced-motion` block neutralises animation.

## Verification

Compiled through `@tailwindcss/postcss` against a probe containing every token class. All
generate correctly and resolve through the runtime variables:

```
.bg-background { background-color: var(--sb-background) }   /* follows data-surface */
.text-h1       { font-size: var(--fs-h1) }                  /* 2.25rem → 1.875rem @749px */
.aspect-card   { aspect-ratio: var(--sb-ratio-card) }
```
