# Designers (Step 9)

`/designers` and `/designers/[handle]`. Figma: `DESK - Our Designers.pdf`,
`DESK - Our Designers Detail.pdf`.

## Files

| File | Role |
|---|---|
| `app/designers/page.tsx` | The 4-up grid |
| `app/designers/[handle]/page.tsx` | Portrait, bio, `Person` JSON-LD |
| `components/designer/designer-card.tsx` | Portrait + name |
| `lib/shopify/entities.ts` | `normalizeDesigner` |
| `lib/shopify/index.ts` | `getProductsByDesigner` |

## Layout, measured from the PDFs

- **List** — 4 columns with a row pitch of **496**, identical to Shop All, so the card reuses the
  same 4:5 media. Names at 16px beneath. Ground is **mocha** (`#521011`), as measured.
- **Detail** — portrait at x=191, **619×728**, with the name at x=932 at 24px beside it; then
  `Designed by …` and the 4-up product grid at the usual x-origins; then `go back`.

## Finding a designer's products

There is no direct route from a designer to their products, and the obvious one does not work.
`custom.designer` is a product metafield, but **the Storefront `products(query:)` filter cannot
match metafields** — tested against the live API:

| Query | Result |
|---|---|
| `metafields.custom.designer:<gid>` | 0 products |
| `metafield:custom.designer:<gid>` | 5 products, **none of which match** — the term is ignored |
| `designer:<gid>` | 0 products |

None of the three errors. The second is the dangerous one: it returns the unfiltered catalogue and
looks like a result. This is the same class of trap as `handle:` on the projects page.

`getProductsByDesigner` therefore goes through the collections that credit the designer
(`collection.custom.designer`), de-duplicating products that appear in more than one. Exact, and it
matches how the products were attributed in the first place.

## A data consequence worth knowing

Only 4 of the 10 seeded designers are credited on a collection, so the other six render **no
products** and no collections line. That is correct behaviour against the current data, not a bug —
`Altin` verifies it. Attribute more collections, or set `custom.designer` per product and add a
direct lookup, and the rest fill in.

## Verified against the running app

```
/designers                 10 designers in sort_order, mocha ground
/designers/eddy-roothaert
  h1 / byline              Eddy Roothaert / "The long view on materials"
  collections              The Duna Collection
  heading                  Designed by Eddy Roothaert
  products                 8
  JSON-LD                  Person · Eddy Roothaert · worksFor Studio Bizar
/designers/altin           0 products, collections line hidden — no collection credits them
/designers/nope            branded 404
```

`yarn build`, `eslint` and `yarn check:price` pass.

## Note

The design's grid is 4×4 = 16 designers; ten are seeded. The layout reflows without change.
