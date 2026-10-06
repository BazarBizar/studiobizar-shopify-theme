# Page builder (MVP-1)

Lets staff build **new** pages in `/admin` from the storefront's existing sections, with a draft,
a live preview and a publish step. A layer on top of the storefront, not a second one: every
section renders through a component the hand-built pages already use.

MVP-1 covers new pages only. Pages whose layout is code (`/`, `/our-story`, …) are untouched
and cannot be opened in the builder yet — converting them is MVP-2.

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

## Files

| Path | Role |
|---|---|
| `lib/page-builder/fields.ts` | field vocabulary, value shapes, per-field Zod, `isSafeHref` |
| `lib/page-builder/define-section.ts` | `defineSection()` + the universal settings (surface, rhythm, hideOn) |
| `lib/page-builder/sections.ts` | the section definitions |
| `lib/page-builder/registry.ts` | `SECTIONS` — the single list of what exists |
| `lib/page-builder/document.ts` | document types, strict write schema, lenient `parsePageDocument` |
| `lib/page-builder/templates.ts` | starting layouts for a new page |
| `lib/page-builder/handles.ts` | which handles `/<handle>` may use |
| `components/page-builder/renderers.tsx` | type → data loader + existing component |
| `components/page-builder/section-renderer.tsx` | draws a document; one section failing costs that section |
| `components/page-builder/builder-page.tsx` | shell + sections; fallback for an unreadable document |
| `app/(storefront)/[handle]/page.tsx` | the public route |
| `app/(admin)/preview/pages/[id]/page.tsx` | the draft, rendered by the same `BuilderPage` |
| `lib/admin/page-builder.ts` | read / save / publish / discard / rollback / create / delete |
| `app/api/admin/pages/{builder,create,delete}/route.ts` | the write endpoints |
| `components/admin/page-builder/*` | the editor |

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
3. Add its renderer to `RENDERERS` in `components/page-builder/renderers.tsx` — `load` with an
   existing `lib/shopify` function if it needs data, `render` with an existing component.
   The map is typed against the registry, so skipping this step fails the build.

Never add a field kind that accepts free CSS, HTML or a class name. Options are enums.

## Flow

```
edit ──1.2s──▶ save draft (revision n → n+1) ──▶ preview router.refresh()
publish ──▶ one pageUpdate: previous ← live, live ← draft, SEO → global.title_tag/description_tag
       ──▶ revalidateTag("content")
       ──▶ after(): poll the Storefront API until it serves this publishedAt ──▶ revalidateTag again
```

**Why publish revalidates twice.** The Storefront API keeps serving its cached response for
21–29 seconds after an Admin write (measured on this store) — for a changed document, and for a
page that was looked up while still hidden. Dropping Next's cache only at the moment of publishing
refills it from that stale response for the full ISR hour. The second drop, once Shopify serves the
new `publishedAt`, is what makes a publish reliably visible within about half a minute. Delete does
the same, waiting until Shopify stops serving the page.

The generic page/metaobject edits elsewhere in the panel revalidate once, at write time, and are
exposed to the same window; that predates the builder and is not changed by it.

- A save names the revision it was made from; a stale one is refused with `CONFLICT`.
- Drafts may be incomplete. Publish refuses while a visible section has an empty required field.
- First publish also makes the page visible. After that visibility is set on the page screen.
- Rollback swaps live and previous, so a second rollback is a redo.

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
```

## Not yet (Phase 2)

Undo/redo (the reducer is pure, so it is a state stack), revision history beyond one step
(a `page_revision` metaobject written at publish), scheduled publishing, global/reusable sections,
converting the existing hand-built pages (MVP-2), and a Liquid renderer reading the same
document.
