# Landing Page (Step 12)

`/`. Figma: `DESK - Landing Page.pdf`.

## Section order

Built to match the design top to bottom:

| # | Section | Source |
|---|---|---|
| 1 | Hero slider | `custom.hero_slides` — a list of `captioned_image` |
| 2 | Our Services + `read more` | `custom.intro_body` |
| 3 | Three-image row | `custom.feature_images` |
| 4 | Selected Projects (3) + `view all` | `project` where `is_selected` |
| 5 | Signature Collections — carousel, max 12 | collections where `is_signature` |
| 6 | New In — carousel, max 12 | collection named by `custom.new_in` |
| 7 | Monthly Selection — carousel, max 12 | collection named by `custom.monthly_selection` |
| 8 | Full-bleed story image | `custom.story_image` |
| 9 | Our Story + `read more` | `custom.story_block_1` |
| 10 | Instagram (5) + `join our community` | `custom.gallery` |
| 11 | Contact block | shared `ContactCta` |

Ground is dark wood, as measured; the hero sits on off-black and the footer on olive.

## The hero takes any number of slides

`hero_slides` decides the count — one slide renders as a still image with no controls, several
render as a loop with dot navigation. Nothing is hard-coded to three. Add or remove entries in
`scripts/seed-pages.ts` (or in the Shopify admin) and the page follows.

## New fields

Three PAGE metafields were added to `schema-push` and pushed:

| Key | Type | Why |
|---|---|---|
| `new_in` | `collection_reference` | Which collection feeds the New In row |
| `monthly_selection` | `collection_reference` | Which collection feeds Monthly Selection |
| `story_image` | `file_reference` | The full-bleed image above Our Story |

Pointing the two product rows at a collection — rather than hard-coding a rule like "products
tagged new" — means the rows can be re-pointed from the admin without a deploy. That is the whole
reason they are references and not a query.

**They also had to be added to `PAGE_METAFIELDS` in `lib/shopify/constants.ts`.** The page fragment
only requests the keys in that list, so a metafield can exist in Shopify and still arrive as `null`
— which is exactly what happened first time round: New In and Monthly Selection rendered as nothing.

## Collections

Expanded from 4 to **12**, all flagged `is_signature`, each with 12 products and an uploaded image,
so the Signature Collections carousel has a full set. Only Duna, Safari, Hardy and Arc Teak appear
in the designs; the other eight — Lumen, Terra, Atlas, Linen, Mesa, Ember, Harbour, Quarry — are
invented, with invented copy.

## Carousel

`embla-carousel-react`, per the brief. One `Carousel` component takes arbitrary children, so the
same row drives a collection card and a product card. Arrows hide themselves when everything
already fits.

Embla is read through `useSyncExternalStore` rather than mirrored into state from an effect — which
is both what the lint rule asks for and the correct way to read an external store.

## Verified against the running app

```
sections   Our Services · Selected Projects · Signature Collections · New In ·
           Monthly Selection · Our Story · Instagram
hero       3 slides with dot navigation
cards      12 collections · 3 projects · 24 products (two rows of 12)
carousels  3 regions
images     story image + 5 Instagram tiles
surfaces   light → dark → black (hero) → dark → olive (footer)
```

`yarn build`, `eslint` and `yarn check:price` pass; `schema-push verify` reports the three new
metafields OK.

## Note

The Instagram row is fed by the page's `gallery` metafield, not the Instagram API — the design shows
five images and nothing indicates a live feed. Swap it for a real integration later without touching
the layout.
