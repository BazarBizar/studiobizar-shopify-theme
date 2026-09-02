# Projects (Step 8 + S3 projects)

`/projects` and `/projects/[handle]`. Figma: `DESK - Projects Overview (View L).pdf`,
`(View M).pdf`, `DESK - Projects Detail).pdf`.

## Files

| File | Role |
|---|---|
| `app/projects/page.tsx` | Listing with category filter + L/M density |
| `app/projects/[handle]/page.tsx` | Detail, `CreativeWork` JSON-LD |
| `components/project/project-card.tsx` | One card, two densities |
| `components/project/project-controls.tsx` | Chips + view toggle, URL state |
| `components/project/project-gallery.tsx` | Lead image + lightbox |
| `lib/shopify/entities.ts` | `project`, `designer`, `captioned_image` normalisers |
| `scripts/seed-projects.ts` | 12 captioned images, 10 projects, featured items |

## Layout, measured from the PDFs

- **View L** — one project per row, full-bleed at x=0 w=1728, **5:3**, row pitch 1117
- **View M** — three across on ~556px columns (x-origins 20 / 589 / 1158), **2:3**, pitch 912
- Both: title 20px, location 16px beneath
- Filter chips at y=450 (`all · commercial · hospitality · residential`), `sort by` / `view:` at y=507
- **Detail** — full-bleed hero, title 36px, subtitle 24px, a five-row meta column
  (location / year / creative lead / collaborators / photography) beside the body at x=874, the
  gallery with its `01 / 04  VIEW GALLERY +` control, Featured Items 4-up, Other Projects 3-up

## One card, two densities

`ProjectCard` takes `view="l" | "m"` and changes only the media aspect and the heading size. The
design is otherwise identical between the two overview files, so a second component would have been
duplication.

`view` and `category` both live in the URL via `nuqs` with `shallow: false` — the brief calls out
the view toggle on this page specifically as URL state.

## Filtering happens after the fetch

`metaobjects` accepts no `query` argument (see `modules/data-layer.md`), so all projects are
fetched and the category filter and ordering run in the page. With ten projects that is the right
trade; if the count grows past a few hundred it needs revisiting.

Chips show live counts and disable themselves when a category is empty.

## The `handle:` trap

`getProductsByHandles` looked correct and returned nothing usable. The cause: **the Storefront
`products(query:)` filter has no `handle:` term, and Shopify silently ignores an unknown term**
rather than erroring — so `handle:the-tulum-chair` returned the entire catalogue, and filtering the
result by handle produced an empty list.

Replaced with `getProductsByIds`, which uses `nodes(ids:)` for an exact lookup. A `.catch(() => [])`
had been hiding the symptom; it now logs before returning empty.

## Gallery

`yet-another-react-lightbox`, loaded through `next/dynamic` with `ssr: false` so neither it nor its
stylesheet ships until someone opens the gallery. Captions and credits from `captioned_image` become
the lightbox description.

## Seeded data (S3, projects only)

10 projects across the three categories — Commercial 3, Hospitality 3, Residential 4 — plus 12
`captioned_image` entries shared between heroes, cards and galleries, and four `featured_items` per
project.

**Casa Vitro** (Ibiza) and **Sublima Comporta** — with its 2019 date, creative lead, three-line
collaborator credit and photography credit — are transcribed from the designs. The other eight
projects and **all body copy are invented**.

`related_projects` is left unset, so "Other Projects" falls back to the three next projects by sort
order rather than rendering nothing.

## Verified against the running app

```
/projects                 10 projects, sort_order respected
  chips                   all 10 · Commercial 3 · Hospitality 3 · Residential 4
  ?category=Hospitality   Sublima Comporta · The Salt Room · Hotel Marisol
  ?view=l                 5:3 cards        ?view=m  2:3 cards
/projects/sublima-comporta
  h1 / subtitle           Sublima Comporta / "A hotel that behaves like a house."
  meta rows               location · year · creative lead · collaborators · photography
  gallery                 View gallery control present
  Featured Items          The Beaded Basket · The Tulum Chair · Tulum Coffee Table · Tulum Two Seater
  Other Projects          present
  surfaces                light → black → dark → olive
  JSON-LD                 CreativeWork · genre Hospitality · Place Crete, Greece · 5 images
```

`yarn build`, `eslint`, `yarn check:price` and `yarn check:queries` all pass.

## Note on the caption position

In View L the title sits at x=30 while the image is full-bleed from x=0, which reads as an overlay
inside the image; in View M it sits at x=20, aligned to the page gutter, which reads as a caption
below. Both are rendered **below** the image for legibility and consistency. Worth confirming
against the intended design.
