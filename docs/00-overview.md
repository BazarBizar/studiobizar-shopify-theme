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

**Content status** — all seeded, see [modules/seeding.md](modules/seeding.md)

Verified through the Storefront API with `yarn check:content`:

| Entity | Count |
|---|---|
| `designer` | 10 |
| `project` | 10 |
| `captioned_image` | 15 (12 project + 3 home hero) |
| `service` | 10 |
| `contact_channel` | 8 |
| `faq_item` | 10 |
| `inquiry` | 0 — written by the storefront, never seeded |
| Collections | 13 (12 signature + `frontpage`), all with designer + hero image |
| Products with metafields | **144**, across the 12 collections |

PAGE metafields set on `home` (8), `contact`, `our-story`, `our-services` and `gallery`.

The remaining ~1,450 products carry only `colour` from the original import, so their Shop Detail
pages render the upper half and hide the rest — the intended graceful degradation.


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
| S1 | Seed products, collections + designers | — | 1 | **done** |
| S2 | Add `service` + `inquiry` definitions | — | — | **done** |
| S3 | Seed project / gallery / service / contact / FAQ entries | — | S2 | **done** |
| 7 | Collections list + detail | `/collections` | 3, S1 | **done** |
| 8 | Projects overview (L/M) + detail | `/projects` | 2, S3 | **done** |
| 9 | Designers list + detail | `/designers` | 3, S3 | **done** |
| 10 | Gallery + lightbox | `/gallery` | 2, S3 | **done** |
| 11 | Our Story · Service · Contact · Legal · FAQ | `/(site)/*` | 2, S3 | **done** |
| 12 | Landing page | `/` | 7–11 | **done** |
| 13 | Search, 404, error, loading | `/search` | 3, 8, 9 | **next** |
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

**S1 — seeding** — see [`modules/seeding.md`](modules/seeding.md)

- 10 `designer` metaobjects, 4 signature collections, 48 products × 14–15 metafields, 22 files
- `yarn seed` (idempotent, `--dry-run` supported); `POST /api/revalidate` drops the ISR cache
- Shop Detail now renders all four sections against real data

**Step 7 — Collections** — see [pages/collections.md](pages/collections.md)

- `/collections` 4-up cards on 3:5 media with a wordmark overlay; `/collections/[handle]` with a
  128px wordmark hero, The Idea, The Designer, product grid, In Context and the contact block
- `/api/products` gained `collection=`, so the detail page reuses the Shop All infinite-scroll grid
- Shared `ContactCta` and `GoBack` now exist for the six pages that close with them

**Step 8 + S3 projects** — see [pages/projects.md](pages/projects.md)

- `/projects` with category chips and the L/M density toggle, both in the URL; `/projects/[handle]`
  with hero, meta column, lightbox gallery, Featured Items and Other Projects
- 10 projects + 12 captioned images seeded; `lib/shopify/entities.ts` normalises the metaobjects
- **Fixed a silent data bug:** the Storefront `products(query:)` filter has no `handle:` term and
  ignores it, returning everything — replaced with an exact `nodes(ids:)` lookup

**Step 9 — Designers** — see [pages/designers.md](pages/designers.md)

- `/designers` 4-up on mocha; `/designers/[handle]` with portrait, bio, collections and
  "Designed by" grid, plus `Person` JSON-LD
- **Storefront product search cannot filter on a metafield** (all three syntaxes tested and
  documented), so a designer's products are reached via the collections that credit them

**Step 10 — Gallery** — see [pages/gallery.md](pages/gallery.md)

- The Gallery PDF turned out to be **the lightbox spec, not a page** — no header/footer, 1444px
  frame, and its counter drawn in Figma annotation purple. Built both: the viewer to spec, and the
  `/gallery` route the brief lists
- `components/ui/lightbox.tsx` is now shared with Projects Detail; masonry via `react-masonry-css`
- `yarn seed:pages` creates the `gallery` page and attaches the 12 captioned images

**Step 11 + rest of S3** — see [pages/content-pages.md](pages/content-pages.md)

- `/our-story`, `/services`, `/contact`, `/faq`, `/legal/[handle]` (allow-listed, prerendered)
- Added the missing **charcoal-blue surface**; Contact uses a dark-wood footer per the design
- Service and Contact carry **real copy** — 10 service names and 8 contact channels transcribed
- Contact gets its own richer form + `POST /api/contact` (email-only, degrades without a key)

**Step 12 — Landing page** — see [pages/landing.md](pages/landing.md)

- All 11 sections in design order, on dark wood; hero takes any number of slides
- **Collections expanded 4 → 12**, all signature, each with 12 products and an image
- Three new PAGE metafields (`new_in`, `monthly_selection`, `story_image`) pushed via schema-push
  — and added to `PAGE_METAFIELDS`, without which the fragment never requests them
- Carousels via `embla-carousel-react`, read with `useSyncExternalStore`
- **Instagram row is live via Behold** — see [modules/instagram.md](modules/instagram.md); set
  `BEHOLD_FEED_ID` in `.env`, falls back to the gallery metafield when unset or unreachable

Only `schema-push` is excluded from type-checking now — it is plain JS with its own conventions.

## Open questions

**Resolved:** the typeface is **Helvetica Neue** — see [01-theme-tokens.md](01-theme-tokens.md).
Licensed, so it renders as a system stack until the webfont files are supplied.

| Question | Needed by | Default if unanswered |
|---|---|---|
| Confirm slate / earl-grey / terracotta / camel | Step 3 | Leave unused |
| Confirm the Shop All chip labels and grouping (some PDF glyphs unreadable) | Step 7 | Ship the 11 groups in `categories.ts` |

| Seeded content — invented copy or real Studio Bizar text? | S3 | Invent, clearly marked |
| Publish the 432 draft products? | Step 3 | Leave draft |
| Which platform is each of the six footer social icons, and their URLs? | Step 11 | Icons 4–6 stay unlinked |
| `.env` says `studio-bizar-be`, store answers as `jr8tih-0s` | Step 1 | Keep as is |
