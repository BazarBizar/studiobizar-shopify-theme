# Gallery (Step 10)

`/gallery`. Figma: `DESK - Gallery.pdf`.

## The design file is a component spec, not a page

This was flagged as an open question from the start, and the geometry settles it. The file contains
**four identical 1404×944 panels** on an off-black `#1D1D1B` ground, each with one image centred and
letterboxed inside it, and each overlaid with `01 / 04` bottom-left and `VIEW GALLERY +`
bottom-right.

Two things give it away:

1. **There is no header and no footer**, and the frame is 1444px wide rather than the 1728px every
   other design uses.
2. **The counter and control are drawn in `#9747FF`** — Figma's annotation purple. On
   `DESK - Projects Detail).pdf` the identical control is drawn in `#EBE8E3`, i.e. as real content.

So the file documents **the lightbox** that `VIEW GALLERY` opens, not a `/gallery` route.

The brief's page map does list `/gallery` as a route, so both were built: the viewer to match the
spec, and a gallery page that opens it.

## Files

| File | Role |
|---|---|
| `components/ui/lightbox.tsx` | The viewer from the spec — shared |
| `components/gallery/gallery-grid.tsx` | Masonry grid, opens the viewer at a given index |
| `app/gallery/page.tsx` | The page |
| `components/project/project-gallery.tsx` | Refactored onto the shared viewer |
| `scripts/seed-pages.ts` | Creates the `gallery` page and attaches its images |

## The viewer

`yet-another-react-lightbox` with the Counter and Captions plugins. Ground is `#1D1D1B` at 96%,
the measured colour; the counter is moved to bottom-left to match the spec; the caption and credit
from `captioned_image` become the description.

It is loaded through `next/dynamic` with `ssr: false`, so neither the library nor its three
stylesheets ship until someone opens it.

Projects Detail now uses the same component. Its overlay control keeps the measured positions —
counter at x=179 and `VIEW GALLERY +` at x=1416 on the 1728 frame, in earth.

## The page

Masonry via `react-masonry-css` (3 / 2 / 1 columns), so photographs keep their own proportions
instead of being cropped to a shared ratio — this is the one page where the photography is the
subject rather than a product. `sb-masonry` and `sb-masonry-column` are utilities in `globals.css`
because the library only supplies class names, not styles.

Images come from the **`custom.gallery` PAGE metafield** on the `gallery` page, a list of
`captioned_image` — the same metaobject the project galleries use, so a photograph is described once
and reused.

## Seeding

`yarn seed:pages` creates the `gallery` page and attaches the 12 `captioned_image` entries from
`seed-projects`.

**Pages are not `Publishable`.** `publishablePublish` rejects a Page gid outright
(`Invalid id: gid://shopify/Page/…`) — unlike collections, which silently need it. Pages publish
through `isPublished` on `PageCreateInput` instead. Worth remembering: the two resource types look
similar and behave differently.

## Verified against the running app

```
/gallery
  h1        Gallery
  intro     from the page body
  tiles     12, each opening the viewer at its own index
  captions  "The lounge, looking west at dusk" · "Guest room, morning light" · …
  masonry   sb-masonry present
  surface   light → black → olive
/projects/casa-vitro
  overlay   01 / 04 · View gallery — still correct after the refactor
```

`yarn build`, `eslint` and `yarn check:price` pass; the masonry utilities compile.

## Note

The spec shows four panels because the project it illustrates has four images. The count is not
fixed — the counter reads the actual set length.
