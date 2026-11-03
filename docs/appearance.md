# Appearance — complete reference

Admin: **Website → Appearance** (`/admin/theme-builder`). Formerly "Header & footer".

The site's header, footer, site-wide style and promotions, edited beside a live preview of a real
page. Four tabs: **Header · Footer · Site style · Pop-ups**.

> Next only for now. The Liquid theme does not read the layout yet (by decision); the data is plain
> JSON on the shop so `sb-header` / `sb-footer` can catch up later.

---

## 1. Saving and publishing

Works as in the page builder.

- The **draft autosaves**. Nothing a visitor sees changes until **Publish**.
- ⋯ menu: **Discard unpublished changes**, **Load previously published version**.
- A save names its base revision; if someone else saved in between → "edited elsewhere"
  (`CONFLICT`).
- **Until the first Publish, the storefront draws its original header and footer.** The editor opens
  on `defaultLayoutContent()`, which reproduces them element for element (measured spacing
  included), so the first change starts from what is on the site.
- Preview: `/preview/theme?page=…` (the draft around a real page), `?version=live` for the published
  one.

---

## 2. Header tab

### Arrangement

Two separate arrangements — a phone header is a different composition, not a squeezed one:

| Arrangement | Width |
|---|---|
| **Desktop** | 1024px and wider |
| **Phones & tablets** | narrower than 1024px |

Each has three zones: **left, centre, right**, up to 12 elements per zone. Elements can be added,
removed, duplicated, reordered and moved between zones — by drag and drop, or ↑ ↓ / "Move to" from
the keyboard.

### Look

| Setting | Values | Default |
|---|---|---|
| Stay at the top while scrolling | on / off | on |
| Get smaller while scrolling | on / off | off |
| Shadow while scrolling | on / off | off |
| Over the top of the page | see-through until the page scrolls, so a photo at the top runs up behind it | off |
| Text colour over the page | colour; empty = light, for a photo | — |
| Background | colour; empty = the page's own background | — |
| Text and icon colour | colour | — |
| Space above and below | px per device, 0–120 | 20 |
| Space between elements | px, 0–120 | 36 |
| Line under the header | on / off + line colour (empty = soft line in the text colour) | off |
| Shadow | none / soft / medium / strong | none |
| Dropdown menus | background, text colour | — |
| Menu typography | font, size, weight … (design value) | — |

### Announcement bar

The bar above the header (`lib/theme-builder/promo.ts`, drawn by
`components/layout/announcement-bar.tsx`).

| Setting | Values | Default |
|---|---|---|
| Show the bar | on / off | off |
| Messages | up to **8**, each: text (≤ 200 chars), link (the message itself is the link), start and end date | 1 empty |
| Mode | **One at a time** / **Scrolling across** | one at a time |
| Seconds per message | 2–30 (one at a time) | 5 |
| Speed | slow / normal / fast (scrolling) | normal |
| Direction | left / right (scrolling) | left |
| Separator | dot / dash / star / none (scrolling) | dot |
| Text size | standard / small / very small | small |
| Visitors can close it | on / off | off |
| Background, text colour | colour; empty = brand off-black / earth | — |
| Show on | desktop / tablet / mobile | all |

- One at a time: arrows, paused under the pointer or keyboard focus.
- Scrolling: the Scrolling text section's `sb-marquee` loop, paused under the pointer.
- Closed: remembered in `localStorage` until the messages change (a fingerprint of their text and
  links).
- A dated message only shows within its dates — checked in the browser, to the minute.
- A bar saved in the old format (one `text`, one `link`) reads as one message.

---

## 3. Footer tab

### Layout

- **1–5 columns** of elements.
- A **bottom bar** with three zones (left, centre, right).
- Elements drag between columns and the bottom bar.

### Look

| Setting | Values | Default |
|---|---|---|
| Background | colour; empty = each page's footer colour (olive on most) | — |
| Text colour | colour | — |
| Space above | px per device, 0–240 | 48 |
| Space below | px per device, 0–240 | 16 |
| Space between columns | px, 0–320 | 197 |
| Columns on phones | one under another / two side by side | one |
| Line above the footer | on / off + line colour | off |
| Typography | design value | — |

---

## 4. Elements

Every element also has:

- **Space before it** — px, 0–240; empty = the zone's own spacing.
- **Show on** — desktop / tablet / mobile.

| Element | Header | Footer | Settings |
|---|:-:|:-:|---|
| **Logo** | ✓ | ✓ | Show: name / symbol · Height 12–160px (20) · Height on phones 0–160px (0 = same) |
| **Menu** | ✓ | ✓ | Which menu (any menu from Website → Menus; deleted shows "(deleted)") · Heading above the links · Links: side by side / one under another · Link size: standard / small · Space between links 0–120px (36) · Show sub-links in a dropdown (on) |
| **Search** | ✓ | | — |
| **Account** | ✓ | | — |
| **Inquiry bag** | ✓ | | — (shows how many pieces) |
| **Language** | ✓ | ✓ | — |
| **Menu button** | ✓ | | — (opens the full menu on phones and tablets) |
| **Social links** | ✓ | ✓ | — (set under Site-wide) |
| **Text** | ✓ | ✓ | Text: typed here / footer tagline (Site-wide) / footer bottom line (Site-wide) · Text (≤ 300) and Link when typed · Size: standard / small / very small |
| **Button** | ✓ | ✓ | Link (required) · Style: filled / outlined / underlined text |
| **Newsletter sign-up** | | ✓ | Invitation (≤ 300; empty = the Site-wide newsletter text) |
| **Copyright** | | ✓ | Text (≤ 120), `{year}` becomes the current year — default `© {year} Studio Bizar` |

Menus on the site:

- **Dropdown** — links under a link.
- **Mega menu** — when a third level exists anywhere under it: a panel the width of the header,
  each second-level link a column.
- **Phone drawer** — every level opens in place.

---

## 5. Site style tab

What every page starts from (Elementor's "Global Fonts / Colors"). Applied on `PageShell`, so a
section's own design still wins. Empty changes nothing.

- **Fonts for the whole site** — headings, text: font, size, weight, case …
- **Buttons for the whole site** — colours, line, corners, padding.
- **Saved colours** — up to **12**, each a name and a hex. Offered in every colour picker of the page
  builder and of Appearance, beside the brand's own.

---

## 6. Pop-ups tab

Up to **10** pop-ups, in priority order. **At most one opens per page** — the first whose moment
comes. List row: name, on / off, and "Ended" / "Starts 3 Dec" when outside its dates.

**Add a pop-up** offers four starts:

| Start | Shape | Opens |
|---|---|---|
| Event or news | box in the middle, photo, words, button | — |
| Newsletter sign-up | invitation + email field | — |
| Small note in a corner | corner box, left-aligned | after 8 s |
| Bar along the bottom | one line and a button | after 3 s |

The pop-up editor looks like a section editor: header (back, name, **Show in preview**, on / off,
duplicate, delete) and **Content | Style** tabs.

### Content tab

**What it says**

| Setting | Values |
|---|---|
| Name | only the editor sees it (≤ 60) |
| Photograph | image |
| Heading | ≤ 120 |
| Text | ≤ 600 |
| Button | link — closes the pop-up and goes to the page |
| Button style | filled / outlined / underlined text |
| Add the newsletter sign-up | on / off |

**Layout**

| Setting | Values | Shown when |
|---|---|---|
| Shape | box in the middle / small box in a corner / bar along the bottom | always |
| Corner | bottom right / bottom left | corner |
| Position on the screen | top / middle / bottom | box in the middle |
| Photograph | above the text / below / on the left / on the right | box in the middle |
| Photograph's width | a third / half / two thirds | photo left or right |
| Text sits | top / middle / bottom | photo left or right |
| Text | centred / left / right | always |

**When it opens**

| Setting | Values | Default |
|---|---|---|
| Opens | after a few seconds / after scrolling down / when the visitor is about to leave | — |
| Seconds after the page opens | 0–120 | 5 |
| How far down the page | 5–100 % | 40 |
| How often | once per visit / once every few days / only once, ever / every time a page opens | — |
| Days before it shows again | 1–365 | 7 |

"About to leave" = the pointer leaves through the top; never on touch screens.

**Where it shows**

- Every page / home page only / only these pages / every page except these.
- Up to 30 paths like `/our-story`; `/products/*` covers everything under it.

**Dates** — start and end, either may be open.

### Style tab

Same structure as a section's Style tab, with the device switch at the top.

| Group | Settings |
|---|---|
| **Background** | own colour (empty = site's light background) · gradient / photo / overlay (the section panel) · text colour · readability warning with a fix button |
| **Spacing** | padding as four boxes per device (0–200) · distance from the screen's edge (0–120) · space between heading, text and buttons (0–96) |
| **Border & shadow** | corners per device (0–48) · photo corners · line around it 0–8px · line style solid / dashed / dotted / double · line colour (empty = text colour) · shadow default / none / soft / medium / strong |
| **Typography** | headings, text, buttons |
| **Buttons** | colours, line, corners, padding |
| **Images** | photograph's shape: to suit the layout / landscape / square / tall / as the photograph is · space around the photograph 0–64px |
| **Size** | small / medium / large / custom (box in the middle) · custom width per device 240–1200px (also the corner box) |
| **Page behind it** | box in the middle only: darken (on) · colour (empty = black) · how dark 0–90 % (50) · blur 0–20px |
| **Close button** | look: on a circle / plain · size: small / medium / large · colour (empty = text colour) · circle colour |
| **Animation** | rise and fade in / fade in / zoom in / slide up from below / at once · speed slow / normal / fast |
| **Show on devices** | desktop / tablet / mobile |

**Reset style** keeps the shape.

Defaults where nothing is set:

| | Box in the middle / corner | Bar |
|---|---|---|
| Padding | 32 all sides (phone: 24, top 40 without a photo above) | 16 / 48 / 16 / 32 (phone left 16) |
| Distance from edge | 16 | 0 |
| Gap | 16 | 16 |
| Width | 520 (corner: 384) | — |

Per-device values follow the larger screen when empty (mobile → tablet → desktop).

### On the site

- Box in the middle is a modal `<dialog>`: Escape and a click outside close it.
- A pop-up with nothing to show (no words, photo, button or sign-up) never opens.
- **Everything visitor-specific is decided in the browser** — dates, page, device, trigger, "closed",
  "seen" — because pages are cached and the same for everyone.
- Remembered: once per visit → `sessionStorage`; days / once / always → `localStorage`
  `sb-popup-<id>`.

### In the preview

- Nothing opens by itself and nothing is remembered.
- The pop-up being edited opens at once (iframe hash `#popup-<id>`), switched off or not.
- After every change it opens again; **Show in preview** does the same.
- Every announcement message shows, dated or not.

---

## 7. Data

Three JSON **shop** metafields:

| Key | Storefront access | Holds |
|---|---|---|
| `custom.theme_layout` | `PUBLIC_READ` | the published layout — the only copy the storefront reads |
| `custom.theme_layout_draft` | `NONE` | the working copy the editor autosaves |
| `custom.theme_layout_previous` | `NONE` | the layout the last publish replaced |

- Content: `{ header, footer, global, popups }` + `meta` (revision, saved / published at and by).
- Max 120 KB. Every write is one `metafieldsSet` (all or nothing).
- **Writes are strict** (`themeContentSchema`), **reads are lenient** (`readThemeContent`): a
  damaged value falls back to its default alone; an unknown element is dropped; the rest still
  draws.

## 8. Code

| Where | What |
|---|---|
| `lib/theme-builder/layout.ts` | elements, zones, defaults, write schema, lenient read |
| `lib/theme-builder/promo.ts` | announcement bar and pop-ups: fields, per-device box, rules |
| `lib/admin/theme-builder.ts` | read the three copies; save, publish, discard, rollback |
| `app/api/admin/theme-builder/route.ts` | the one write endpoint (validates, audits, drops the cache twice on publish) |
| `components/layout/theme-header.tsx`, `theme-footer.tsx`, `theme-elements.tsx` | storefront header, footer, elements |
| `components/layout/announcement-bar.tsx`, `popups.tsx` | storefront bar and pop-ups |
| `components/admin/theme-builder/` | the editor (`theme-builder.tsx`, `panels.tsx`, `promo-panels.tsx`, `ops.ts`) |
| `app/(admin)/preview/theme/page.tsx` | the preview |

Elements and pop-up settings use the page builder's field vocabulary, so the editor draws them with
the same controls and the API validates them with the same schemas.

## 9. Checks

- `yarn check:page-builder` — the layout's schema, round trip, damage handling, promotions and
  pop-ups.
- `yarn check:theme-builder-ui` — the editor in a browser. **Draft only, never Publish**; ends with
  *Discard*.
- `yarn check:menus` — menu addresses and tree changes.
