# Shop Detail (Step 4)

`/shop/[handle]` — the product page. Figma: `DESK - Shop Detail.pdf`.

## Files

| File | Role |
|---|---|
| `app/shop/[handle]/page.tsx` | Server Component; metadata + JSON-LD + all sections |
| `app/shop/[handle]/loading.tsx` | Skeleton |
| `app/shop/[handle]/not-found.tsx` | Branded 404 for a missing handle |
| `components/product/product-gallery.tsx` | Client; thumbnail rail + main image |
| `components/product/add-to-inquiry.tsx` | Client; qty stepper + `enquire` |
| `components/product/product-rail.tsx` | "The Collection" and "Discover More" |
| `components/sections/media-text.tsx` | The Idea / The Designer — reused later by Our Story |
| `components/ui/accordion.tsx` | Native `<details>` disclosure |
| `store/inquiry-cart.ts` | Zustand + `persist` (see below) |
| `components/inquiry/inquiry-list.tsx` | Review list on `/inquiry` |

## Layout, measured from the PDF

- Thumbnail rail x=98, each 61×49; main image x=175 y=277, **691×864 = 4:5**
- Info column starts at **x=1011**, ~557 wide
- Breadcrumb 14px · title 36px · byline 24px (`by {name}, {studio}`) · description 18px
- Spec rows: label x=1011, value x=1152 — Material/Finish, Colour, Upholstery, Availability
- `Price on request` 16px, then the buy row at y=852: qty stepper 133×48, `enquire` 372×48
- Both buy controls are **outlined**, not filled — the boxes are drawn as stroked rectangles with
  dark text on the earth ground
- Five accordions at a 49px pitch
- The Idea: image **left** (x=202, 751×1126), copy right
- The Designer: copy left, image **right** (x=918, 619×728) — the block alternates
- Two 4-up rails using the same grid as Shop All

## Sections degrade instead of emptying

Every block below the buy controls reads a product metafield, and **17 of the 18 are unpopulated**.
Rather than render empty headings, each section is filtered out when its source is missing:

| Section | Source | Renders today |
|---|---|---|
| Spec rows | `material_finish`, `colour`, `upholstery`, `availability` | only Colour |
| Accordions | `technical_specifications`, `dimensions`, `care_maintenance`, `shipping_delivery` | none |
| Downloads | `downloads` | none |
| The Idea | `idea_body` + `idea_image` | none |
| The Designer | `designer` → metaobject | none (no entries) |
| The Collection | `signature_collection` | none |
| Discover More | recommendations, else same `productType` | **yes** |
| MOQ / lead time | `moq`, `lead_time_weeks` | none |

`Discover More` needed a fallback: Shopify derives `productRecommendations` from order history and
this store has none, so it falls back to other products of the same `productType`.

## The inquiry cart landed here, not in Step 5

The plan put the Zustand store in Step 5. Building it there would have shipped a product page whose
primary call to action did nothing, so the store, the working `enquire` button, the header badge and
a minimal `/inquiry` review list are in this step instead.

**Step 5 now covers** the drawer, the contact form, and `POST /api/inquiry` (metaobject + PDF +
email). Nothing is dead in the meantime.

Two details worth keeping:

- **`hydrated` flag.** The server cannot know what is in `localStorage`, so the badge and the review
  list render a neutral state until rehydration finishes. It is set through `set()` inside
  `onRehydrateStorage` — mutating the draft there updates the value without notifying a single
  subscriber, which leaves the UI stuck on skeletons.
- **`partialize`.** Only `items` is persisted. Storing `hydrated` would restore it as `true` before
  rehydration actually ran.

## A missing product returns 200, and that is correct

`notFound()` fires for an unknown handle, but the response is a `200`. That is this Next version's
documented behaviour: the route streams (it has a `loading.tsx`), headers are already sent, and the
status can no longer change. Next injects `<meta name="robots" content="noindex">` into the streamed
HTML instead, which is what keeps it out of the index.

Verified: the missing product carries `noindex`, a real product carries no robots meta.

If a hard 404 status is ever needed for compliance or analytics, the docs point at checking the
handle in `proxy` before the body streams.

## SEO

- `generateMetadata` — title, description, canonical, Open Graph, from `product.seo` with the
  description as fallback
- **`Product` JSON-LD with no `offers`, no `price`, no `availability`** — verified in the rendered
  HTML. Carries name, description, images, sku, brand and category only.

## Verification

| Check | Result |
|---|---|
| `/shop/the-huge-pouffe-natural` | 200, h1 + breadcrumb `products › pouffes` |
| Gallery | 10 thumbnails, 4:5 main image |
| Buy row | Price on request + qty stepper + enquire all present |
| JSON-LD | `@type: Product`, sku `VIVT020N-XL-100`, 10 images, **`offers` absent** |
| Missing handle | branded 404 UI + `noindex` |
| Price/stock in HTML | none |
| Cart logic | 14/14 assertions — merge on re-add, qty cap, remove at 0, only `items` persisted |
| `yarn build`, `eslint`, `yarn check:price` | pass |

## Open

- **Colourway swatches.** The design shows three 112×90 image swatches plus a `+` box at y=538. No
  product has more than one variant, so this is almost certainly a row of sibling colourways
  (e.g. "The Beaded Basket – Gold" / "– Black" are separate products) — but there is no grouping key
  in the data to build it from. Not implemented; needs a decision on how colourways are linked.
- **Breadcrumb second level** uses `productType`. The design reads `products > lounge chairs & sofas`,
  which is a category label, so this should follow whatever `lib/shopify/categories.ts` settles on.
