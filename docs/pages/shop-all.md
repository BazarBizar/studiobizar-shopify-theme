# Shop All (Step 3)

`/shop` — the product catalogue. Figma: `DESK - Shop All.pdf`.

## Files

| File | Role |
|---|---|
| `app/shop/page.tsx` | Server Component; renders the first page of results |
| `app/shop/loading.tsx` | Skeleton matching the real layout |
| `app/api/products/route.ts` | Serves pages 2+ for infinite scroll |
| `components/shop/shop-controls.tsx` | Client; category chips, sort, view — all URL state |
| `components/shop/product-grid.tsx` | Client; infinite scroll + Load more |
| `components/product/product-card.tsx` | `sb-card-product` |
| `components/ui/skeleton.tsx` | `Skeleton`, `ProductCardSkeleton` |
| `lib/shopify/categories.ts` | Chip → `productType` mapping |

## Layout, measured from the PDF

- Title `Products` at 36px, x=19, y=172
- Intro paragraph 18px, eight lines
- Category chips 16px on two rows, y=421 and y=457
- `sort by` at x=19 and `view: by type / by collection` at x=1424, y=514
- Grid: 4 columns of 415px on a 10px gap, x-origins 20 / 445 / 869 / 1294
- Card media 4:5, `new` flag inset ~14px top-left, title 16px, collection label 14px

## Categories — needs your confirmation

The store has **63 flat `productType` values and no category collections**, so chips filter with a
Storefront query (`product_type:"Dining Tables" OR product_type:"Dining Chairs"`) rather than a
collection lookup. Verified working against the live API, ampersands in type names included.
Switching to real Shopify collections later means changing `lib/shopify/categories.ts` and nothing
else.

**Two things are unconfirmed:**

1. **Some chip labels are unreadable in the PDF.** That row is set in a font whose embedded
   ToUnicode table is a 49-glyph subset covering only the header nav, so `d`, `c`, `h`, `m`, `u`
   and `&` decode to nothing on that row specifically — the extracted text reads
   `"ining tables a…irs"`. Confident: *dining tables & chairs*, *bar tables & chairs*,
   *side tables*, *lamps*, *consoles*. Reconstructed: *office furniture*,
   *dressers, cabinets & consoles*, and one chip at x=801 that decodes only as `"bes"`.
2. **The grouping is mine.** The design's ~9 chips are furniture-led, but the catalogue is mostly
   homeware — the design's chips alone would hide most of the 1,595 products. The 11 groups in
   `categories.ts` cover the whole catalogue so nothing is unreachable.

## URL state (`nuqs`)

| Param | Values | Notes |
|---|---|---|
| `category` | a slug from `CATEGORIES` | absent = all |
| `sort` | `newest` (default) · `a-z` · `z-a` | no price sort, by design |
| `view` | `type` · `collection` | in the design; grouping lands with collections (Step 7) |

`shallow: false`, so changing a filter re-runs the Server Component and the first page of results
arrives in the HTML. The grid is keyed on category+sort so switching starts a clean list rather
than appending to the old one.

## Infinite scroll

`useInfiniteQuery` with an `IntersectionObserver` at a 600px root margin, plus a real **Load more**
button — that button is the keyboard path, not just a fallback. `initialData` is seeded with the
server's first page so no duplicate request fires on mount. Skeleton cards fill in while the next
page loads, and a failed page swaps the button for a retry.

## No price, no stock

`ProductCard` receives only `id`, `handle`, `title`, `image`, `isNew`, `collectionLabel` — the
normaliser has nothing else to give it. Confirmed against the rendered HTML: no `price`, `amount`,
`currencyCode`, `availableForSale` or `quantityAvailable` anywhere. Sort offers no price option
because `SORT_OPTIONS` does not contain one.

## Verification

Against the running dev server:

| Check | Result |
|---|---|
| `/shop`, `?category=`, `?sort=`, combined | all 200 |
| Cards per page | 24 (`PRODUCTS_PER_PAGE`) |
| `?category=lighting` | returns lamps and On Stand only |
| `?category=dining-tables-chairs` | returns dining chairs and tables only |
| `sort=a-z` / `z-a` / `newest` | "Basket 015" / "The Zuri Pendant" / "The Beaded Basket" |

**`relevance` was removed after this table was written.** It was the default, and it
never paginated: `RELEVANCE` is only defined inside a search context, so walking the
catalogue 24 at a time returned 192 of 1,595 products with 144 duplicates, stopping at
page 15 of 67. The row above is why it went unnoticed — the three keys that were verified
are the three that work. `newest`, `a-z` and `z-a` each return all 1,595 in 67 pages.
`search()` still sorts by RELEVANCE, correctly, and does not go through `resolveSort`.
| Cursor pagination | page 2 has **0 overlap** with page 1, continues alphabetically |
| Price/stock in HTML | none |
| `yarn build`, `eslint`, `yarn check:price` | pass |

## Deliberately incomplete

- **Intro copy** — the design shows a paragraph under the title. Its source would be a Shopify page
  with handle `shop`, which does not exist. The block is omitted rather than filled with
  placeholder text; add the page in S2 and it appears.
- **`new` flag** — wired to `custom.is_new`, which is unset on every product, so no badge renders
  yet. Data gap, not a code gap.
- **`view=collection`** — the toggle is in the URL and the design, but grouping by collection needs
  collections to exist (Step 7 / S1).
- **Collection label** — reads `custom.collection_label`, also unpopulated.
