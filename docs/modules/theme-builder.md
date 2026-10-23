# Theme Builder — header & footer

Admin: **Website → Header & footer** (`/admin/theme-builder`). The site's header and footer,
composed from elements, edited beside a live preview of a real page.

## What an editor can do

- **Header**: an announcement bar (text, link, colours, per device); *stay at the top while
  scrolling*; two arrangements — **Desktop** (1024px and wider) and **Phones & tablets** — each with
  three zones (left, centre, right). Elements are added, removed, reordered, duplicated and moved
  between zones. Look: background, text colour, line under, shadow, space above/below per device,
  space between elements, dropdown colours, menu typography.
- **Footer**: 1–5 columns of elements, a bottom bar with three zones. Look: background, text colour,
  space above/below per device, space between columns, one or two columns on phones, line above,
  typography.
- **Elements**: logo (name or symbol, height, height on phones), menu (which menu, heading, side by
  side or stacked, link size, space between links, dropdowns), search, account, inquiry bag,
  language, menu button (phones), social links, text (typed, or the Site-wide tagline / bottom line),
  button, newsletter sign-up, copyright (`{year}`). Every element: **space before it** and **show on**
  desktop / tablet / mobile.

- **Site style** (third tab): fonts and sizes for headings, text and buttons across the whole site
  (applied on `PageShell`, so a section's own design still wins), and up to twelve **saved colours**
  offered in every colour picker of the page builder and the Theme Builder.
- **As the page scrolls**: stay at the top, get smaller, a shadow, and **over the top of the page** —
  see-through until the page scrolls (with its own text colour), so a photo at the top runs up behind
  it. `HeaderScroll` reports scrolling and the header's height; the look is CSS ("Theme header").
- **Drag and drop**: elements drag within a zone and between zones (and between footer columns and
  the bottom bar); ↑ ↓ and "Move to" remain for the keyboard.

Saving, publishing and undo work as in the page builder: the draft autosaves; nothing a visitor sees
changes until **Publish**; *Discard unpublished changes* and *Load previously published version* are
in the ⋯ menu.

**Until the first Publish the storefront draws its original header and footer** (`Header` /
`Footer` in `components/layout/`). The editor opens on `defaultLayoutContent()`, which reproduces
them element for element — measured spacing included — so the first change starts from what is on
the site.

## Data

Three JSON **shop** metafields, provisioned by `schema-push` (`--only=shop`):

| Key | Storefront access | Holds |
|---|---|---|
| `custom.theme_layout` | `PUBLIC_READ` | the published layout — the only copy the storefront reads |
| `custom.theme_layout_draft` | `NONE` | the working copy the editor autosaves |
| `custom.theme_layout_previous` | `NONE` | the layout the last publish replaced |

Every write is one `metafieldsSet` (all or nothing). A save names its base revision; a stale one is
a `CONFLICT` ("edited elsewhere"), as for pages.

## Code

| Where | What |
|---|---|
| `lib/theme-builder/layout.ts` | the layout: elements, zones, defaults, strict write schema, lenient read |
| `lib/admin/theme-builder.ts` | read the three copies; save, publish, discard, rollback |
| `app/api/admin/theme-builder/route.ts` | the one write endpoint (validates, audits, drops the cache twice on publish) |
| `components/layout/theme-header.tsx`, `theme-footer.tsx`, `theme-elements.tsx` | the storefront rendering |
| `app/(admin)/preview/theme/page.tsx` | the preview: the draft around a real page (`?page=`, `?version=live`) |
| `components/admin/theme-builder/` | the editor (`theme-builder.tsx`), its panels, and pure edit operations (`ops.ts`) |

Elements are declared once in `ELEMENTS`, with their settings in the page builder's field vocabulary,
so the editor draws them with the same controls and the API validates them with the same schemas.

## Checks

- `yarn check:page-builder` — the layout's schema, round trip and damage handling.
- `yarn check:theme-builder-ui` — the editor in a browser. **Draft only, never Publish**; ends with
  *Discard*.
- `npx tsx scripts/check-queries.ts`, `scripts/check-admin-operations.ts` — the queries Shopify parses.

## Liquid

Not rendered by the theme yet (Next first, by decision). The layout is plain JSON on the shop, so
`sb-header` / `sb-footer` can read `shop.metafields.custom.theme_layout.value` when they catch up.
