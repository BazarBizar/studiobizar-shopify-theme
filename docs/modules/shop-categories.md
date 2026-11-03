# Shop categories

Admin: **Content → Shop categories** (`/admin/shop-categories`). The chips above the grid on
`/shop` ("by type"). Before this screen they were a list in code.

## What an editor can do

- Rename, reorder (drag, or ↑ ↓), add and remove categories — at most 40.
- Pick each category's product types from every type in the store (search, tick). A type that is
  already in another category says so ("in lamps"); a type may sit in more than one.
- **Product types in no category** are listed at the top, each with **Add to…** (an existing
  category, or a new one named after the type). Their products are otherwise only reachable under
  "all". This is what a new product type created in Shopify shows up as.
- A type no product has any more is marked with a warning and can be removed.
- Save is refused while a category has no name or no product types, with the reason under it.
- Removing a category has Undo; Discard throws away everything unsaved.

## How it is kept

| | |
|---|---|
| Where | Shop metafield `custom.shop_categories`, json `{ version: 1, categories: [{ slug, label, types }], savedAt, savedBy }` |
| Before the first save | Nothing stored; the storefront draws `DEFAULT_CATEGORIES` (`lib/shopify/categories.ts`), which is what the site always showed |
| Definition | Created by the admin's first save if missing (`PUBLIC_READ`, so the Storefront API can read it). Also in `schema-push` |
| Conflicts | A save names the `compareDigest` it was edited from; someone else's save in between → "Reload" |
| Addresses | `?category=<slug>`. The slug is made from the name on first save and kept on rename, so shared links keep working; never shared between two categories |
| Unreadable value | The storefront falls back to `DEFAULT_CATEGORIES` and logs it |
| Cache | Save drops `content` now and again once the Storefront API has caught up (`revalidateForType("shop_categories")`) |

Next only — the Liquid theme has no Shop All page.

## Files

| File | Role |
|---|---|
| `lib/shopify/categories.ts` | Type, defaults, parsing, slugs, the search query |
| `lib/shopify/index.ts` `getShopCategories()` | Storefront read |
| `lib/admin/shop-categories.ts` | Admin read and save, definition |
| `app/api/admin/shop-categories/route.ts` | `shopCategoriesSave` |
| `components/admin/shop-categories/shop-categories-editor.tsx` | The screen |

## Checks

- `yarn check:shop-categories` — slugs, parsing, query escaping.
- `CHECK_BASE_URL=http://localhost:3000 yarn check:shop-categories --ui` — the screen and `/shop`
  in Chromium. Never saves (a save would change the live Shop page).
- `yarn check:admin-ops`, `yarn check:queries` include the new documents.
