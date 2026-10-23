# Building a page without a developer

The requirement is that someone non-technical can make a **new page from
scratch**. Shopify supports this, but the flow crosses two screens and has one
trap that will otherwise be discovered the expensive way.

## The trap: layout lives on the template, not on the page

A `.json` template defines a list of sections **and their settings**. Every page
assigned to that template renders the same sections with the same settings.

So this does not work:

> Make `page.flexible.json`, assign it to every page, let editors compose each
> one.

Editing one page would change all of them. Layout is per-template; content is
per-page. That split is fixed and cannot be worked around from the theme.

The consequence: **a page with its own layout needs its own template.** Shopify
has a first-class flow for this, and it is the step to rehearse with whoever will
be doing it.

## The flow

1. **Shopify admin → Content → Pages → Add page.** Title, body, handle. Save.
   The body text is real and is what `sb-page-content` puts on screen — an editor
   who only wants a paragraph of writing can stop here.

2. **Online Store → Themes → Customize**, then navigate to the new page using the
   top bar (Pages → the page).

3. **Template dropdown → Create template.** Name it after the page. Shopify
   creates `templates/page.<name>.json` seeded from `page.json` and points the
   page at it.

4. **Add section.** Everything with a `presets` block appears in the picker.
   Reorder by dragging, configure in the right-hand panel, Save.

Step 3 is the only one that needs teaching. Confirm the exact wording and whether
the assignment is automatic in the dev theme before writing it into a runbook —
Shopify has changed this dialog's copy more than once, and the runbook should
match what the editor actually says.

## What this is, and what it is not

It is: pick from an approved set of bands, reorder them, set their words, images,
ground and spacing, with live preview and undo.

It is not a free canvas. Nothing can be dragged to an arbitrary position, and
there is no way to set a one-off margin or colour.

**That is the right constraint here, not a limitation to route around.** Every
value in `app/globals.css` was measured off the Figma content streams — 415×519
card media, 20px gutter, 176px band rhythm, six grounds. A free canvas hands a
non-technical editor the ability to break that in five minutes with nothing to
revert to. What they actually need is to compose from approved parts, which is
what this is.

If free-form layout is genuinely required, neither Shopify nor a custom builder
on top of this design system is the answer, and that is a different conversation
about what the brand guidelines are for.

## The standard every section must meet

A section that editors can put on a page they invented cannot assume anything
about where it sits. Three rules, and they are why `sb-media-text` and
`sb-rich-text` look the way they do:

**1. A `presets` block, or it is invisible.** Without one the section never shows
in Add section, no matter how good its schema is. `sb-header` and `sb-footer` are
the deliberate exceptions — they carry `enabled_on: { groups: [...] }` instead,
because a header inside a page body is never right.

**2. The two universal settings: `surface` and `rhythm`.** Every band paints its
own ground and sets its own vertical space, because the section above and below
it are chosen by someone else. `surface: inherit` must be the default: a band
that forces a colour onto a page that already has one is the most common way a
composed page ends up looking wrong.

**3. Every part optional.** No heading, no image, no button — the section still
renders correctly. An editor discovers what a block does by emptying fields and
seeing what happens, and a section that breaks when a field is blank is a section
they will stop using.

**4. The Style tab: `render 'sb-section-style', settings: s`.** The builder's Style
tab (colours, custom spacing, line, corners) is the same set of settings on every
section, generated into its schema under a "Style" header. One snippet reads them
all and writes the attributes — put it on the section's outer element, before
`{{ section.shopify_attributes }}`. A section that already has a `style` attribute
passes it as `extra_style` so there is only one. `yarn check:liquid` counts the
Style settings as read only when this exact render is present.

One more, for whoever adds the next section: **classes assembled from a setting
are invisible to Tailwind.** `section-{{ s.rhythm }}` is never emitted. That is
what `snippets/sb-section-classes.liquid` is for — write the options out as
literals in a `case`.

## The library so far

| Section | Preset | Use |
|---|---|---|
| `sb-page-content` | Page content | The title and body typed in admin |
| `sb-rich-text` | Text · Contact call to action | A band of copy with a button |
| `sb-media-text` | Media and text | Image beside copy, either side — shape, width, alignment, small label |

### The landing sections (page builder parity)

These sixteen are the Liquid halves of the Next page builder's landing sections
(`lib/page-builder/sections-landing.ts`). Same settings, same presets with the same
demo copy, same drawing — one band, two renderers.

| Section | Builder type | Presets |
|---|---|---|
| `sb-banner` | `image_banner` | Image banner · text in the corner · with text panel · short |
| `sb-slideshow` | `slideshow` | Slideshow |
| `sb-cta-banner` | `cta_banner` | Call to action · split · on a photograph |
| `sb-multicolumn` | `multicolumn` | Columns with images · Icon features · Cards · Text columns |
| `sb-stats` | `stats` | Numbers |
| `sb-steps` | `steps` | Steps · Timeline |
| `sb-tabs` | `tabs` | Tabs |
| `sb-collapsible` | `collapsible` | Collapsible content |
| `sb-video` | `video` | Video (nothing loads from YouTube/Vimeo before play) |
| `sb-marquee` | `marquee` | Scrolling text |
| `sb-collage` | `collage` | Collage · Image grid with titles |
| `sb-testimonials` | `testimonials` | Testimonials · Large quote |
| `sb-logo-list` | `logo_list` | Logo list |
| `sb-featured-product` | `featured_product` | Featured product |
| `sb-spacer` | `spacer` | Spacer · Divider |
| `sb-newsletter` | `newsletter` | Newsletter sign-up |

`sb-banner` is the banner WITH copy; `sb-image-banner` stays the full-bleed image
alone (the builder's `full_image`).

**Their `{% schema %}` is generated, not written.** `yarn liquid:schemas` derives
each one from the Next definition and its presets (`scripts/lib/liquid.ts`); only
the markup above it is hand-written. Behaviour is in `assets/sb-sections.js`
(slideshow, tabs, video) and the icons in `snippets/sb-section-icon.liquid`,
generated from lucide by `yarn liquid:icons`.

**Keeping the two in step.** `yarn check:liquid` fails when a theme section is
missing, its schema is stale, a setting has different options, defaults or
ranges, a preset is missing, a block type differs, the markup never reads a
setting it offers, or the icon snippet is out of date. After changing a builder
section: `yarn liquid:schemas`, update the markup, `yarn theme:build`,
`yarn check:liquid`.

`sb-rich-text` replaced three hard-coded Next components that differed only in
their words: `IntroBlock` on the landing page, `ContactCta`, and the lede on half
the content pages. Both of its presets are the same file configured differently,
which is the pattern to repeat — a preset costs a few lines and saves an editor
from configuring a common block by hand.

Still to build, in phase order: image banner, gallery grid, product rail,
collection rail, FAQ accordion, captioned row, Instagram row, contact channels.
Each is already scoped as a port of its Next component; the change this
requirement makes is that each one now also needs a preset and must work on a
page nobody has designed.

## Testing without the store

`shopify theme dev` needs a login to the store, which an agent or CI does not have.
Everything below runs locally, without Shopify:

| Command | What it proves |
|---|---|
| `yarn check:liquid` | Each theme section matches its page-builder twin — schema, options, defaults, blocks, presets, every setting read by the markup, icons, and the generated design snippet, Site style and fonts (`yarn liquid:design`) |
| `yarn check:liquid-render` | The design snippet writes exactly what the Next builder writes, for every design control; a designed section is drawn right on desktop and phone. Each section **renders**: every preset, and every field empty (live and in the editor). It runs in Chromium with the built CSS and the theme's JS, at 1440px and 390px: no overflow, no console errors, and tabs, video and slideshow working. Screenshots and an `index.html` with all of them are written to the temp folder — open it in a browser to look |
| `yarn theme:check` | The compiled `assets/sb-theme.css` is up to date with the sections |
| `yarn theme:lint` | Shopify Theme Check — Liquid syntax, schema validity, missing translations |

`check:liquid-render` uses liquidjs with Shopify's filters and tags stubbed, and
mock drops (a product, CDN photographs). A missing translation key fails it, as it
would print "translation missing" on the store. `--only sb-banner,sb-tabs`
renders just those sections.

What only the store can show: the theme editor's settings panel, real drops
(metafields, product data), and JSON templates assembled into a page. For that
without an interactive login, install Shopify's **Theme Access** app, create a
password for the theme, and run, e.g.
`SHOPIFY_CLI_THEME_TOKEN=… shopify theme dev --store studio-bizar-be --path theme`.
That serves an unpublished development theme — the live theme is untouched — and
the password can be revoked from the app at any time.

## What does not change

Content stays in the Next admin panel. Metaobjects, products, collections,
media — `/admin` handles those far better than Shopify's own screens, and the
theme reads what it writes. The division is by frequency: content changes daily
and belongs in a table; layout changes a few times a year and belongs in a
preview. Neither tool is doing the other's job badly.
