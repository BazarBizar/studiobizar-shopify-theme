# Page builder (MVP-1)

Lets staff build **new** pages in `/admin` from the storefront's existing sections, with a draft,
a live preview and a publish step. A layer on top of the storefront, not a second one: every
section renders through a component the hand-built pages already use.

MVP-1 covers new pages only. Pages whose layout is code (`/`, `/our-story`, …) are untouched
and cannot be opened in the builder yet — converting them is MVP-2.

## Where it lives in the panel

One menu, **Website → Pages**, is the single place a page is managed. The list shows every page
with two separate statuses — **Visibility** (Visible / Hidden: Shopify's own switch) and
**Content** (Published / Unpublished changes / Draft / Not set up / Fixed layout) — and each page
opens on two tabs:

| Tab | Path | What |
|---|---|---|
| **Content** | `/admin/pages/<id>/content` | the page builder: sections, their content, page colours |
| **Settings** | `/admin/pages/<id>` | title, address, *Visible on the site*, search engine listing, Delete page (builder pages only); the Shopify body only for pages the builder does not draw |

**New page** is a button on the list (`/admin/pages/new`). The old builder addresses
(`/admin/page-builder/**`, `/admin/pages/<id>/builder`) redirect to these.

Words are kept apart on purpose: **Publish** only ever means putting edited content live;
whether a page exists for visitors is **Visible / Hidden**. Publishing never changes visibility,
except that a page's first publish makes it visible.

The sidebar groups: **Website** (Pages, Menus, Media), **Content library** (Services, FAQ — the
entries sections draw on; locations and contact channels are on Site-wide).

### In the editor

- A section whose content comes from elsewhere says so, with a link: *"Its content comes from
  Services — edit it there"*.
- **Show on** (All devices / Desktop only / Mobile only) is per device; the eye button hides a
  section everywhere.
- Fine adjustments that exist so pages match their design exactly sit under **Advanced**,
  folded away.
- **Placement: Joined to the Page heading above** is offered only directly under a Page heading; when
  it is on, the section's own background and spacing are not offered, because they do not apply. Its
  Style tab says why and offers two buttons instead: open the Page heading's Style tab, or switch the
  section back to **Its own section**.
- Editor-facing text avoids internal words ("band", "copy", "measure", "alt text"): labels say what
  the editor sees on the page, and a message that explains why something is unavailable also offers
  the way out as a button or link, never only the name of a setting to go and find.
- Links have a **Choose** picker (pages, collections, site sections); FAQ category is a pick-list
  of the categories in use.
- **Load previously published version** puts the earlier version into the DRAFT; it goes live only
  when published.
- *Contact form* is retired from Add section (still renders where used): *Contact form* — the
  former "Contact details & form" — can show the form alone. *Text* is the usual band; *Text
  blocks* is the free-form one. The hero has no caption field (it shows images only); its alt text
  describes each slide.

## Data

No database. Three JSON PAGE metafields, provisioned by `schema-push`:

| Key | Storefront access | Holds |
|---|---|---|
| `custom.sections` | `PUBLIC_READ` | the published document — the only one the storefront reads |
| `custom.sections_draft` | `NONE` | the working copy the builder autosaves |
| `custom.sections_previous` | `NONE` | the version the last publish replaced (one-step rollback) |

```json
{
  "version": 1,
  "page": { "surface": "dark", "footerSurface": "olive", "seoTitle": "", "seoDescription": "" },
  "sections": [
    { "id": "s_8f2k1abc", "type": "text_block", "visible": true,
      "settings": { "title": "…", "body": "<rich text AST>", "link": { "label": "…", "href": "/shop" },
                    "surface": "inherit", "rhythm": "default", "hideOn": "none" } }
  ],
  "meta": { "revision": 7, "savedAt": "…", "savedBy": "…", "publishedAt": "…", "publishedBy": "…" }
}
```

Order is array order. Images are stored as `{ id, url, altText, width, height }` snapshots,
products and collections as `{ id, handle, title }` — values a Liquid theme can render from the
same document without a Next helper.

## The Style tab

Every section's editor has two tabs, **Content** and **Style**, like Elementor's. Style holds the
same controls on every section (`STYLE_FIELDS` in `define-section.ts`):

The tab is ONE list of groups that fold away (`StyleTab` in `section-editor.tsx`). Each group holds
everything of one kind, wherever it is stored — a section setting or the design value:

| Group | Settings |
|---|---|
| Background | Brand colour (the design's surfaces) or an own colour; a gradient; a photo (and a phone crop, which part stays in view); an **overlay** colour and its **opacity**, over whichever is there; the section's own photo darkening (banners, slideshow, CTA on a photo); text colour; the contrast warning |
| Spacing | "Set the spacing yourself": space inside top/bottom, space above/below, and the sides — space inside left/right (replaces the content column's gutter; empty keeps it, shown as measured) and space outside left/right (narrows the section: with a colour and corners, a card) — each per device (the device switch at the top). Off: the design's own spacing |
| Border & shadow | Line (none, box, above, below, above and below), thickness, colour; rounded corners (per device); photo corners where the section has photographs; shadow; transparency |
| then | Typography, Buttons, Images, Width & height, Show on devices (see below) |

- Every default changes nothing, so pages made before the tab existed look the same. Stored
  documents without the keys read them as their defaults (`lenient`).
- Colours are `#rrggbb` only (the new `color` field kind) and rebind the same `--sb-*` tokens a
  surface does, so headings, muted copy, lines and buttons inside follow. Picking a background
  colour while the text colour is empty also sets a readable text colour (earth or dark wood).
- Custom padding REPLACES the padding of the section's **band**, top and bottom, through the
  `[data-sb-pad]` rule in `globals.css` (and `sb-theme.css`). The band is the outermost element with
  a `*-section` padding utility, or one marked `sb-band` where a component pads with fixed values
  (`collection-carousel`, `instagram-row`). A new component with fixed vertical padding on its band
  needs `sb-band`, or custom spacing will be added to its padding instead of replacing it.
- **Vertical spacing is no longer offered** (2026-10-23): it did nothing on many sections, and
  "Set the spacing yourself" covers it. Stored values still draw (`rhythm` stays in the document
  and in the Liquid schemas, which theme templates use), and a section that has one says so in
  Spacing with two buttons: *Keep it, as numbers* (measured from the preview) or *Use the design's
  spacing*. Turning the switch on starts from the section's current space as the preview
  measures it (`padTop`/`padBottom` in `sb-preview:contents`), so nothing moves until a number
  changes.
- `omitStyle: OWN_GROUND` hides the colours on sections that paint their own ground edge to edge
  (banners, slideshow, hero, full image, collection carousel, Instagram) — and with them the
  background photo and gradient, which would sit behind that ground unseen.
- The sides are `design.sides` (`padLeft`/`padRight`/`marginLeft`/`marginRight`, each `{ d, t, m }`), drawn by `styles/sb-design.css` only while Custom spacing is on — like the top and bottom. Inside sets the padding of the section's `.sb-container` (or the section itself where there is none); the Liquid theme has the same settings (`d_pad_left` …).
- `defineSection({ innerSpacing: false })` (image banner, slideshow): the height is the photo's or
  the Height choice, so Spacing offers only the space above and below.
- `yarn check:page-builder-style` (with `yarn dev` running) measures every section type in a real
  browser: margin, padding, colour, line, corners, stored Vertical spacing, and that a section joined to the
  page heading does not inherit the heading's spacing. It builds hidden test pages and deletes them.
- `SectionFrame` (`frameStyle`) and `theme/snippets/sb-section-style.liquid` write the same
  declarations. A section joined to the page heading's band takes the heading's style instead.
- `defineSection({ style: false })` hides the tab's extra controls for a section where they would
  do nothing.

## A new section arrives filled; the preview follows live

- **Example content.** A section added from Add section is filled by `withExamples`
  (`lib/page-builder/examples.ts`): every still-empty content field gets an example — heading,
  text, button, and the shop's own photographs, products and collections (`getExampleMedia`,
  loaded with the Content tab). A preset's own copy stays; colours, sizes and choices are never
  touched; a field whose emptiness means something ("Leave empty to use the page title") stays
  empty. The editor says "… added — it holds example content", and the preview scrolls to it.
- **Live preview.** The editor posts what is on screen to the preview 150ms after each change
  (`sb-preview:content`); `LivePreview` has the server draw it (`renderPagePreview`, a Server
  Function in `app/(admin)/preview/actions.tsx`) and React reconciles it into the page in place —
  no save in between, scroll and carousels undisturbed. The selected section's Style is applied
  at once (`sb-preview:style`), so a slider moves the section as it is dragged. Autosave runs
  behind, unchanged. The Theme Builder's preview works the same way (`renderThemePreview`).

- **Editing in place.** Double-click a heading, a line, a button label or a caption in the
  preview and type over it; Enter or a click elsewhere finishes, Escape puts it back, Shift+Enter is a
  new line. The preview asks the editor which setting the text is (`findTextPath`,
  `lib/page-builder/inline-edit.ts`, matched by value, blocks included, rich text excluded); each
  keystroke updates it through the editor's history (so Undo works); the live redraw waits until
  the edit ends. Clicking a section in the preview selects it without scrolling the page.
- **Narrow screens.** Below 1024px a "Show preview / Back to editing" button switches between the
  settings and the preview (`PaneSwitch`); the preview stays loaded while hidden.
- **One "Show on".** For a section with the design panel, the Content tab's old *Show on* select is
  not offered; the three switches under *Show on devices* are the one control. A choice
  the old setting can express (all / desktop only / mobile only) is stored there — what the Liquid
  theme reads — and only a tablet-specific one goes to `design.hide`.
- **Readability.** The Style tab warns, with the contrast ratio, when text or headings would be hard
  to read on the chosen background (WCAG: 4.5:1 for text, 3:1 for headings).

## Carousels

Every section that scrolls a row — Product carousel, Collection carousel, **Project carousel**
(new), Instagram, Testimonials (Carousel layout) — has the same settings
(`lib/page-builder/carousel.ts`), under Layout:

- **Items across** on desktop, tablets and phones: 1–6, or "1 (or 2) and a peek of the next".
  "As designed" (the default) keeps the section's own widths, so existing pages do not move; one
  device chosen fills the others from the design (`DESIGNED`).
- **Each arrow moves** 1, 2 or 3 items, or a whole row.
- **Show at most** (or the section's existing "How many").
- **Show more button**: its text and link. On sections that had "Show view all" it is that button;
  empty keeps "view all" and its page (with chosen products, give it a link). Testimonials have
  their own switch.

`carouselView` (`carousel-view.ts`, no zod — the client `Carousel` imports it) turns them into
`perView`/`step`; a chosen width is `data-cv` + `--cv-*` properties, drawn by the shared
`styles/sb-carousel.css` (imported by both builds). The Liquid testimonials write the same
properties, and `assets/sb-carousel.js` reads `data-sb-carousel-step`. `check:liquid-render` measures
two across and a two-item step there; `check:page-builder-ui` sets them on a Project carousel.

## The design value (per device)

Below Background, Spacing and Border & shadow, the Style tab edits one `design` value
(`lib/page-builder/design.ts`; `design-style.ts` is its zod-free half, for client components). Its
background, per-device spacing and corners, shadow and transparency are drawn in those three
groups; the rest in these:

- **Typography** for Headings, Text and Buttons — font (Helvetica Neue, or one of ten self-hosted
  Fontsource fonts, downloaded only when used), size, weight, line height, letter spacing, colour
  (not for buttons — see Buttons), letter case; text alignment.
- **Buttons** (`buttonLook`) — background, text and line colour, as they are and under the pointer;
  line thickness; rounded corners; space inside (sides, top and bottom), space above the buttons
  and between them, per device. Filled and outlined buttons take all of it; a text link only its
  colours. Each button carries its variant (`data-sb-button="solid|outline|text"`) and a button row
  is marked `data-sb-buttons`, so "space above" replaces the row's own margin. A chosen colour
  stays under the pointer and dims (the outline's fill-on-hover could hide it) unless a hover
  colour is set; a new background with no text colour gets a readable one. Offered on sections
  with buttons, on each Hero slider slide, and for the whole site (Theme Builder → Site style →
  Buttons for the whole site), where a section's own still wins.
- **Images** (not on banners and heroes, whose photograph is their ground): a shape for every
  photograph in the section (square, tall, landscape, wide) and a slow zoom on hover. Their corners
  are under Border & shadow.
- **Width & height** (content width, minimum height, where content sits), **Show on devices**.

Only what does something is offered. When a section is selected, and after each redraw, the preview
reports what that section actually draws (`sb-preview:contents`: headings, text, buttons, images,
a content column). Typography then offers only the targets it has (Three photographs: Text — its
captions; a choice of one shows no switch, and a section with no text has no Typography group at all), Images hides where there is no photograph, and Content width hides on sections that run
edge to edge (full image, marquee, spacer). "Text" covers paragraphs, list items, captions, quotes
and term/description pairs. `defineSection({ textAlign: false })` drops Text alignment where the
section places its own text (the slideshow: Text position per slide).

On a section with photographs, Border & shadow offers **Section corners** (its background and
line — the help says when there is nothing yet to see them on) and, beside it, **Photo corners**
(`design.images.radius`).

Values that can differ per device are stored as `{ d, t, m }`: desktop applies everywhere, tablet
below 1024px, mobile below 750px — Elementor's inheritance. The editor's device switch (above the
preview, and at the top of the Style tab) sets both the preview width and which value every
responsive control edits; the desktop preview renders at 1440px and is scaled to fit.

The value is sparse: unset means the brand's own value, an empty object changes nothing, and each
control has its own reset. `SectionFrame` turns it into custom properties plus `data-sb-*`
attributes; the static rules in `globals.css` (section "DESIGN") apply them per breakpoint — no
`<style>` per section. The same value styles each slide of the **Hero slider**
(`fields: design("design", …, { parts: ["typography"] })`) and the Theme Builder's typography.

**In the Liquid theme** (decided 2026-10-23): the most-used part of the design value, desktop and
phone (Shopify's editor has no tablet) — typography for headings, text and buttons (font, size,
weight, colour, case) and text alignment; the Buttons look; the photographs' shape, corners and
zoom; shadow, content width, minimum height. One table, `scripts/lib/liquid-design.ts`, drives the
`d_*` section settings (in each generated schema, offered only where they do something), the
Site style group (`site_*`) in `config/settings_schema.json`, and the generated
`snippets/sb-design.liquid`, which `sb-section-style` renders (and `theme.liquid` on `<body>` for
Site style). It writes the same custom properties and `data-sb-*` attributes as `designStyle`, and
both builds import the same rules, `styles/sb-design.css`. The ten fonts are the same Fontsource
files, copied to `theme/assets/sb-font-*.woff2` with `snippets/sb-font-faces.liquid`.
`yarn liquid:design` writes all of it; `check:liquid` fails when it is stale; `check:liquid-render`
renders the snippet for real design values and requires exactly what `designStyle` writes, then
measures a designed section in Chromium at both widths.

Still Next only: background image/gradient/overlay, line height, letter spacing, transparency,
per-device spacing, tablet values, a slide's own design, and fields marked `nextOnly: true`.
Shopify Theme Check warns (ExcessiveSettingsCount, advice, not a limit) on sections now above 40
settings.

**Hero slider** (`slideshow`): each slide has its own photo and phone crop, two buttons, text
position on desktop and on phones, text width, text colour, darkening (shared or its own, with a
colour) and typography; the slider's height can differ on phones, and slides change by fade,
sideways slide, or fade with a slow zoom (reduced motion: always a fade).

## Files

| Path | Role |
|---|---|
| `lib/page-builder/fields.ts` | field vocabulary, value shapes, per-field Zod, `isSafeHref` |
| `lib/page-builder/define-section.ts` | `defineSection()` + the universal settings (surface, rhythm, hideOn) and the Style tab (`STYLE_FIELDS`) |
| `components/page-builder/section-frame.tsx` | the wrapper every section draws in; `frameStyle` turns the Style tab into CSS |
| `lib/page-builder/sections.ts` | the section definitions lifted from hand-built pages |
| `lib/page-builder/sections-landing.ts` | the landing sections (banners, columns, quotes, …) |
| `lib/page-builder/presets.ts` | what Add section offers: a type + chosen settings + demo copy |
| `lib/page-builder/icons.ts` | the fixed icon set, by name |
| `lib/page-builder/registry.ts` | `SECTIONS` — the single list of what exists |
| `lib/page-builder/document.ts` | document types, strict write schema, lenient `parsePageDocument` |
| `lib/page-builder/templates.ts` | starting layouts for a new page |
| `lib/page-builder/handles.ts` | which handles `/<handle>` may use |
| `components/page-builder/renderers.tsx` | type → data loader + existing component |
| `components/page-builder/renderers-landing.tsx` | the same, for the landing sections |
| `components/sections/landing/*` | the landing sections’ components, design-system classes only |
| `components/admin/page-builder/add-section-dialog.tsx` | Add section: preset list + picture of the highlighted one |
| `components/admin/page-builder/section-thumbnails.tsx` | a wireframe per preset (SVG, no requests) |
| `components/page-builder/section-renderer.tsx` | draws a document; one section failing costs that section |
| `components/page-builder/builder-page.tsx` | shell + sections; fallback for an unreadable document |
| `app/(storefront)/[handle]/page.tsx` | the public route |
| `app/(admin)/preview/pages/[id]/page.tsx` | the draft, rendered by the same `BuilderPage` |
| `lib/admin/page-builder.ts` | read / save / publish / discard / rollback / create / delete |
| `app/api/admin/pages/{builder,create,delete}/route.ts` | the write endpoints |
| `components/admin/page-builder/*` | the editor, the Builder pages table, the New page form |
| `app/(admin)/admin/page-builder/**` | the Page builder menu's screens |

`lib/page-builder/**` is pure — no React, no `server-only` — because the panel's client editor,
the admin API and the storefront renderer all import it.

## Sections

| Category | Type | Draws with | Blocks |
|---|---|---|---|
| Intro | `page_heading` | `PageHeading` | — |
| | `hero` | `HeroSlider` | — |
| Text & media | `text_block` | `IntroBlock` | — |
| | `rich_text` | `RichContent` (= theme `sb-rich-text`) | heading · text · button |
| | `media_text` | `MediaText` | — |
| | `item_list` | `ItemList` (Our Services) | item — or the `service` entries |
| | `faq` | `FaqGroups` + `Accordion` | question — or the `faq_item` entries |
| Images | `captioned_row` | `CaptionedRow` | — |
| | `full_image` | `FullBleedImage` | — |
| | `gallery` | `GalleryGrid` | — |
| Catalogue | `product_rail` | `ProductRail` | — |
| | `product_grid` | `ProductCardGrid` | — |
| | `product_mosaic` | `CollectionHighlightGrid` | — |
| | `collection_carousel` | `CollectionCarousel` | — |
| | `collection_grid` | `CollectionGrid` | — |
| | `project_cards` | `ProjectCards` | — |
| | `designer_grid` | `DesignerGrid` | — |
| Site | `locations` | `LocationList` | — |
| | `instagram` | `InstagramRow` | — |
| | `contact_form` | `ContactForm` | — |
| | `contact_cta` | `ContactCta` | — |
| | `go_back` | `GoBack` | — |

### Landing sections

New bands, drawn only with the design system (type scale, surfaces, section rhythm, the one
button) — every combination of settings still looks like this site. Each component takes plain
props, so a Liquid section can be written from the same settings.

| Category | Type | Settings worth knowing | Blocks |
|---|---|---|---|
| Banners | `image_banner` | 3 × 3 text position, height (to full screen / fit image), darkening 0–80%, light/dark text, text panel, phone crop, two buttons | — |
| | `slideshow` | per-slide position and text colour, autoplay + seconds, arrows/dots; pause control; no autoplay under reduced motion | slide |
| | `cta_banner` | centred · split · on a photograph; width; two buttons | — |
| Text & media | `media_text` | (existing) + small label, image shape, image width, vertical alignment, button style | — |
| | `multicolumn` | images · icons · none; 2–5 columns; phones 1 · 2 · swipe; plain · cards · lines | column |
| | `stats` | figure size, alignment, dividers | figure |
| | `steps` | in a row · timeline; numbers; images | step |
| | `tabs` | WAI-ARIA tabs, image side, underline · buttons | tab |
| | `collapsible` | native `<details>`, optional image, first open | row |
| | `video` | YouTube/Vimeo behind a cover; nothing loads before play | — |
| | `marquee` | CSS-only, size, speed, direction, separator; stops under reduced motion | phrase |
| Images | `collage` | large left/right or even; titles under or on the image | image |
| Social proof | `testimonials` | grid · carousel · one large quote | quote |
| | `logo_list` | per row, size, softened (grey until hover) | logo |
| Catalogue | `featured_product` | 1–3 photographs, product text or your own; no price | — |
| Layout | `spacer` | rhythm-scale height, optional hairline | — |
| Site | `newsletter` | the footer sign-up as a band | — |

### Presets and Add section

Add section lists PRESETS (`presets.ts`), not bare types: “Icon features”, “Cards” and “Text
columns” are all `multicolumn`, set up three ways, with demo copy. A preset only fills in
values — `sectionFromPreset` runs the result through the section’s lenient read, and
`check:page-builder` proves every preset passes the write schema and keeps each value it sets.
Images are never pre-filled; the preview draws a neutral box until one is chosen
(`RenderContext.preview`), and publishing refuses a required one left empty.

The dialog shows a wireframe of the preset under the pointer or the arrow keys
(`section-thumbnails.tsx`, keyed by preset id, falling back to the type’s).

The bands that used to be written inline in a page (`IntroBlock`, `ItemList`, `FaqGroups`,
`LocationList`, `DesignerGrid`, `CollectionGrid`, `ProductCardGrid`, …) were MOVED into
`components/` and those pages now use them; their HTML was diffed before and after and is
identical. Their data helpers (`normalizeService`, `groupFaqItems`, `sortDesigners`, …) live in
`lib/shopify/entities.ts` for the same reason.

## Blocks

A `blocks` field holds an ordered list of `{ id, type, settings }` — the same shape as a
Shopify theme block. Each block type declares its own leaf fields with `block(type, label,
fields)`; blocks do not nest. The editor shows them as rows that open in place, with move,
duplicate and delete.

- Write: each block's settings go through that block type's strict schema; unknown block types,
  unknown keys and duplicate ids are refused.
- Read: blocks are parsed one at a time — a damaged block is dropped, a bad setting inside a
  block becomes its default, the rest of the list renders.
- Publish: a required field left empty inside a block is reported by position, e.g.
  `Question 2: Answer`.

## Adding a section

1. Declare it in `lib/page-builder/sections.ts` with `defineSection`, using the field builders.
   That one declaration gives you the editor form, write validation, tolerant reads, defaults
   and the publish check.
2. Add it to `SECTIONS` in `registry.ts`.
3. Add its renderer to `RENDERERS` in `components/page-builder/renderers.tsx` (or
   `LANDING_RENDERERS`) — `load` with an existing `lib/shopify` function if it needs data,
   `render` with a component. The map is typed against the registry, so skipping this step
   fails the build.
4. Optional: presets with demo copy in `presets.ts` (otherwise it is offered from its defaults),
   and a wireframe in `section-thumbnails.tsx` under the type or preset id.
5. **The Liquid half.** Add `type → file` to `LIQUID_SECTIONS` in `scripts/lib/liquid.ts`,
   write the markup in `theme/sections/<file>.liquid` ending in an empty
   `{% schema %}{% endschema %}`, then `yarn liquid:schemas`, `yarn theme:build` and
   `yarn check:liquid`. Any later change to the section's fields or presets: the same three
   commands — `check:liquid` fails until the theme follows. See `docs/theme/page-building.md`.

Never add a field kind that accepts free CSS, HTML or a class name. Options are enums. A select
can be drawn as a 3 × 3 position grid, an icon grid or a row of buttons (`display`); a `video`
field accepts only YouTube and Vimeo addresses, reduced to provider + id.

## Flow

```
edit ──1.2s──▶ save draft (revision n → n+1) ──▶ preview router.refresh()
publish ──▶ one pageUpdate: previous ← live, live ← draft
       ──▶ revalidateTag("content")
       ──▶ after(): poll the Storefront API until it serves this publishedAt ──▶ revalidateTag again
```

**Why publish revalidates twice.** The Storefront API keeps serving its cached response for
21–29 seconds after an Admin write (measured on this store) — for a changed document, and for a
page that was looked up while still hidden. Dropping Next's cache only at the moment of publishing
refills it from that stale response for the full ISR hour. The second drop, once Shopify serves the
new `publishedAt`, is what makes a publish reliably visible within about half a minute. Delete does
the same, waiting until Shopify stops serving the page.

**The second drop is a separate request.** Next honours one `revalidateTag` per tag per request;
repeating it later in the same request, `after()` included, is ignored (measured). So
`dropInFreshRequest` in `lib/admin/revalidate.ts` POSTs to `/api/revalidate` — only ever to this
app's own origin (`STOREFRONT_URL`, the Vercel URLs, or localhost), since the call carries
`REVALIDATE_SECRET`. Every other panel write gets the same treatment from `revalidateForType`,
on a fixed 35-second delay; the write routes set `maxDuration = 60` for it.

- A save names the revision it was made from; a stale one is refused with `CONFLICT`.
- Drafts may be incomplete. Publish refuses while a visible section has an empty required field.
- First publish also makes the page visible. After that, visibility — like SEO — is set on Pages.
- Loading the previous version fills the draft with what was live before the last publish; publish it to put it back.

## Safety rules, and where they are enforced

| Rule | Where |
|---|---|
| Only registry types, only declared settings, enums only | `documentContentSchema` (write) |
| Links: `/path`, `https://`, `mailto:`, `tel:`, `#` only — also inside rich text | `isSafeHref`, `richTextSchema` |
| Images from `cdn.shopify.com` only | `imageRefSchema` |
| Builder JSON cannot be written through the generic page update | `api/admin/pages/update` refuses the keys |
| A draft cannot be read by the storefront | metafield access `NONE` |
| `/<handle>` renders only builder pages, never `home` or a route segment | `isBuilderHandle` + document present |
| Only builder pages can be deleted | `deleteBuilderPage` re-reads the page |
| Preview needs a staff session, may be framed by this origin only | `proxy.ts` + `currentStaff()` |
| Broken document → page title and body, never a blank page | `parsePageDocument`, `BuilderFallback` |

## Checks

```bash
yarn check:page-builder   # validation and parsing, offline
yarn check:handles        # every route folder is reserved from builder handles
yarn check:admin-ops      # includes pageCreate / pageDelete, against the store, writes nothing
yarn check:page-builder-live  # needs `yarn dev`; creates one hidden pb-check-* page, exercises
                              # save, publish, load previous, SEO and a damaged document, then deletes it
yarn check:liquid             # the Liquid theme matches the builder: schemas, options, presets,
                              # blocks, every setting read by the markup, icons
yarn check:liquid-render      # the theme sections RENDERED locally (liquidjs + Chromium), no Shopify:
                              # every preset, every field empty, overflow, console, tabs/video/slideshow
yarn check:page-builder-ui    # needs `yarn dev`; the editor in a real browser (Playwright): autosave,
                              # undo, preview, leaving mid-edit, Back, publish, delete. Localhost only.
                              # First run: npx playwright install chromium
```

## Editing

- **Undo / redo** — top bar, or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (Ctrl+Y), except while typing in a
  field, where the field's own undo applies. Consecutive edits to one field are one step; history
  is kept for 100 steps and lasts for the editing session. Undo remounts the section form, because
  the rich text editor reads its value only when it mounts.
- **Alt text per use** — every picked image starts with the file's alt text from Shopify and can
  be changed for this page only. Empty means decorative; the image components then fall back to
  the caption.
- **Duplicate page** — ⋮ → Duplicate page. Saves what is on screen, then creates a new hidden page
  at its own handle from the source's draft. The source is not changed; the copy has no published
  version and no rollback history.

## MVP-2 — moving hand-built pages onto the builder

One page at a time, each through an entry in `lib/page-builder/migrations.ts` that turns the
page's current metafields into the builder document that draws the same page.

| Page | Status |
|---|---|
| `/careers`, `/care-maintenance` | migration ready, route opted in |
| `/our-artisans`, `/our-story`, `/services` | migration ready, route opted in |
| `/faq`, `/our-locations`, `/designers` (page `professionals`), `/gallery` | migration ready, route opted in |
| `/contact`, `/` (page `home`) | migration ready, route opted in |

Every page with its own Shopify page now has a migration. `/legal/*` render the Shopify page body
and need none; the catalogue routes (`/shop`, `/collections/[handle]`, …) are templates over
product data, not pages, and are outside MVP-2.

What the migrations carry over: the page's rich text metafields as they are; its
`captioned_image` lists resolved into image snapshots (alt text and caption included, positions
kept — Our Story's second row is gallery images 4–6); copy that was written in the route's code
(Our Services' heading and "Beyond The Project") as editable rich text; and a band the JSX shows
only when it has content becomes a HIDDEN section when it has none.

Three layout options exist so these pages render exactly as before: Page heading → *Space under
heading* (Our Services' intro is 2rem below, not 2.5rem), Heading & text → *Space above: None*
(a block that follows a photograph row) and *Text style: Single paragraph* (`text-body`, not
`sb-prose`).

FAQ, Our Locations, Our Designers and Gallery keep their list in the same band as the page
heading. Their section takes **Placement: Under the page heading**, and when it directly follows
a Page heading, `section-renderer.tsx` draws it inside that heading's container — with the same
spacing and the same "No … published yet" line as the hand-built page. Page heading has a second
style, *Heading and summary* (the narrower header with one paragraph that Our Designers and
Gallery use); their summary is the Shopify page's body summary, carried into the document.

Contact and the landing page added the last few options: Page heading *Heading and lead text*
(Contact's heading-sized intro) and *For screen readers only* (the landing page's h1 under its
image-only hero); a **Contact details & form** section (channels from the Contact channel
entries, so they are still edited once under Site-wide, beside the form); Product carousel
*“View all” position: Beside the heading*; and Projects' optional intro text inside its band.
Product rows store which collection feeds them; the story image is stored as a snapshot like
every other image.

Our Locations: the hand-built page lists the locations its `locations` metafield points at; the
Locations section lists every location entry. On this store today they are the same two. A
location added later shows on the migrated page without being picked.

After a page moves, its photographs are copies: editing the `captioned_image` entries it used no
longer changes the page — edit them in the builder instead.

How a page moves:

1. **Route opts in.** `publishedDocument(page)` returns the published document or null; the route
   renders `<BuilderPage>` when there is one and its own JSX otherwise — including when the
   document is unreadable. `builderMetadata` uses Shopify's SEO fields only while the builder
   version is live.
2. **Parity is proven before the entry is added** — the builder rendering of the converted content
   is compared tag-for-tag with the route's JSX (only the section wrappers may differ).
3. **The operator converts it** — Pages → the page → Open page builder → *Move to page builder*.
   That writes a DRAFT only; the live page keeps its JSX until the draft is published.
4. Once the builder version is live, the page screen stops offering the old content metafields,
   since the route no longer reads them.

A migrated page keeps its own route and address and cannot be deleted from the builder.
Converting is refused twice over: for a page with no migration, and for one already converted.

**Liquid:** the theme's page templates still read the old metafields (`page.our-story` reads
`story_block_1`, …). A migrated page's theme version does not follow builder edits until the
theme renders builder documents.

## Not yet (Phase 2)

Revision history beyond one step (a `page_revision` metaobject written at publish), scheduled
publishing, global/reusable sections, a hero with text and a button over it, video in sections,
an OG image per page, section anchors, translated documents, a redirect when a handle changes,
converting the remaining hand-built pages, and a Liquid renderer reading the same document.
