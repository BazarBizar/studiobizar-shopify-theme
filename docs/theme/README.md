# The Shopify theme

`theme/` is a Shopify Online Store 2.0 theme that replaces the public half of the
Next app. It is built from a skeleton, not from Dawn.

```bash
yarn theme:build          # compile tokens → theme/assets/sb-theme.css (commit the result)
yarn theme:watch          # rebuild while working on sections
yarn theme:dev            # shopify theme dev --path theme
yarn check:theme-price    # NO PRICE, NO CART
node scripts/check-theme-refs.mjs
```

## Why not Dawn

Dawn 16.0.0 is in the repo and stays there as a reference. It is not the base.

Dawn's 48 sections and 190 assets are organised around price, variants, cart and
checkout — exactly what `lib/shopify/fragments.ts` forbids and what this
storefront does not have. Building on it would mean removing something on every
screen and then guarding against it coming back. Four things are worth lifting
out of it when their phase arrives: the Section Rendering API pattern for
paging, `predictive-search`, `contact-form`, and the shape of `locales/`.

`node scripts/check-theme-price.mjs "Shopify Dawn Theme/snippets"` reports 147
violations. That is the measurement behind the decision, and it is also how to
vet a Dawn snippet before lifting it.

## The build step a theme does not have

Shopify serves `assets/` verbatim — no bundler, no PostCSS, no Tailwind. So
Tailwind runs here instead, and the **output is committed**:

```
theme-build/sb-theme.css   source — the storefront half of app/globals.css
theme-build/build.mjs      postcss + @tailwindcss/postcss
theme/assets/sb-theme.css  committed output, what the store loads
```

Two consequences worth internalising:

**Rebuild after touching any `.liquid` file.** Tailwind emits only the utilities
it can see. A class used for the first time in a new section is missing from the
stylesheet until the next build, and the symptom is a section that renders with
no styling at all. `yarn theme:check` fails when the committed file is stale —
wire it into CI.

**A class assembled from a setting is invisible to Tailwind.** `section-{{
section.settings.rhythm }}` never gets emitted. That is why
`snippets/sb-section-classes.liquid` writes all five out in a `case` statement.
Any new setting that picks a class needs the same treatment.

## Where the design system went

`app/globals.css` is 766 lines. Sections A–J — palette, semantic layer, type
scale, layout, radius, motion, surfaces, base, utilities — ported to
`theme-build/sb-theme.css` with the values unchanged. Section K, the shadcn
theme for `/admin`, has no counterpart here, and neither does the `dark` custom
variant: nothing in a theme writes `.dark` onto `<html>`.

Two additions, both making settings possible rather than changing the design:

- `--sb-type-scale` / `--sb-type-scale-mobile` multiply the whole type ladder.
  Default `1`, which computes to exactly the measured size.
- `sb-skip-link` and `sb-summary` are theme-only. The Next build had no skip
  link; this is an accessibility gain, not a port.

One behavioural replacement: `sb-masonry` is now CSS `columns`. The Next build
used `react-masonry-css`, which needs a flex parent and padded columns —
identical result, no JS, so `sb-masonry-column` is gone.

`snippets/sb-css-variables.liquid` writes the theme settings over the compiled
defaults. Every default in `settings_schema.json` is the measured value, so a
store that never opens those controls renders what the Next build renders.

## Surfaces

The designs are one palette with sections on different grounds, not light/dark
mode. `data-surface` on any element rebinds every semantic utility inside it.
Available: `light` `dark` `olive` `blue` `mocha` `black`.

In Next, each page composed a `PageShell` and picked its ground. Here **each
section carries its own** — more granular, and editable. `settings.page_surface`
sets what shows between and below sections.

This is the one structural difference from the Next build worth knowing about:
there is no per-template ground. A template whose design is entirely dark wood
gets it by setting every section on that template to `dark`, not by setting it
once. The header and footer are section groups shared across all templates, so
the header takes the body ground and the footer has its own setting.

## What exists so far

| | |
|---|---|
| `layout/theme.liquid` | document, fonts, skip link, section groups |
| `sections/sb-header.liquid` | header.tsx + header-actions + mobile-nav + language-switcher |
| `sections/sb-footer.liquid` | footer.tsx + newsletter-form, link columns as blocks |
| `sections/sb-main-placeholder.liquid` | names the phase that owns an unported template |
| `sections/sb-page-content.liquid` | the title and body typed in Shopify admin |
| `sections/sb-rich-text.liquid` | a band of copy with a button — replaces IntroBlock and ContactCta |
| `sections/sb-media-text.liquid` | media-text.tsx, image either side |
| `snippets/` | button, image, icon, logo, social links, mobile nav, language switcher, section classes, meta tags, back to top, css variables |
| `assets/sb-theme.js` | back to top, dropdown dismissal |
| `assets/sb-nav.js` | mobile drawer — transitions, scroll lock, focus trap |

`templates/page.json` is real and composable. Every other template is still
wired to the placeholder section, which renders **only in the theme editor and
dev previews** — an unfinished page shows nothing on a live store. Each one names
its phase, and there should be none left when phase 7 closes.

## Things that changed on purpose

**`lib/routes.ts` is gone.** It rewrote Shopify's absolute menu URLs onto Next
routes so the nav never left the app. In a theme the menu URLs are already
right. What replaces it is a redirect table — see [redirects.md](redirects.md),
including the finding that Shopify has no wildcard redirects, so ~1,615 rows
have to be generated.

**The newsletter posts to Shopify's customer form**, not `/api/newsletter`. The
subscriber lands in Shopify's customer list tagged `newsletter`, which is where
the marketing tools already look.

**The language switcher is live.** The React version hard-coded EN/NL/FR and
disabled two of them because the Next app had no translation layer. Shopify has
Markets: publish a locale and it moves into the real switcher on its own.

**The mobile drawer traps focus.** The React drawer never did — a keyboard user
could tab out of the open panel onto the page behind it. That is a bug this port
fixes rather than reproduces.

**ISR is gone**, with nothing replacing it. Cache tags, per-entity windows and
`POST /api/revalidate` all existed because Next had to be told when Shopify
changed. Liquid renders on Shopify. A whole class of stale-content bug
disappears.

## Composable pages

Non-technical editors need to build **new pages from scratch**, which sets a
standard every remaining section has to meet — a preset, `surface` and `rhythm`
settings, and every part optional. See [page-building.md](page-building.md),
including the one trap worth knowing before anyone is trained: layout lives on
the template, not the page, so a page with its own layout needs its own template.

## Next

Phases 3 (remaining primitives), 4 (catalogue), 5 (inquiry cart + App Proxy),
6 (content entities), 7 (landing + content pages), 9 (parity QA). The plan, with
exit criteria for each, is the migration artifact.

**Phase 8 no longer exists as a phase.** It was going to be a pass at the end to
give every section its settings. Once editors have to build pages from scratch,
a section without a full schema is not finished, so the schema is written with
the section — and a late pass would be rewriting work rather than completing it.

Before phase 4, two things need doing in Shopify itself: turn on online-store
access for the 8 metaobject definitions, and confirm whether the 11 category
chips in `lib/shopify/categories.ts` become Search & Discovery filters or stay a
metafield.
