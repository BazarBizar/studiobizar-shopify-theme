# Studio Bizar Headless Storefront — Overview

Next.js (App Router) + Shopify Storefront API. Shopify is a **catalogue and CMS only**: no price,
no stock, no cart, no checkout, no customer accounts. Users collect products into a client-side
**inquiry cart** and submit an inquiry.

Full plan with tables: <https://claude.ai/code/artifact/0db9831e-1f1e-4ac5-97c3-699f512ccdb5>

## Store state — verified live, not assumed

Checked against the Shopify Admin and Storefront APIs.

**Ready**

- **1,595 active products** reachable via the Storefront API, all with Shopify CDN images, all
  single-variant. 432 more are `DRAFT` and therefore invisible to the storefront.
- **63 distinct `productType` values** (Pendant Lamps 208, Baskets 111, Mirrors 73, …). Vendor is
  "Studio Bizar" on 1,594 of them.
- **Schema fully provisioned** by `schema-push`: 5 metaobject definitions, 36 metafield
  definitions (18 PRODUCT / 10 COLLECTION / 8 PAGE), 11 pages, 5 menus. `node index.js verify`
  reports OK on everything.

**Blocked on content**

- **All metaobjects are empty** — `designer`, `project`, `captioned_image`, `contact_channel`,
  `faq_item`, `service` have zero entries. Projects, Designers, Gallery, Services and Contact have
  nothing to render. (`inquiry` is written by the storefront, not seeded content.)
- **Product metafields are 1-of-18 filled** — only `custom.colour`. The lower half of Shop Detail
  (specs, four accordions, The Idea, The Designer, downloads) has no source data. No product tags.
- **One collection exists** (`frontpage`). The designs need four signature collections
  (Duna, Safari, Hardy, Arc Teak) plus the Shop All category set. All 10 collection metafields empty.
- **No page metafields set**, so Landing, Our Story, Service and Contact have no CMS content.

## Schema decision

The brief names metaobjects the store does not have — `home_section`, `story_section`,
`gallery_item`, `contact_info`, `legal_page`. The existing schema already covers those needs a
different way, through PAGE metafields (`hero_slides`, `story_block_1/2`, `feature_images`,
`gallery`, `intro_body`, `channels`, `inquiry_types`) plus real Shopify pages.

**Keep the existing schema.** It is pushed, verified and maps cleanly onto the designs. Only two
definitions are genuinely missing and get added to `schema-push`:

- `service` — the Service page lists 10 named services (`title`, `body`, `sort_order`)
- `inquiry` — the 10 fields specified in the brief

## Design source

14 PDFs in `/public/figma`, each a single tall desktop frame at **1728px** wide. There is no
mobile artwork; mobile is derived at the 749px breakpoint. Tokens are in
[`01-theme-tokens.md`](01-theme-tokens.md).

The text in these PDFs is Type 3 outlines, so it was extracted by parsing content streams rather
than read visually — the copy, positions, sizes and colours in the docs are exact.

## Build order

Steps 1–6 are the spine; everything after is assembly. `S` steps are data seeding and run in
parallel with the UI work.

| # | Module / Page | Route | Depends on | Status |
|---|---|---|---|---|
| 0 | Theme + config | — | — | **done** |
| 1 | Shopify client, fragments, types | — | 0 | **done** |
| 2 | Layout shell — header, nav, drawer, footer | all | 1 | **done** |
| 3 | Shop All | `/shop` | 2 | **done** |
| 4 | Shop Detail | `/shop/[handle]` | 3, S1 | **done** |
| 5 | Inquiry drawer, form, API + metaobject | `/inquiry` | 4 | **done** |
| 6 | Inquiry PDF + Resend emails | `/api/inquiry` | 5 | **done** |
| S1 | Seed product + collection data | — | 1 | **next** |
| S2 | Add `service` + `inquiry` definitions | — | — | **done** |
| S3 | Seed metaobject entries — 10 each | — | S2 | data |
| 7 | Collections list + detail | `/collections` | 3, S1 | queued |
| 8 | Projects overview (L/M) + detail | `/projects` | 2, S3 | queued |
| 9 | Designers list + detail | `/designers` | 3, S3 | queued |
| 10 | Gallery + lightbox | `/gallery` | 2, S3 | queued |
| 11 | Our Story · Service · Contact · Legal · FAQ | `/(site)/*` | 2, S3 | queued |
| 12 | Landing page | `/` | 7–11 | queued |
| 13 | Search, 404, error, loading | `/search` | 3, 8, 9 | queued |
| 14 | SEO + performance polish | all | 12, 13 | queued |

## Done so far

**Step 0 — theme and config**

- `app/globals.css` — full token system, compile-verified
- `next.config.ts` — `images.unoptimized`, `cdn.shopify.com` remote pattern
- `app/layout.tsx` — font variables bound, `data-surface="light"` on `<html>`, metadata template

**Step 1 — data layer** — see [`modules/data-layer.md`](modules/data-layer.md)

- `lib/shopify/*` — client, fragments, 5 query modules, transforms, types
- `lib/utils/cn.ts`, `components/providers.tsx` (TanStack Query)
- `yarn check:queries` — 13 queries + 8 normaliser assertions, run against the live store
- `yarn check:price` — fails if a price/inventory field appears in any query

**Step 2 — layout shell** — see [`modules/layout-shell.md`](modules/layout-shell.md)

- `components/layout/*` — header, nav, mobile drawer, footer, back-to-top, PageShell
- `public/brand/*` — logo, mark and six social marks, extracted as vector from the PDFs
- `lib/routes.ts`, `lib/navigation.ts`, `lib/social.ts`, `app/api/newsletter/route.ts`
- Minimal working `/search` so the header control is not a dead link

**Step 3 — Shop All** — see [`pages/shop-all.md`](pages/shop-all.md)

- `/shop` with category chips, sort, infinite scroll, skeletons and empty state
- `lib/shopify/categories.ts` maps 11 chips onto the 63 real `productType` values
- URL state via `nuqs`; pages 2+ served by `app/api/products/route.ts`
- Verified live: filters return the right types, cursor pages do not overlap, no price in the HTML

**Step 4 — Shop Detail** — see [`pages/shop-detail.md`](pages/shop-detail.md)

- `/shop/[handle]` — gallery, specs, accordions, The Idea, The Designer, two rails
- `Product` JSON-LD with no `offers`; branded 404; every section hides when its metafield is empty
- **The inquiry cart moved into this step** (`store/inquiry-cart.ts`, working `enquire`, header badge,
  minimal `/inquiry` list) so the primary CTA is not dead. Step 5 now covers drawer + form + submit
- Cart logic verified: 14/14 assertions

**Step 5 + S2 — inquiry drawer, form and submission** — see [`modules/inquiry-cart.md`](modules/inquiry-cart.md)
  and [`modules/inquiry-submit.md`](modules/inquiry-submit.md)

- Drawer from the header bag, review + form on `/inquiry`, confirmation on `/inquiry/success`
- One Zod schema shared by the form and `POST /api/inquiry`
- **`service` and `inquiry` metaobject definitions pushed to Shopify** (S2, additive + idempotent)
- Verified end to end: a real submission stored all 11 fields with correct totals, then was deleted

**Step 6 — PDF and emails** — see [`modules/inquiry-submit.md`](modules/inquiry-submit.md)

- `lib/pdf/inquiry-pdf.ts` — price columns removed, SKU|Product|Variant|Qty fill `CONTENT_WIDTH`
- `lib/brand.ts`, `lib/email/*` — Resend degrades to a logged warning when unconfigured
- `inquiry-pdf.ts` deleted from the root; the `tsconfig` exclusion is gone
- `yarn check:pdf` — 24 assertions incl. pagination and no price anywhere

`inquiry-pdf.ts` and `schema-push` are excluded in `tsconfig.json` so `yarn build` passes; the
first exclusion is removed in Step 6 when that file moves to `lib/pdf/`.

## Open questions

| Question | Needed by | Default if unanswered |
|---|---|---|
| Which typeface do the designs use? | Step 3 | Ship on Inter, swap later (one line) |
| Confirm slate / earl-grey / terracotta / camel | Step 3 | Leave unused |
| Confirm the Shop All chip labels and grouping (some PDF glyphs unreadable) | Step 7 | Ship the 11 groups in `categories.ts` |
| Is Gallery a page or a component spec? Frame is 1444px, no header/footer | Step 10 | Build as a full page |
| Seeded content — invented copy or real Studio Bizar text? | S3 | Invent, clearly marked |
| Publish the 432 draft products? | Step 3 | Leave draft |
| Which platform is each of the six footer social icons, and their URLs? | Step 11 | Icons 4–6 stay unlinked |
| `.env` says `studio-bizar-be`, store answers as `jr8tih-0s` | Step 1 | Keep as is |
