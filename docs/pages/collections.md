# Collections (Step 7)

`/collections` and `/collections/[handle]`. Figma: `DESK - Collections All.pdf`,
`DESK - Collections Detail.pdf`.

## Files

| File | Role |
|---|---|
| `app/collections/page.tsx` | The list |
| `app/collections/[handle]/page.tsx` | The detail |
| `app/collections/loading.tsx`, `[handle]/loading.tsx` | Skeletons |
| `app/collections/[handle]/not-found.tsx` | Branded 404 |
| `components/collection/collection-card.tsx` | Card with wordmark overlay |
| `components/sections/contact-cta.tsx` | Closing block, shared by 6 pages |
| `components/ui/go-back.tsx` | The `go back` control, shared by detail pages |

## Layout, measured from the PDFs

**Collections All** — the same 4-column grid as products (card x-origins 20 / 445 / 869 / 1294),
but on **3:5 media** rather than 4:5. Media at y=461, height ~694, row pitch 768. The wordmark is
centred on the image (measured at 40/44/64px, varying per collection because each is a supplied
logo), with the title at 16px and the designer byline at 14px beneath.

**Collections Detail** — a full-bleed hero with the wordmark at **128px**, then The Idea (image
left) and The Designer (text left, image right) alternating exactly as on Shop Detail, the
collection title at 36px, the product grid, `In Context` projects 3-up at x 20 / 589 / 1158, the
contact block and `go back`.

## Wordmark

The design shows a supplied logo per collection — `custom.hero_logo`. None is seeded, so the card
and the hero typeset the collection name instead, stripped of its framing words:
*"The Arc Teak Collection"* → **ARC TEAK**. When a `hero_logo` is uploaded, the image is used and
nothing else changes.

This is why `text-display` (64px) and `text-display-lg` (128px) exist in the token set — they were
measured off these two pages.

## Reuse rather than a second grid

`/api/products` now accepts `collection=<handle>` and pages through the collection instead of the
whole catalogue, so the detail page reuses the same `ProductGrid` — infinite scroll, Load more,
skeletons and error retry — that Shop All uses. Note the collection path goes through
`resolveCollectionSort`, because `Collection.products` takes a different sort-key enum with no
`CREATED_AT` and no `RELEVANCE`.

`MediaText` came from Shop Detail unchanged; The Idea and The Designer are the same block on both
pages.

## `frontpage` is hidden

Shopify auto-creates a "Home page" collection for the Liquid theme. It is not a real collection and
is filtered out of the listing by handle. Ordering is `sort_order` first (curated), then
alphabetical for anything without one.

## Sections hide when their data is missing

`In Context` reads `custom.in_context_projects`, which points at the `project` metaobject — unseeded,
so the section does not render. The Idea and The Designer likewise hide without their metafields.

## Verified against the running app

```
/collections            Duna · Safari · Hardy · Arc Teak
  bylines               by Eddy Roothaert, Studio Bizar · by Pascale Pelsmaekers, Studio Bizar …
/collections/the-arc-teak-collection
  hero wordmark         Arc Teak (display-lg)
  sections              The Idea | The Designer
  product cards         12
  surfaces              light → light → dark (hero) → olive (footer)
  In Context            hidden, no projects seeded
  learn more · contact us · go back   all present
/api/products?collection=the-duna-collection
  12 items, hasNext false, every item labelled “Part of ‘The Duna Collection’”
/collections/nope       branded 404 + noindex
```

`yarn build`, `eslint` and `yarn check:price` pass.

## Deliberately omitted

**The `sort by` / `view: by type | by collection` control row** at y=437 on Collections All. With
four curated collections a sort control is noise, and `by type / by collection` duplicates the
toggle already on Shop All. Worth adding if the collection count grows — the design implies twelve.

## Note

`GoBack` renders a real `<Link>` and intercepts the click to call `router.back()` only when history
exists. That keeps it working without JavaScript, keeps SSR and client markup identical, and returns
the visitor to the filtered listing they actually came from.
