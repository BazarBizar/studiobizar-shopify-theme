# Menus

Admin: **Website → Menus** (`/admin/menus`). Shopify's navigation menus, edited as in Shopify's own
admin — and read natively by the Liquid theme.

## What an editor can do

- **The site's own five** (`lib/navigation.ts`: Main menu, Second menu, Footer — About / Info /
  Legal): edit their links. They keep their handle and cannot be emptied or deleted — the header and
  footer ask for them by handle and would fall back to `FALLBACK_NAV` without saying so.
- **Create menu** (name → handle, editable): an empty menu, opened in its editor. Shown wherever a
  Menu element in **Appearance** is set to it (the element offers every menu — `menuChoices`). It can
  be renamed, given another handle, and deleted — while no Theme Builder layout (published or draft)
  shows it; the editor says so and links to Appearance.
- **Links, three levels deep** (Shopify's limit). Drag a link to move it; drag it right to put it
  under the link above, left to take it out — its own links travel with it. The ⋯ menu does the same
  from the keyboard: Move up / down / in / out, Add a link under it, Remove.
- **Add menu item / Edit** — one dialog: the **link**, the **label** (follows the choice until
  typed), and for a collection **Filter by tags** (existing tags offered; all must match).
- **The link picker** (`components/admin/menus-table/link-picker.tsx`) is Shopify's: Home, Search,
  then folders, each with how many it holds — **Collections** (with All collections), **Products**
  (with All products; EVERY active product, fifty at a time as the list scrolls — `useProductPages` —
  with their photos, searched on the server as you type), **Pages**, **Product types**, **Vendors**,
  **Designers**, **Projects** (the metaobjects with a web page of their own), **Policies**,
  **Customer account** — and **Web address**. Each folder opens to its own searchable list (Backspace
  in an empty search goes back); typing at the top searches every folder at once, with "Every product matching …" into the
  Products folder. A choice shows as
  "Collections › The Atlas Collection", in the dialog and in the tree. Blogs are left out: neither
  storefront has a blog page yet.

## How it is stored

Shopify's menus, through `menuCreate` / `menuUpdate` / `menuDelete` (`lib/admin/menus.ts`).
`menuUpdate` REPLACES the tree, so the editor always sends all of it. Shopify has no item type for a
product type or a vendor; like its own admin, they are web links to `/collections/types?q=…` and
`/collections/vendors?q=…` (`writeDestination` / `readDestination` in `lib/admin/menu-tree.ts`). A
collection's tags are the item's `tags`.

## On the site

| | Next (`components/layout/`) | Liquid (`theme/`) |
|---|---|---|
| Dropdown — links under a link | `MenuDropdown` | `snippets/sb-menu-dropdown.liquid` |
| **Mega menu** — a third level anywhere under it: a panel the width of the header, each second-level link a column | `MenuDropdown` (`isMegaMenu`) | same snippet |
| Phone drawer — every level opens in place, with "All …" unless a link inside goes there | `mobile-nav.tsx` (`DrawerList`) | `snippets/sb-drawer-list.liquid` |
| Product type / vendor | `/shop?type=` / `?vendor=` | `/collections/types?q=` (Shopify) |
| Collection filtered by tag | `/shop?view=collection&collection=…&tag=…` | `/collections/<handle>/<tag>` (Shopify), with "Showing …" |
| Designer / project | `/designers/<handle>`, `/projects/<handle>` | `/pages/designers/<handle>` (Shopify, `templates/metaobject/`) |

The Next mapping is `shopifyUrlToRoute` (`lib/routes.ts`) and `normalizeMenuItem`; the filter is
`lib/shopify/catalogue-filter.ts`, read by `/shop` and `/api/products`. An absolute url to another
website stays as it is (it used to lose its domain).

The original header shows dropdowns on both rows; the Theme Builder's menu element shows them when
*Show sub-links in a dropdown* is on (now on by default for the main menu).

## Checks

- `yarn check:menus` — addresses, the filter, destinations, and every tree change (incl. the
  three-level limit).
- `npx tsx --conditions=react-server scripts/check-admin-operations.ts` — the menu documents against
  Shopify; `menuCreate` with a blank title and `menuDelete` with id 0, so nothing changes.
