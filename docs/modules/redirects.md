# Redirects

Admin: **Website → Redirects** (`/admin/redirects`). Old addresses that send visitors on to new
ones, so links in emails, on Google and on other websites keep working.

## Where redirects come from

1. **Automatically.** Changing the address (handle) of a page, product or collection in this admin
   sends `redirectNewHandle: true`, so Shopify adds a redirect from the old address.
2. **By hand** on the Redirects screen: old address + a page from the list, or a typed address
   (a product, or another website over https).
3. **Shopify's own** URL redirects (Online Store → Navigation → URL redirects) — it is the same list.
4. **Built in:** Shopify's addresses `/products/x`, `/pages/x`, `/policies/x` have no route on this
   site and always go to the route that shows the same thing (`/shop/x`, …) — links from the Liquid
   theme's days keep working.

Shopify stores its own paths (`/products/old` → `/products/new`); every redirect is read through
`shopifyUrlToRoute`, so it answers on `/shop/old` too and sends to `/shop/new`.

## How they are followed

`proxy.ts`, storefront branch: GET/HEAD page addresses only (no files, no `/api`, never the panel).
A match is a **308** (permanent — Google moves the ranking over); the visitor's query string is kept
unless the destination has one. The branch never touches headers otherwise, so static pages stay
static.

`lib/redirect-map.ts` holds the list in memory per server: loaded from the Admin API at most once a
minute, the first request waits at most 1.5 s for it, a failed load keeps the last list. **A saved
redirect works within about a minute.** Up to 5,000 redirects; past that, see Next's guide on
redirects at scale (Bloom filter).

## Redirects never hide a page

The proxy follows a redirect whether or not something lives at the old address, so:

- adding a redirect FROM an address that still shows a page, product, collection, project, designer
  or one of the site's own routes is refused, with what is there (`liveAddress`);
- when something new takes an address — a page, product or collection created or given that handle
  in this admin — redirects from it are deleted (`releaseAddress`);
- the same old address twice, an address onto itself, and two redirects pointing at each other are
  refused.

## Files

| File | Role |
|---|---|
| `lib/redirects.ts` | Normalising, Shopify ↔ site paths, the map, validation (shared) |
| `lib/redirect-map.ts` | The proxy's cached list |
| `lib/admin/redirects.ts` | List, create, delete, `liveAddress`, `releaseAddress` |
| `app/api/admin/redirects/route.ts` | `redirectCreate`, `redirectDelete` |
| `components/admin/redirects/redirects-screen.tsx` | The screen |

## Checks

- `yarn check:redirects` — logic, and the proxy's query against the store (read only).
- `CHECK_BASE_URL=http://localhost:3000 yarn check:redirects --ui` — real 308s from `yarn dev`, pages,
  files and the panel untouched, the screen's refusals. Creates nothing.
- `yarn check:admin-ops` covers the four operations.
