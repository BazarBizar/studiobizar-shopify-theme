# Data Layer (Step 1)

Storefront API access for the whole app. Server-side only; the token never reaches the browser.

## Files

| File | Role |
|---|---|
| `lib/shopify/client.ts` | `shopifyFetch` — the only place that talks to Shopify. Imports `server-only` |
| `lib/shopify/constants.ts` | Metafield key lists, cache tags, ISR windows, sort options |
| `lib/shopify/fragments.ts` | GraphQL fragments + `withFragments` composer |
| `lib/shopify/queries/*.ts` | One module per entity: product, collection, metaobject, content, search |
| `lib/shopify/transforms.ts` | Normalisers, metafield helpers, rich-text renderer, CDN image sizing |
| `lib/shopify/types.ts` | Raw Shopify shapes and the normalised shapes the UI consumes |
| `lib/shopify/index.ts` | Public API — the data functions pages call |
| `lib/utils/cn.ts` | `clsx` + `tailwind-merge` |
| `components/providers.tsx` | TanStack Query provider, mounted in the root layout |
| `scripts/check-queries.ts` | Runs every query against the live API and normalises the result |
| `scripts/check-no-price.ts` | Fails the build if a price/inventory field appears in any query |

## The no-price rule

The brief forbids price and stock. Enforcing that in the UI would still ship the data to the
browser, so it is enforced at the query instead — no fragment requests `priceRange`,
`compareAtPriceRange`, `compareAtPrice`, `availableForSale`, `quantityAvailable`,
`totalInventory`, `currentlyNotInStock`, `quantityPriceBreaks` or `unitPrice`.

`yarn check:price` walks `lib/shopify`, `app` and `components` and exits non-zero if any appear.
Run it before committing a change to `fragments.ts`.

Sorting follows the same rule: `SORT_OPTIONS` offers relevance, newest, a–z and z–a. Shopify's
`PRICE` sort key is deliberately unreachable.

## API facts, confirmed by introspection against 2026-07

These were verified against the live schema, not assumed:

- `metaobjects(type:, first:, after:)` takes **no `query` argument** — filtering (e.g. projects by
  category) happens after fetching. Ordering uses each type's own `sort_order` field.
- `metaobject(handle:)` takes a `MetaobjectHandleInput` of `{ type, handle }`.
- `Collection.products` accepts `filters`; the root `products` query does not.
- `Collection.products` uses `ProductCollectionSortKeys`, which has `CREATED` and
  `COLLECTION_DEFAULT` but **no `CREATED_AT` and no `RELEVANCE`** — hence the separate
  `resolveCollectionSort`.
- `search(types: [PRODUCT, PAGE, ARTICLE])` — **metaobjects are not searchable**. `/search` must
  query projects and designers separately.
- `productTypes(first:)` exists and backs the Shop All category chips.
- `MetafieldReference` is a union of Article, Collection, GenericFile, MediaImage, Metaobject,
  Model3d, Page, Product, ProductVariant, Video.

## Metafields come back positionally

`metafields(identifiers: [...])` returns an array in the order asked, with `null` where a key has
no value. `toMetafieldMap()` compacts that into a keyed record, so callers use
`metafieldText(map, "colour")` rather than an index.

The same helpers exist for metaobject fields (`toFieldMap`, `fieldText`, `fieldImage`, …), since
`MetaobjectField` and `Metafield` carry the same `value` / `reference` / `references` shape.

## Rich text is JSON, not HTML

`rich_text_field` stores a JSON AST. `richTextToHtml()` renders root, paragraph, heading, list,
list-item, link and text nodes, applies bold/italic, and escapes every text value. Unparseable
input falls back to an escaped paragraph rather than throwing.

## Reference nesting

References resolve two levels deep, which is what the designs need and no more:

```
project.gallery → captioned_image (Metaobject) → image (MediaImage) → Image
```

`RefParts` covers the top level; `MetaobjectLeafParts` covers a nested metaobject, whose own
fields resolve only to `LeafRefParts` (MediaImage / GenericFile). This terminates the recursion.

## Images

Vercel's optimizer is off, so `cdnImage(url, width)` appends Shopify's own `?width=` transform,
preserving the existing `?v=` cache-buster. Product card media is 4:5 — pass `415` for grid cards.

## Caching

`shopifyFetch` uses `next: { revalidate, tags }`. Tags are `products`, `collections`,
`metaobjects` and `content`, so a webhook can revalidate one entity class. Windows: products 15m,
collections and metaobjects 30m, content 1h. `predictiveSearch` passes `revalidate: false` — an
instant-search response must match the query typed, never a cached neighbour.

## Verification

```bash
yarn check:queries   # 13 queries + 8 normaliser assertions, against the live store
yarn check:price     # no price/inventory field anywhere
yarn build
```

All pass as of Step 1. `check:queries` confirmed against product `basket-015`: 10 images,
1 variant, SKU `BAPI015NBr`, metafield map populated, CDN resize applied, no price in the payload.

## Known state

`getProductRecommendations` returns empty — Shopify derives it from order history and this store
has none. `getMetaobjects` returns empty for every type because no entries exist yet (see
[`00-overview.md`](../00-overview.md)). Both are data gaps, not code faults.

## Note on `tsconfig.json`

`inquiry-pdf.ts` and `schema-push` are excluded from type-checking. The former is the reference
PDF generator that still imports modules which do not exist yet; the exclusion is removed in
Step 6 when it moves to `lib/pdf/inquiry-pdf.ts`.
