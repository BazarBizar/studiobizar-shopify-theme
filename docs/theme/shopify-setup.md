# What the theme needs configured in Shopify

Checked against `studio-bizar-be.myshopify.com` on 18 September 2026, not
assumed. Re-run the checks in the last section if any of this looks stale.

## Already correct — nothing to do

**Admin API scopes.** All sixteen the panel and the theme work need are on the
token, including the four the recent screens added: `read_content` /
`write_content` for pages, and `read_online_store_navigation` /
`write_online_store_navigation` for menus. `read_themes` / `write_themes` and
`read_app_proxy` are there too.

**Metaobject storefront access.** All nine definitions are `PUBLIC_READ`, so
Liquid can read every one of them:

```
captioned_image  designer  project  contact_channel  faq_item
service          inquiry   location  site_settings
```

**Metafield storefront access.** All 41 definitions in the `custom` namespace are
`PUBLIC_READ` — 18 PRODUCT, 10 COLLECTION, 13 PAGE.

**Metaobject online-store URLs.** `designer` and `project` already have the
online-store capability enabled with url handles set, which is what gives them a
public URL. The migration plan listed "turn on online-store access for the
metaobject definitions" as a phase 0 task; it was already done, and the other
seven types do not need it — they are read from inside a page, never browsed.

The real URLs are `/pages/designers/<handle>` and `/pages/projects/<handle>`, not
the generic `/metaobjects/<type>/<handle>` an earlier draft of
[redirects.md](redirects.md) assumed.

## Needed before the theme can do everything it is built to do

### 1. Search & Discovery filters — none configured

`/collections/all` returns no filters today, so the category chip row renders as
nothing. That is a deliberate degradation and the grid works without it, but the
11 chips from `lib/shopify/categories.ts` are simply absent until filters exist.

Install Shopify's free **Search & Discovery** app and add a filter on **Product
type**. The store has 63 distinct `productType` values against 11 chips in the
Next build, so the two do not map one to one — decide whether to expose all 63,
group them with product tags, or add a `category` metafield and filter on that.
This is the open question the plan has carried since phase 0, and it is now the
only thing blocking full parity on the shop page.

### 2. App Proxy — for the inquiry submission (phase 5)

Submitting an inquiry writes a metaobject, builds a PDF and sends two emails.
None of that can run in Liquid, so the theme posts to an App Proxy that forwards
to the existing `POST /api/inquiry`.

Configure a proxy on the custom app with subpath prefix `apps` and subpath
`inquiry`, pointing at the Next deployment. The theme setting
`inquiry_proxy_path` already defaults to `/apps/inquiry`.

### 3. Helvetica Neue webfont files

A licensed Linotype face, so nothing can fetch it. Until the `.woff2` files are
uploaded to `theme/assets/` and named in the theme settings, macOS and iOS render
it natively and everything else falls back to Arial — exactly as the Next build
behaves today. Not a blocker, but it is the last thing standing between the two
storefronts being pixel-identical on Windows.

### 4. A Theme Access password — `theme dev` is blocked without one

The CLI is now a devDependency, so `yarn theme:lint`, `yarn theme:push` and
`yarn theme:dev` all resolve. Authentication works by exporting the Admin API
token as `SHOPIFY_CLI_THEME_TOKEN`, and `theme check` and `theme push` both run
that way.

**`theme dev` does not.** It fails with *"Your development session could not be
created because the store password is invalid"*, and the CLI's own warning says
why: an Admin API token cannot open a session on a **password-protected
storefront**, which this store is (`onlineStore.passwordProtection.enabled` is
true). Hot module reloading is unavailable for the same reason.

Two ways out, both a minute's work in the Shopify admin:

- **Install the Theme Access app** and generate a password (`shptka_…`). Export
  it as `SHOPIFY_CLI_THEME_TOKEN` instead of the Admin token and `theme dev`
  works, hot reload included. This is the one to do.
- Or run `shopify auth login` once in a terminal and drop the token entirely;
  the CLI then holds its own browser-obtained session.

Until then, the working loop is `yarn theme:push` against the unpublished theme
and previewing from Shopify admin — which is what the theme is set up for now.

### 5. Where the work-in-progress theme lives

`Studio Bizar (migration WIP)`, id `152038572168`, **unpublished**. Dawn is still
the published theme and is untouched.

- Editor: `/admin/themes/152038572168/editor`
- Preview: `?preview_theme_id=152038572168`

The preview needs the storefront password, since the store is password-protected.

`yarn theme:push` re-uploads to that same theme by name. It prints an `errors`
object when Shopify rejects any file — **an empty push output is the pass
condition**, and two schema faults were found exactly that way: a range with 998
steps (Shopify allows 101) and a text setting with a blank default. Both now have
checks in `scripts/check-theme-refs.mjs`, because an invalid section schema
removes the whole section and then every template using it fails too.

## The cutover, and why redirects do nothing yet

**`studiobizar.be` is served by Vercel, not Shopify.** The Next app answers `/`
with a 200 and `/pages/our-story` with a 404. Shopify's own `myshopify.com` URLs
301 to that hostname — a domain the Online Store does not actually serve.

Three consequences worth holding on to:

- **URL redirects created in Shopify today are inert.** They are executed by the
  Online Store, which is not on the end of that hostname. The store has zero
  configured; the ~1,615 rows in [redirects.md](redirects.md) only start working
  after DNS moves.
- **The theme can be built and reviewed without touching DNS.** The unpublished
  theme is already on the store and previews against live data. (`theme dev`
  needs the Theme Access password — see section 4.)
- **The published theme is Dawn.** Keep the new theme unpublished until the
  cutover; publishing it changes nothing while DNS points at Vercel, but it
  removes the safety of having an obviously-inactive theme.

The cutover is one switch: publish the theme, then point DNS at Shopify. The same
switch turns the Next storefront off, so everything in phases 3–9 has to be
finished first — and the admin panel, which stays on Vercel, needs a hostname of
its own before that happens.

## Re-checking any of this

```bash
yarn check:admin-ops     # every GraphQL document, against the live store
yarn check:content       # metaobject and page metafield content
node scripts/check-theme-refs.mjs
node scripts/check-theme-price.mjs
```

Scopes, metaobject access and the online-store capability were read with
throwaway probes rather than committed scripts — they change rarely, and a
one-off query against `metaobjectDefinitions { access { storefront } capabilities
{ onlineStore { enabled data { urlHandle } } } }` is the whole check.
