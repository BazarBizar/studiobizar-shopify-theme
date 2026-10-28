# Page Builder Blueprint — build an Elementor-style page builder that looks like *your* storefront

This document describes a visual page builder proven in production on a Next.js + Shopify
storefront (Studio Bizar), written so it can be rebuilt in **another project whose storefront
has a different design**. The architecture is design-agnostic; everything that *looks* like
something comes from the target project's own design system and components.

Use it two ways:

- **As a prompt** — paste [§0](#0-the-prompt-paste-this-into-your-ai-coding-agent) into an AI
  coding agent working in the target repo, with this file attached.
- **As a spec** — §1–§14 are the reference the prompt points to.

---

## 0. The prompt (paste this into your AI coding agent)

> You are adding a visual page builder to this project, following the attached blueprint
> (`page-builder-blueprint.md`). Read it fully before writing code.
>
> **The single most important rule: the builder must look like THIS storefront.** Do not copy
> any colours, fonts, spacing, or section designs from the blueprint — it describes another
> shop. Every section the builder offers must be drawn by this project's own components
> and design tokens, so a page made in the builder is indistinguishable from a hand-built one.
>
> Work in this order, and stop for my review after each phase:
>
> 1. **Phase 0 — Design inventory (no code).** Study this storefront and write
>    `docs/page-builder/design-inventory.md`: design tokens (colours/grounds, type scale,
>    spacing rhythm, container width and gutter, breakpoints, radii, shadows), the button
>    variants, card patterns, and every existing page-level block/section with the file that
>    draws it. Propose the first section library (10–15 sections) mapped to existing
>    components, and the brand presets (grounds, rhythm steps) the Style tab will offer.
> 2. **Phase 1 — Data model and rendering** (§2–§5): document schema + storage adapter,
>    field vocabulary, `defineSection`, registry, renderer with `SectionFrame`, the public
>    route, and 3 sections. A page stored by hand must render identically to the original.
> 3. **Phase 2 — Editor** (§6–§7): section list (add/reorder/duplicate/hide/delete), Content
>    and Style tabs generated from field definitions, autosave with revisions, publish/rollback.
> 4. **Phase 3 — Live preview** (§8): iframe preview redrawn from unsaved content, instant
>    style, click-to-select, in-place text editing, device widths.
> 5. **Phase 4 — Style system** (§9): the design value (typography, buttons, background,
>    spacing, borders, per-device values) applied through one CSS file.
> 6. **Phase 5 — The rest of the section library**, presets with example content, carousels
>    (§10), and the Header & footer builder if wanted (§11).
> 7. **Phase 6 — Hardening** (§12–§13): security checklist and the automated checks.
>
> Follow the UX rules in §7 exactly (no jargon, hide what does nothing, no dead ends). Prefer
> this project's existing admin UI kit; if there is none, use shadcn/ui. Match this repo's
> conventions (language, linting, folder layout, naming) over the blueprint's.

---

## 1. What it is (the feature set to reach)

- Pages are an **ordered list of sections**; each section is a type (Text, Banner, Product
  carousel…) with settings. Editors add, reorder (drag), duplicate, hide and delete sections.
- **Content / Style tabs** per section, generated from the section's field definitions.
- **Draft → Publish**, with one-step **rollback**; autosave to the draft; conflict detection
  when two tabs/people edit the same page.
- **Live preview** in an iframe beside the editor: redraws from the *unsaved* content within
  ~150 ms, applies style changes instantly, click a section in the preview to select it,
  double-click text to edit it in place, switch desktop / tablet / mobile width.
- **Add section** dialog with categories, search, wireframe thumbnails and **presets**; a new
  section arrives **filled with example content** (never empty — an empty section looks like
  nothing happened).
- **Style system** (Elementor-like): background (brand ground or own colour, gradient, photo,
  overlay + opacity), spacing (padding/margin, 4 sides, per device), border & shadow
  (line, corners per device, photo corners, shadow, transparency), typography (headings /
  text / buttons: font, size per device, weight, colour, case, alignment), buttons (colours,
  hover, line, corners, padding, gaps), images (shape, zoom), width & height, show on devices.
- **Carousels** with shared settings: items across per device (incl. "1 and a peek"), how far
  an arrow moves, show at most, show-more button.
- Optional: **Header & footer builder** (zones, drag & drop elements, scroll behaviour,
  site-wide fonts/buttons), with the same draft/publish model.
- Optional: a second renderer (e.g. Shopify Liquid theme) fed by the same definitions.

---

## 2. Architecture at a glance

```
lib/page-builder/
  fields.ts          field vocabulary (text, richText, image, link, select, number, color,
                     products, collections, blocks, design…) + zod schema per field
  define-section.ts  defineSection(): fields + universal + style fields → schemas, defaults
  sections*.ts       the section definitions (no React)
  registry.ts        SECTIONS map, categories, sectionDefinition(type)
  presets.ts         presets per type (label, description, preset settings)
  examples.ts        withExamples(): fills empty content fields on Add section
  document.ts        page document schema, parse (lenient read) / validate (strict write)
  design-style.ts    the design value (types + designStyle() → CSS vars + data-attrs), NO zod
  design.ts          zod schemas for the design value (re-exports design-style)
  carousel(-view).ts shared carousel fields + carouselView() (view half has no zod)
  inline-edit.ts     find which setting a piece of preview text belongs to
  migrations.ts      convert hand-built pages into documents
components/page-builder/   (storefront side)
  builder-page.tsx   renders a document: PageShell + SectionRenderer per section
  section-renderer.tsx / renderers*.tsx   type → { load(settings), render(settings, data) }
  section-frame.tsx  wrapper per section: universal + style settings → CSS
  section-boundary.tsx  one broken section never breaks the page
  live-preview.tsx   client: swaps in server-drawn page from postMessage content
  preview-bridge.tsx client: selection outline, scroll, click/dblclick, reports to editor
components/admin/page-builder/   (editor side)
  page-builder.tsx   the editor shell: state, autosave, publish, preview iframe, messages
  section-list.tsx   sortable list (dnd-kit)
  section-editor.tsx Content / Style tabs, StyleTab groups
  field-controls.tsx one control per field kind
  design-controls.tsx typography / buttons / images / layout / visibility parts
  add-section-dialog.tsx, section-thumbnails.tsx
app/
  (storefront)/[handle]/page.tsx       public route for builder pages
  (admin)/admin/pages/[id]/content     the editor
  (admin)/preview/pages/[id]           the preview route (staff only, framed by the editor)
  (admin)/preview/actions.tsx          Server Function: renderPagePreview(content)
  api/admin/pages/builder/route.ts     save draft / publish / discard / rollback / convert
styles/sb-design.css, sb-carousel.css  the ONLY CSS the style system adds (shared)
```

**The rule that makes it portable:** definitions (`lib/page-builder`) know nothing about
React or the design; renderers map a section to **the target project's existing
components**; the style system only sets CSS custom properties and `data-*` attributes that
one static stylesheet turns into CSS. Swap the components and tokens → a different-looking
builder with the same editor.

---

## 3. Data model and storage

### Document

```ts
type PageDocument = {
  version: 1;
  page: { surface: GroundName; footerSurface: GroundName };   // page-level look
  sections: SectionInstance[];                               // ORDER = array order
  meta: { revision: number; savedAt; savedBy; publishedAt; publishedBy };
};
type SectionInstance = { id: string /* s_xxxxxxxx */; type: SectionType; visible: boolean; settings: object };
```

- No `position` field — two sources of truth for order is how pages get two "3rd" sections.
- Ids are random, prefixed (`s_…` sections, `b_…` blocks), validated by regex.
- Limits: max 40 sections, max ~200 KB JSON.

### Three copies per page

| Copy | Who reads it |
|---|---|
| `published` | the public storefront — the only one it reads |
| `draft` | the editor (autosave writes here) |
| `previous` | what the last publish replaced — one-step rollback |

On Shopify these are **page metafields** (`custom.sections`, `custom.sections_draft`,
`custom.sections_previous`); draft and previous have **no storefront access**. In another
stack, implement a **storage adapter** with the same contract:

```ts
interface BuilderStore {
  get(pageId): Promise<{ draft; published; previous }>;
  save(pageId, nextDraft, baseRevision): Promise<{ revision }>;   // CONFLICT if base is stale
  publish(pageId, baseRevision); discard(pageId, baseRevision); rollback(pageId, baseRevision);
}
```

Every write is **atomic** (one request) and names the **revision it was based on**; a stale
revision is refused as `CONFLICT` and the editor says "Edited elsewhere — Load latest".

### Reads are lenient, writes are strict

- `lenient(input)`: never throws. Field by field — a bad value costs that value, not the
  section; an unknown section type is dropped and **reported** ("2 sections could not be
  read and were left out"). Pages must never break because data went bad.
- `strict(input)`: zod `strictObject` — unknown keys and invalid values refused. Every API
  write goes through it.

---

## 4. The field vocabulary and `defineSection`

### Field kinds

`text, textarea, richText, image, imageList, link (label+href), url, video (YouTube/Vimeo
only), select (dropdown or segmented buttons), toggle, number (min/max), color (#rrggbb only),
product(s), collection(s), blocks (repeatable groups with their own fields), design (the
style value, §9)`.

Each field has: `key, label, help?, required?, group: content | layout | style | advanced,
when?: { field, is: [...] }` (shown only when another field has one of those values),
`nextOnly?` (exists only in the main renderer). Helpers: `text("title", "Heading", {...})`.

Each kind owns **its zod schema** (strict + lenient), **its default**, and **its editor
control**. Security lives here: links pass `isSafeHref` (paths, https, mailto, tel — never
`javascript:`/`data:`), images must be from the platform CDN, colours are `#rrggbb`, rich text
is a structured AST rendered by an escaping serializer with a URL-scheme allowlist.

### `defineSection`

```ts
export const textBlock = defineSection({
  type: "text_block",
  label: "Text",
  description: "A heading, a few paragraphs and one optional button — the usual text section.",
  category: "Text & media",
  fields: [text("title", "Heading", { required: true }), richText("body", "Text"), link("link", "Button")],
  universal: ["surface", "hideOn"],      // optional subset of universal settings
  omitStyle: [],                          // style controls that would do nothing here
  textAlign: true, innerSpacing: true,    // capability flags (see §7 "hide what does nothing")
  summaryKey: "title",                    // label in the section list
  source: (s) => null,                    // "this content is edited elsewhere" link, if any
});
```

It returns `{ fields (visible), defaults(), strict, lenient, missing(), summary(), … }`.
Settings types are **inferred from the field list** — renderers get typed `s.title`.

**Universal settings** (every section): `surface` (brand ground), `hideOn`. **Style fields**
(every section unless omitted): `bgColor, textColor, customSpacing, paddingTop/Bottom,
marginTop/Bottom, border, borderWidth, borderColor, radius, design`.

`missing(settings)` lists required-but-empty fields; drafts may save with them, **publishing
is refused** with the list.

---

## 5. Rendering

```ts
const RENDERERS = {
  product_rail: renderer<"product_rail", Product[]>({
    load: async (s) => getCollectionProducts(s.collection.handle, s.limit),   // server-side data
    render: (s, products) => <ProductRail title={s.title} products={products} view={carouselView(s, DESIGNED.row)} />,
  }),
  text_block: renderer<"text_block">({ render: (s) => <TextBlock {...s} /> }),
} satisfies { [T in SectionType]: SomeRenderer<T> };   // compile error if a type has no renderer
```

- Renderers call **the target project's existing components**. Where a section has no
  existing component, build one in the project's style — never a "builder style".
- Each section renders inside `<SectionBoundary>` (error boundary) and `<SectionFrame>`.
- `SectionFrame` is a single `div` with `data-section-id`, `data-section-type`,
  `data-surface` (ground), the style settings as one inline style + `data-sb-*` attributes
  from the design value. It changes nothing when every style setting is default — **a page
  made before the style tab existed must render pixel-identical**.
- `BuilderPage` renders the page shell (header/footer) around the sections; the public route
  `/<handle>` renders the **published** document; handles that collide with app routes are
  reserved (`handles.ts`).
- **Migrating existing hand-built pages**: write each as a document (`migrations.ts`), then
  prove it renders the same DOM as the old route before switching the route over.

---

## 6. The editor

### Layout

Top bar: back, page title + handle, Content | Settings tabs (page settings: title, handle,
SEO, visibility, delete), status ("Draft saved" / "Saving…" / "Unsaved changes" /
"Edited elsewhere" / "Signed out — not saved"), undo/redo, device switch, Preview (new tab),
Publish, more (discard draft, rollback).

Left panel: **section list** (drag handle, label + summary, eye toggle, menu: move up/down,
duplicate, delete with undo toast) → click opens the **section editor** (Content | Style tabs).
Right: the **preview iframe**, scaled to fit at the chosen device width (desktop 1440 / tablet
820 / mobile 390).

### State and saving

- One reducer for the document (`reducer.ts`): add, update setting by path, move, duplicate,
  remove, toggle. Undo/redo stacks of document snapshots.
- **Autosave** 1.2 s after the last change: `save(draft, baseRevision)`. Rules learned the
  hard way:
  - a failed save is **not retried automatically** for the same content (it hammered the API
    every 1.2 s for as long as the failure lasted) — a new edit or "Try again" retries;
  - **401** → state `signedOut`: stop autosaving, show "You were signed out, so your latest
    changes are not saved yet" + **Sign in again** (opens login in a new tab, keeps the page)
    + **Save now**;
  - **CONFLICT** → stop autosaving, "Edited elsewhere" + **Load latest**;
  - leaving the editor (tab switch, back) flushes first; unmount sends a last save;
  - `beforeunload` warns while dirty or saving.
- A **session keep-alive** pings the auth session endpoint every 10 min while a tab is visible,
  so long editing sessions never expire mid-work (idle sessions still do).
- On open, ask the server for the draft's revision; if it moved on (back/forward cache), reload.

### Add section

Dialog: categories (Banners, Intro, Text & media, Images, Catalogue, Site…), search over
label/description, a wireframe SVG thumbnail per preset on hover, **Add**. Every type is
offered at least once (from defaults); variants are presets. On add: `withExamples()` fills
empty content fields with example text and the shop's own photos/products/collections, the
toast says "… added — it holds example content", the preview scrolls to it, and the editor
opens it.

---

## 7. UX rules (non-negotiable — this is what made it pleasant)

1. **Words of the page, not of the code.** No "band", "rhythm", "surface", "copy", "alt
   text" in the UI. "Brand colour", "Space inside", "Show on devices".
2. **Hide what does nothing.** A control that cannot change what this section shows is not
   shown — not shown and explained. Examples:
   - no text in the section → no Typography group; only text → no "Style for" switch with one
     choice; no buttons → no Buttons group; no photos → no Images group / photo corners;
   - a section whose own photo is its ground → no background photo/gradient (it would sit
     behind, unseen) and no own-colour; fixed-height banner → no top/bottom padding;
   - no content column → no "Content width"; a section that positions text per slide → no
     "Text alignment"; a tab with nothing on it → no tab.
   Use static capability flags on the definition **and** what the preview reports the section
   actually draws (§8 `contents`).
3. **No dead ends.** When something is unavailable for a reason the editor can act on, say why
   in one sentence **and offer the fix as a button** ("This section is joined to the Page
   heading — [Change the look on the Page heading] [Style this section on its own]").
4. **Defaults change nothing.** Every new setting's default reproduces the current look
   ("As designed"); opting in changes it. Existing pages never move on their own.
5. **Start from what is there.** Turning on custom spacing pre-fills the section's current
   padding (measured in the preview); empty side paddings show the measured gutter as
   placeholder.
6. **Never empty.** New sections come with example content; empty states offer the next action.
7. **One control per concept.** Background colour, gradient, photo, overlay live in ONE
   Background group; line, corners, shadow in ONE Border & shadow group; padding/margin in ONE
   Spacing group (four boxes top/right/bottom/left + link toggle, per device).
8. **Readable by default.** Picking a dark background auto-picks a readable text colour; a
   contrast warning appears below 4.5:1 (3:1 headings).
9. Every per-device control shows the device icon and "Same as desktop until changed here."

### Style tab structure (final)

```
[device switch]
▸ Background        brand colour · own colour · gradient · photo (+phone crop, keep in view)
                    · overlay colour + opacity · section's own darkening · text colour · contrast
▸ Spacing           "Set the spacing yourself"  → Padding [T][R][B][L] 🔗   Margin [T][R][B][L] 🔗
▸ Border & shadow   line · thickness · colour · corners (per device) · photo corners · shadow · transparency
▸ Typography        Style for: Headings | Text | Buttons → font · size (per device) · weight · colour · case · alignment
▸ Buttons           Normal | Under the pointer colours · line · corners · padding · space above · gap
▸ Images            shape · zoom on hover
▸ Width & height    content width (per device) · minimum height · content sits
▸ Show on devices   desktop · tablet · mobile
[Reset style]
```

---

## 8. Live preview

```
editor ──postMessage {type:"content", content}──▶ preview iframe (/preview/pages/:id, staff only)
                                                   LivePreview → Server Function renderPagePreview(content)
                                                   → React reconciles the new page in place
editor ──{type:"style", id, style, attrs}────────▶ PreviewBridge sets them on the frame at once
editor ──{type:"select", id}─────────────────────▶ outline + scroll into view
preview ─{type:"clicked", id}────────────────────▶ editor selects the section
preview ─{type:"contents", id, contents}─────────▶ editor hides controls that do nothing
preview ─{type:"edit-request"/"edit", path, value}▶ in-place text editing (double-click)
```

- **Content** is sent 150 ms after each change; the server draws it with the **same
  components as the live site** (that is why the preview always matches the real design).
  Only the newest answer is applied; while text is being edited in place, redraws wait.
- **Style** is applied instantly by setting the frame's inline style and `data-sb-*`
  attributes (only `data-sb-*` / `data-surface` are allowed — the bridge must not set arbitrary
  attributes).
- **`contents` report**: after selection and after every redraw *commit* (dispatch the
  "rendered" event from a `useEffect` on the new page, NOT a `requestAnimationFrame` after
  `startTransition` — a transition can commit frames later), the bridge reports
  `{ heading, text, button, image, container, padTop, padBottom, padLeft, padRight }`.
- **In-place editing**: on double-click the bridge asks the editor which setting the text is
  (`findTextPath` matches by value, blocks included, rich text excluded), makes the element
  `contentEditable`, streams keystrokes back through the editor's history (undo works).
- Security: every `message` handler checks `event.origin === location.origin` (and the editor
  checks `event.source === iframe.contentWindow`); the preview route requires a staff session
  and may only be framed by its own origin (`frame-ancestors 'self'`).

---

## 9. The style system (design value)

One sparse JSON value per section (`design`), plus the plain style fields. **Unset = the
design's own value; `{}` changes nothing.** Per-device values are `{ d, t, m }` — desktop
applies everywhere, tablet below 1024 px, mobile below 750 px (use the target's breakpoints).

```ts
type DesignValue = {
  heading?: TypeStyle; text?: TypeStyle; button?: TypeStyle;      // font, size{d,t,m}, weight, lineHeight, letterSpacing, color, transform
  align?: Responsive<"left"|"center"|"right">;
  buttonLook?: { background, color, borderColor, hoverBackground, hoverColor, hoverBorderColor,
                 borderWidth, radius, padX{dtm}, padY{dtm}, spaceAbove{dtm}, gap{dtm} };
  background?: { image, mobileImage, position, overlay, overlayOpacity, gradient{from,to,angle} };
  spacing?: { t?: {pt,pb,mt,mb}; m?: {…} };                        // tablet/mobile overrides
  sides?: { padLeft, padRight, marginLeft, marginRight };           // each {d,t,m}
  radius?: { t?, m? }; shadow?: "soft"|"medium"|"strong"; opacity?: number;
  images?: { ratio?: "square"|"portrait"|"landscape"|"wide"; radius?: number; zoom?: boolean };
  maxWidth?: Responsive<number>; minHeight?: Responsive<number>; verticalAlign?: "top"|"center"|"bottom";
  hide?: { d?, t?, m? };
};
```

`designStyle(value)` → `{ style: { "--sb-h-size": "40px", "--sb-h-size-m": "28px", … },
attrs: { "data-sb-hsize": "d m", … } }`. One static stylesheet applies them:

```css
[data-sb-hsize~="d"] :is(h1,h2,h3,h4,h5,h6) { font-size: var(--sb-h-size); }
@media (max-width: 749px) { [data-sb-hsize~="m"] :is(h1,…,h6) { font-size: var(--sb-h-size-m); } }
[data-sb-btn-bg] [data-sb-button]:not([data-sb-button="text"]) { background-color: var(--sb-btn-bg); }
[data-sb-pad][data-sb-padl~="d"] .sb-container { padding-left: var(--sb-padl); }
```

Hard-won details:

- The stylesheet is **unlayered** so it beats Tailwind utilities (which live in
  `@layer utilities`) without `!important`. Never fight a layered `!important` utility with
  an unlayered `!important` — layered wins for important declarations; drop the utility class
  instead.
- **Hooks in the target's components**: every button carries `data-sb-button="<variant>"`, a
  row of buttons `data-sb-buttons`, the content column a class like `.sb-container`, the
  padded band of a section a known padding class (or `sb-band`). Adding these to the target's
  existing components is the main "integration" work — list them in the design inventory.
- **"Text" means running text wherever it is**: `p, li, li > a, figcaption, blockquote, dt, dd`.
- **Custom spacing replaces** the band's own padding (`[data-sb-pad]` rule), not adds to it.
- Values are validated narrowly (hex colours, enums, bounded numbers, CDN image urls) — they
  land in a style attribute; nothing typed reaches CSS as free text. Background image urls are
  `JSON.stringify`'d into `url(...)`.
- Fonts: a curated list, self-hosted (Fontsource), declared with `@font-face` once — browsers
  only download what a page uses. Map the target's own font as "Default".
- **Brand presets** ("grounds"): the Style tab's "Brand colour" offers the target's own named
  surfaces, each rebinding the colour tokens (`--background`, `--foreground`, `--muted`,
  `--border`, `--primary`…) on the section. Derive them from the design inventory.

---

## 10. Carousels

Shared fields on every scrolling row (`carousel.ts`): **Items across** on desktop / tablets /
phones (`As designed`, 1–6, "1/2 and a peek of the next"), **Each arrow moves** (1, 2, 3 items,
a whole row), **Show at most**, **Show more button** (text + link). `carouselView(settings,
designed)` returns `{ perView | null, step }`; `perView: null` keeps the section's own widths
(so existing rows don't move). Chosen widths are `data-cv` + `--cv-d/t/m` and gap counts,
drawn by one shared CSS rule:

```css
[data-cv] > * { flex: 0 0 auto; width: calc((100% - var(--gap) * var(--cv-m-gaps)) / var(--cv-m)); }
@media (min-width: 750px)  { [data-cv] > * { width: calc((100% - var(--gap) * var(--cv-t-gaps)) / var(--cv-t)); } }
@media (min-width: 1024px) { [data-cv] > * { width: calc((100% - var(--gap) * var(--cv-d-gaps)) / var(--cv-d)); } }
```

Embla: `slidesToScroll: step === "page" ? "auto" : step`. Keep the carousel module's drawing
half free of zod/validation imports — the client component imports it.

---

## 11. Header & footer builder (optional)

Same draft/publish/rollback contract, stored as shop-level JSON. Header: announcement bar,
desktop and mobile zones (left/center/right) of elements (logo, menu, search, account, cart,
language, button, text, social…), sticky / transparent-over-hero / shrink / shadow on scroll,
dropdown colours. Footer: columns of elements. Site style: site-wide fonts and buttons (the
same design value, applied on the page shell; a section's own still wins). Live preview
around a real page. Until the first publish, the storefront keeps its original header/footer.

---

## 12. Security checklist

- Every admin route and Server Function checks a valid staff session; writes also check
  same-origin (CSRF) and a rate limit; request bodies are size-capped while streaming.
- Strict zod on every write; lenient parse on every read.
- Links: `isSafeHref`; rich text: escaping serializer + scheme allowlist; images: CDN only;
  colours: `#rrggbb`; all numbers bounded.
- Preview route staff-only, framed only by its own origin; postMessage origin/source checks;
  bridge may set only `data-sb-*` attributes.
- Draft and previous copies are not readable by the public API.
- Admin CSP with nonce; storefront CSP kept off admin/preview paths (two policies on one
  response both apply).
- Sessions: renewed while active (keep-alive), expire when idle; a 401 stops autosave cleanly.

---

## 13. Automated checks (build these alongside, they caught real bugs)

| Check | What it proves |
|---|---|
| unit (`check:page-builder`) | every definition's defaults and every preset pass the strict schema; designStyle outputs; carousel resolution; migrations |
| editor UI (Playwright, temp page, deleted after) | add/reorder/delete, Content/Style tabs, autosave, publish; style values reach the preview (computed styles); hidden-when-empty rules |
| style probe (Playwright, every section type) | each style setting **visibly** changes what is painted — sample **pixels** from screenshots, not just computed styles (a gradient behind an opaque band computes fine and shows nothing). Keep the sample point inside the viewport. |
| parity (if a second renderer exists) | schemas generated from the same definitions; a shared snippet's output equals `designStyle()` for every control |
| security | auth/CSRF/rate limits/body caps; CSP headers on the right paths |

Never let a test publish or overwrite real content; use throwaway pages and delete them.

---

## 14. Adapting to a different design — the checklist

1. **Inventory first** (Phase 0): tokens, buttons, cards, existing sections → `design-inventory.md`.
2. **Grounds** = the target's named background/foreground pairs; rhythm steps = its spacing scale.
3. **Sections** = the target's existing page blocks, each wrapped as a definition + renderer.
   Keep the field vocabulary; change only what each section exposes.
4. **Hooks**: add `data-sb-button`, `data-sb-buttons`, the container class and band padding class
   to the target's components (the only intrusive change).
5. **"As designed" defaults** = the target's current look (items across, widths, paddings).
   Measure them; the defaults must reproduce them exactly.
6. **Thumbnails** in Add section = simple wireframes of the target's sections.
7. **Example content** = the target shop's own photos/products, sample copy in its tone.
8. **Fonts** = the target's brand font as "Default" + a short curated list.
9. **Editor chrome** = the target's admin UI kit, or shadcn/ui.
10. **Verify** with the style probe and a side-by-side of a migrated page vs the original.

### What is safe to copy verbatim vs what must be redesigned

| Copy as-is | Redesign per project |
|---|---|
| document model, storage contract, revisions/conflicts | section components and their markup |
| field vocabulary, `defineSection`, registry, presets mechanism | grounds/brand presets, fonts list, type scale bounds |
| editor shell, autosave rules, preview messaging | thumbnails, example content, labels' wording to the shop's tone |
| design value + `designStyle` + the CSS selector scheme | breakpoints, container/gutter class names, button variants |
| UX rules (§7), security (§12), checks (§13) | which sections exist and which style groups each offers |
