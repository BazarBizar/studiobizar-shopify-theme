# Theme Builder — header & footer, and pop-ups

Admin: **Website → Appearance** (`/admin/theme-builder`), on four tabs: Header,
Footer, Site style, Pop-ups. The site's header and footer, composed from elements, and the
promotions over the pages, edited beside a live preview of a real page.

## What an editor can do

- **Header**: an announcement bar — see *Promotions* below; *stay at the top while
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

## Promotions — the announcement bar and pop-ups

Data and rules in `lib/theme-builder/promo.ts`; drawn by `components/layout/announcement-bar.tsx`
and `popups.tsx`; edited in `components/admin/theme-builder/promo-panels.tsx`. Part of the layout,
so drafted, previewed, published and rolled back with the header and footer.

- **Announcement bar** (Header tab): up to 8 messages, each with its own link and dates; **one at a
  time** (seconds per message, arrows, paused under the pointer or keyboard) or **scrolling across**
  (the Scrolling text section's `sb-marquee` loop: speed, direction, separator, paused under the
  pointer); text size; *visitors can close it* — remembered in `localStorage` until the messages
  change (a fingerprint of their text and links); colours; show on per device. A bar saved before
  this (one `text`, one `link`) reads as one message.
- **Pop-ups** (Pop-ups tab): up to 10, in priority order — **at most one opens per page**, the first
  whose moment comes. Each: switched on or off, a name only the editor sees, photograph, heading,
  text, button and its style (filled, outlined, underlined), newsletter sign-up; shape (box in the
  middle — modal `<dialog>`, Escape and a click outside close it — small box in a corner, bar along
  the bottom). The editor is a section editor's: the same header (back, name; show in preview,
  switch on / off, duplicate, delete) and **Content | Style** tabs. **Content**: name, what it says,
  then headed as a section's Layout — **Layout** (shape, corner, top / middle / bottom of the
  screen, photograph above, below, left or right — its width and where the words sit beside it —
  alignment), **When it opens**, **Where it shows** (pages; devices are on Style), **Dates**.
  **Style**: the section's Style tab — the device switch, then **Background** (own colour, the
  section's gradient / photo / overlay panel, text colour, a readability warning with a fix
  button), **Spacing** (padding as four boxes, distance from the screen's edge, space between),
  **Border & shadow** (corners, photo corners, a line — width, style, colour — shadow),
  **Typography**, **Buttons**, **Images** (shape, space around), **Size** (sizes or a custom width
  per device), then the pop-up's own: **Page behind it** (box in the middle only: darkened —
  colour, how dark, read by the backdrop as `--sb-popup-backdrop` — and blurred), **Close button**
  (look, size, colour, circle colour), **Animation** (rise, fade, zoom, slide, at once; speed); and
  last **Show on devices**. *Reset style* keeps the shape. Colours rebind the
  tokens as a section's do (`frameStyle`). The `design` field (`designStyle` on the `<dialog>`,
  `sb-design.css`) holds typography, buttons, background and photo corners. The sizes that can
  differ per device live in the pop-up's own `box` (width, padding, offset, gap, radius — each
  `{ d, t, m }`, a smaller screen following the larger); `popups.tsx` writes every device's value in
  full as `--sb-pop-<name>-<d|t|m>` and `data-sb-pop` lists them, and globals.css ("Pop-ups") picks
  the device's at 1024px / 750px. A pop-up saved before (one `padding`, `radius`, `customWidth`) is
  read as desktop's box values. Opens after N seconds, after scrolling N% or when the pointer
  leaves through the top (never on touch screens); how often (once per visit — `sessionStorage`,
  every N days, only once, every page — `localStorage` `sb-popup-<id>`); which pages (every, home
  only, only / except a list; `/products/*` covers everything under it); devices; dates. Four
  ready-made starts in *Add a pop-up*.

**Everything visitor-specific is decided in the browser** — the dates, the page, the device, the
trigger, "closed" and "seen": pages are cached and the same for everyone. The bar's first render uses
the moment the server drew the page, so hydration matches, then the browser's clock (to the minute).
Pop-ups render nothing until one opens.

**Preview**: in `/preview/…` nothing opens by itself and nothing is remembered. The editor puts the
pop-up being edited in the iframe's hash (`#popup-<id>`); `Popups` opens that one at once, switched
off or not. It keeps the id, not the pop-up, so one just added opens when it reaches the preview a
moment later. After every change the editor also posts `sb-preview:popup`, so a pop-up closed in
the preview opens again as soon as it is edited; **Show in preview** in its editor does the same.
Every announcement message shows there, dated or not.

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

Not rendered by the theme yet (Next first, by decision) — nor the announcement bar's messages or the
pop-ups. The layout is plain JSON on the shop, so
`sb-header` / `sb-footer` can read `shop.metafields.custom.theme_layout.value` when they catch up.
