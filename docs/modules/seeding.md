# Seeding (S1 + part of S3)

Filling the empty Shopify content so the storefront has something to render.

```bash
yarn seed                  # designers → collections → products, in that order
yarn seed:designers        # each also accepts --dry-run
yarn seed:collections
yarn seed:products         # and --limit=N
```

Order matters: products reference collections, and collections reference designers.

## Files

| File | Role |
|---|---|
| `scripts/lib/admin.ts` | Admin client, file upload, `metafieldsSet`, rich-text helper |
| `scripts/seed-designers.ts` | 10 `designer` metaobjects with portraits |
| `scripts/seed-collections.ts` | 4 signature collections + products + metafields |
| `scripts/seed-products.ts` | 14–15 metafields on each of 48 products |
| `app/api/revalidate/route.ts` | Drops the ISR cache so seeded data appears immediately |

## What is now in the store

| Entity | Before | After |
|---|---|---|
| `designer` metaobjects | 0 | **10** |
| Collections | 1 (`frontpage`) | **5** — plus Duna, Safari, Hardy, Arc Teak |
| Products with metafields | 1 key (`colour`) | **48 products × 14–15 keys** |
| Shopify Files | — | 22 uploaded (10 portraits, 4 collection, 8 product) |

Designer names are taken from `DESK - Our Designers.pdf`, `DESK - Shop Detail.pdf` and
`DESK - Landing Page.pdf`. Collection titles and their designer attributions come from
`DESK - Collections All.pdf`.

**All prose is invented.** The Figma PDFs use lorem ipsum for every body text, so there was nothing
real to transcribe. Bios, collection descriptions, "The Idea" copy, specs, care instructions and
shipping text are written to be plausible and to vary by product type — but every line should be
replaced with Studio Bizar's own.

Two designers named in the designs — **La Mamba Studio** (Hardy) and **Mario Ruiz, Gazpacho Studio**
(Arc Teak) — are not among the ten seeded entries, so those two collections are attributed to
substitutes. The substitution is commented in `seed-collections.ts`.

## Three things that were not obvious

**A collection created through the Admin API is published to nothing.** All four looked correct in
the admin and were completely invisible to the Storefront API — `resourcePublicationsCount` was 0.
The seeder now calls `publishablePublish` against the Online Store publication. Without it,
`/collections` and the "The Collection" rail render nothing and the cause is not visible from the
app side.

**Admin uses `metaobjectByHandle`, Storefront uses `metaobject(handle:)`.** The same lookup, two
different field names on the two APIs.

**Seeding does not appear until the ISR cache turns over.** Products cache for 15 minutes, so the
freshly seeded data was invisible for a while and looked like a bug in the queries. `POST
/api/revalidate` drops one tag or all of them — which is what the cache tags on every
`shopifyFetch` were added for. In production, point a Shopify webhook at it.

## File uploads

`uploadImage()` does the three-step Shopify dance: `stagedUploadsCreate` → POST the bytes to the
staged target → `fileCreate`. Files are then processed asynchronously, so it polls until
`fileStatus` is `READY`; a `file_reference` metafield fails validation against a file still in
`UPLOADED`.

Product "idea" images are uploaded **once** and reused across the 48 products rather than uploaded
per product.

## Throttling

The Admin API uses a cost-based leaky bucket, and seeding ~700 metafields drains it. The client
retries `THROTTLED`, 429 and 5xx with exponential backoff, and sleeps pre-emptively when
`throttleStatus.currentlyAvailable` drops below 150 rather than waiting to be rejected near the end
of a long run.

## Idempotency

Safe to re-run. A designer whose handle exists is skipped; a collection whose handle exists is
reused and its metafields re-set; `metafieldsSet` upserts. Nothing is duplicated.

Nothing is deleted by any of these scripts. Removing seeded content is a manual action in the admin.

## Verified against the running app

Shop Detail for `the-malawi-two-seater-natural-stone` — the exact product in the Figma design:

```
h1          The Malawi Two Seater - Natural Stone
byline      by Eddy Roothaert, Studio Bizar
spec rows   Material / Finish · Colour · Upholstery · Availability   ← all four, as designed
accordions  Technical Specifications · Dimensions · Care & Maintenance · Shipping & Delivery
sections    The Idea | The Designer | The Collection | Discover More
lead time   Lead time of 12–16 weeks
JSON-LD     offers absent
```

Product cards render `Part of ‘The Duna Collection’`, matching the design's sub-line, and the `new`
flag renders on the 3-of-12 products carrying `is_new`.

## Still unseeded (S3 proper)

`project`, `captioned_image`, `contact_channel`, `faq_item` and `service` metaobjects, plus all PAGE
metafields. These block Projects (Step 8), Gallery (10), and Our Story / Service / Contact / FAQ
(11). Designers were pulled forward into S1 only because product and collection metafields
reference them.
