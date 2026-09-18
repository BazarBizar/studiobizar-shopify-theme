# URL migration — Next routes → Shopify

Shopify fixes the shape of its URLs. A theme cannot serve `/shop/the-bryan-sofa`;
products live under `/products/`, content under `/pages/`, policies under
`/policies/`. So every route this storefront invented has to be redirected, and
the map has to be settled in phase 0 — every `href` written after that depends on
knowing the destination.

`lib/routes.ts` already holds this map in the other direction: it rewrote Shopify's
absolute menu URLs onto Next routes so the nav never left the app. Reversing it is
where the table below came from. That module is deleted with the storefront half —
in a theme the menu URLs are already correct.

## The one that needs a script

**Shopify has no wildcard redirects.** There is no way to express
`/shop/* → /products/*` as a rule; the redirect table takes literal paths only.

That leaves three classes of URL that need one row per record:

| Pattern | Rows | Source of the handles |
|---|---|---|
| `/shop/<handle>` → `/products/<handle>` | ~1,595 | active products |
| `/projects/<handle>` → `/metaobjects/project/<handle>` | 10 | `project` metaobjects |
| `/designers/<handle>` → `/metaobjects/designer/<handle>` | 10 | `designer` metaobjects |

Generate them in phase 9 against the live store rather than by hand, and import
the result through the same CSV as the fixed rows. The handles are unchanged on
both sides — the seeds used Shopify's own handles throughout — so each row is a
mechanical rewrite of the prefix, not a lookup.

Shopify's redirect importer takes a CSV with exactly the two columns in
[redirects.csv](redirects.csv): `Redirect from,Redirect to`.

## Fixed routes

Nineteen rows, ready to import today. `/`, `/search`, `/account`, `/collections`
and `/collections/<handle>` are absent because they are unchanged on both sides.

| Next | Shopify | Note |
|---|---|---|
| `/shop` | `/collections/all` | The catalogue collection stands in for the whole shop, as `CATALOGUE_HANDLES` already did |
| `/projects` | `/pages/projects` | |
| `/designers` | `/pages/designers` | |
| `/gallery` | `/pages/gallery` | |
| `/our-story` | `/pages/our-story` | |
| `/services` | `/pages/our-services` | The Shopify handle is `our-services`; the Next route dropped the `our-` |
| `/contact` | `/pages/contact` | |
| `/faq` | `/pages/faq` | |
| `/careers` | `/pages/careers` | |
| `/care-maintenance` | `/pages/care-maintenance` | |
| `/our-artisans` | `/pages/our-artisans` | |
| `/our-locations` | `/pages/our-locations` | |
| `/professionals` | `/pages/professionals` | |
| `/inquiry` | `/pages/inquiry` | |
| `/inquiry/success` | `/pages/inquiry-success` | Next nested it; Shopify page handles are flat |
| `/legal/privacy-policy` | `/policies/privacy-policy` | |
| `/legal/terms-conditions` | `/policies/terms-of-service` | Shopify's policy handles are fixed and cannot be renamed |
| `/legal/shipping-delivery` | `/policies/shipping-policy` | as above |
| `/legal/returns-refunds` | `/policies/refund-policy` | as above |

The four policy rows are the ones worth re-reading before import: Shopify names
its policy pages itself, and those names do not match the ones this storefront
chose. Writing `/policies/terms-conditions` produces a 404, not a redirect.

## Decisions this table assumes

**Projects and designers become metaobject templates**, so their detail pages are
`/metaobjects/<type>/<handle>`. The alternative — a Shopify page per record —
gives prettier URLs and duplicates content that is already structured, and puts
twenty pages in the admin that have to be kept in step with twenty metaobjects by
hand. If that trade is reversed later, only these two prefixes change.

**`/account` stays**, because Shopify serves it natively. The OAuth + PKCE flow
in `lib/customer-account/` and the four routes under `app/api/auth/` are deleted
rather than ported: Shopify's customer accounts do the same job, and the reason
the custom flow existed — a headless storefront cannot use Shopify's own login —
stops applying the moment the storefront is a theme.
