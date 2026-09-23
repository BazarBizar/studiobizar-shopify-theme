# What is yours to do

Everything here needs a person with Shopify admin access, a licence, or a
decision. None of it can be done from the repo. Ordered by what unblocks the most.

## 1. Assign the page templates — 5 minutes, do this first

Four alternate templates exist and are attached to nothing, so the pages they
were written for still render as plain pages. In **Content → Pages**, open each
page and set its template in the sidebar:

| Page | Template to choose |
|---|---|
| `professionals` | `page.designers` |
| `projects` | `page.projects` |
| `gallery` | `page.gallery` |
| `contact` | `page.contact` |

There is no page with the handle `designers`, and there cannot be: the designer
metaobject already owns `/pages/designers/` for its own entries. That is why the
designer list goes on `professionals` — which is what the Next route reads too.

After this the preview shows real pages instead of empty ones.

## 2. Install Search & Discovery and add a Product type filter

The only thing standing between the shop page and full parity. Without filters,
`collection.filters` is empty and the category chip row renders as nothing — the
grid works, but the eleven chips are gone.

**A decision comes with it.** The store has 63 distinct `productType` values
against 11 chips in the Next build, so exposing the raw list is not the same
design. Three ways:

- expose all 63 and accept a longer row;
- group them with product tags and filter on tags instead;
- add a `category` metafield to products and filter on that — closest to the
  Next build, and the most work.

Tell us which and the section follows it; nothing in the theme has to change for
the first two.

## 3. Log the CLI in — one command, no app to install

Unblocks `yarn theme:dev` and hot reload, which is the difference between
previewing a change in a second and pushing for it.

```bash
npx shopify auth login
```

It opens a browser, you sign in as you normally would, and the CLI keeps the
session. Then `yarn theme:dev` works in full.

**Unset `SHOPIFY_CLI_THEME_TOKEN` first** if it is still exported. When that
variable is present the CLI uses it and ignores the browser session — and an
Admin API token cannot open a development session on a password-protected
storefront, which this store is. That is the failure this step exists to avoid;
the same token remains fine for `theme push` and `theme check`.

### Theme Access — only if you need to hand access to someone else

An earlier draft of this file led with Theme Access. That was the wrong default:
it exists to give theme access to someone who should *not* have full admin — an
agency, a contractor, a CI pipeline. As the store owner running the CLI on your
own machine, you do not need it.

If you do want it later: install from <https://apps.shopify.com/theme-access>,
then **Apps → Theme Access → Add user** with a name and an email address. The
part the UI does not tell you: **the password arrives by email**, it is never
shown on screen. It looks like `shptka_…` and is used as
`SHOPIFY_CLI_THEME_TOKEN`.

Checked on 18 September 2026: the store has two apps installed — the custom
`Admin Studi Bizar` app and Shopify's `Messaging`. Neither Theme Access nor
Search & Discovery is there, which is the same finding section 2 reaches from the
other direction.

## 4. Configure the App Proxy — blocks the inquiry submission

Phase 5 cannot ship without it. Submitting an inquiry writes a metaobject, builds
a PDF and sends two emails; none of that runs in Liquid.

On the custom app, add a proxy:

- subpath prefix `apps`, subpath `inquiry`
- proxy URL: the Next deployment's `/api/inquiry`

The theme setting `inquiry_proxy_path` already defaults to `/apps/inquiry`.

## 5. Licence and supply the Helvetica Neue webfont

Not a blocker. Until the `.woff2` files are in `theme/assets/` and named in theme
settings, macOS and iOS render the real face and everything else falls back to
Arial — exactly as the Next storefront behaves today. It is the last thing
between the two being identical on Windows.

## 6. Two decisions with no deadline yet, but no obvious answer either

**Where does the admin panel live after the cutover?** It stays on Vercel while
the storefront moves to Shopify, so it needs a hostname of its own —
`admin.studiobizar.be`, or similar. Nothing breaks until DNS moves, and then it
breaks all at once.

**Is `relevance` missed on the shop page?** It was removed because it could not
paginate: on the default setting a visitor was seeing 192 of 1,595 products. The
default is now `newest`. If a different default is wanted commercially, say so —
`a-z` and `z-a` are both verified complete.

## Not yours — for reference

The cutover itself is one switch: publish the theme, then point DNS at Shopify.
Everything in phases 3, 5, 7 and 9 has to be finished first, because the same
switch turns the Next storefront off. See
[shopify-setup.md](shopify-setup.md) for what is already configured correctly,
and [redirects.md](redirects.md) for the ~1,615 redirect rows that only start
working after that switch.
