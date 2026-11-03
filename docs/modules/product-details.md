# Product details

Admin: **Content → Product details** (`/admin/product-details`). Which product fields every product
page shows, in what order and under what name:

- **Facts beside the product** — short rows under the description ("Material / Finish — Oak").
- **Fold-out panels** — longer text under the enquire button.

What each says is filled in per product under **Products**. A product without a value skips the
row or panel.

## What an editor can do

- Rename, reorder (↑ ↓), remove (with Undo) facts and panels.
- **Add** one from a product field that exists, or **"A new field…"**: the PRODUCT metafield
  definition (`custom.<key>`, one line for a fact, formatted text for a panel, `PUBLIC_READ`) is
  created at once, and the product form shows it straight away (it builds itself from the
  definitions). Press Save to put it on the product page.
- `availability` keeps the lead time beside it, under whatever label it is given.

## How it is kept

| | |
|---|---|
| Where | Shop metafield `custom.product_details`, json `{ version: 1, rows: [{ key, label }], panels: [...], savedAt, savedBy }` |
| Before the first save | Nothing stored; `DEFAULT_PRODUCT_DETAILS` = the page as built (4 facts, 4 panels) |
| Save | Only fields that exist and fit (facts: single/multi-line text; panels: rich text/multi-line) |
| Next | `getProduct` fetches fields beyond `PRODUCT_DETAIL_METAFIELDS` through `$details`; the page draws `getProductDetails()` |
| Liquid | `sb-main-product` loops `shop.metafields.custom.product_details.value`; without it, the fixed rows with labels from the theme's translations |
| Cache | Save drops `content` and `products` |

"Downloads" stays a Site text.

## Checks

- `yarn check:product-details` — logic, and the facts/panels blocks cut from `sb-main-product.liquid`
  rendered with liquidjs, with and without a saved list.
- `--ui` — the screen in Chromium. Never saves, never creates a field.
