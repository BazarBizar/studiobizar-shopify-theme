# Our Story · Service · Contact · FAQ · Legal (Step 11)

The last content group, plus the remainder of S3.

## Files

| Route | File | Ground |
|---|---|---|
| `/our-story` | `app/our-story/page.tsx` | charcoal-blue |
| `/services` | `app/services/page.tsx` | charcoal-blue |
| `/contact` | `app/contact/page.tsx` | mocha, **dark-wood footer** |
| `/faq` | `app/faq/page.tsx` | earth |
| `/legal/[handle]` | `app/legal/[handle]/page.tsx` | earth |

Plus `components/contact/contact-form.tsx`, `app/api/contact/route.ts`,
`lib/contact/schema.ts`, `components/sections/captioned-row.tsx`, `scripts/seed-content.ts`.

## A missing surface

Our Story and Service sit on **charcoal-blue `#47515C`**, which was measured in Step 0 but never
given a `data-surface`. Added as `blue`, and `Surface` in `page-shell.tsx` widened to match.

Contact is the one page whose footer is **not** olive — the design puts it on dark wood
(`0 1027 1728 401 #302F2D`), which is what `footerSurface="dark"` is for.

## These pages carry real copy

Unlike the rest of the designs, Service and Contact are not lorem. Transcribed verbatim:

- The **Design Program** intro and the **Beyond The Project** paragraph
- All **ten service names**, in design order — Concept Development, Private- & White-label
  Development, Project Management, Custom Design, Bulk Purchasing & Price Optimization,
  Renderings, Quality Control, Sourcing Support, Logistics Support, Sourcing Catalogue Access
- Every **contact channel**: `info@` / `sales@` / `press@studiobizar.be`,
  Duffelsesteenweg 152, Kontich, Antwerp 2550, `+32 475 80 54 12`, and the three
  `@studiobizarantwerp` socials
- The Contact lede and the form's helper text

Service *descriptions*, the Our Story blocks and all FAQ answers are invented.

The design lists "Trade & Wholesale / sales@studiobizar.be" twice — a copy-paste in the mock, so it
is seeded once. Eight unique channels.

## Contact has its own form

Different from the inquiry form: the design splits first and last name, makes phone required, and
adds a "Type of Inquiry" select fed by the `custom.inquiry_types` PAGE metafield. It gets its own
schema (`lib/contact/schema.ts`) and its own route.

`POST /api/contact` is **email-only** — a message has nothing to store, unlike an inquiry. It
degrades the same way: with no `INQUIRY_NOTIFY_EMAIL` it logs and reports success.

`channelHref` maps the metaobject's `link_type` choice onto `mailto:` / `tel:` / an external link /
plain text. Verified: 3 mailto, 1 tel, 3 external.

## Legal is allow-listed

`/legal/[handle]` accepts only the four handles `schema-push` provisions. Anything else 404s, so the
route cannot be used to proxy an arbitrary Shopify page. All four prerender via
`generateStaticParams`.

## FAQ groups itself

Entries are ordered by `sort_order` and grouped by `category` in first-appearance order — Ordering,
Trade, Delivery, Care, Materials. Panels reuse the `<details>` accordion from Shop Detail.

## Seeded (rest of S3)

`yarn seed:content` — 10 `service`, 8 `contact_channel`, 10 `faq_item`, and the PAGE metafields on
`our-story` (story blocks + images), `our-services` (intro + images) and `contact` (channels,
inquiry types, intro).

## Verified against the running app

```
/our-story             200  Our Story
/services              200  Design Program — all 10 services, real intro, blue ground
/contact               200  8 channels, 3 mailto + 1 tel, 7 form fields, 5 inquiry types
                            surfaces light → mocha → dark
/faq                   200  5 groups, 10 questions
/legal/privacy-policy  200  Privacy Policy
POST /api/contact      validation rejects; a valid message returns its confirmation
```

`yarn build`, `eslint` and `yarn check:price` pass.

## Open

The "Beyond The Project" copy mentions a **Bazar Bizar Partner Program** and the design puts a
`read more` under it. There is no destination for that in the brief's page map, so it links to
`/contact` for now.
