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

One more, for whoever adds the next section: **classes assembled from a setting
are invisible to Tailwind.** `section-{{ s.rhythm }}` is never emitted. That is
what `snippets/sb-section-classes.liquid` is for — write the options out as
literals in a `case`.

## The library so far

| Section | Preset | Use |
|---|---|---|
| `sb-page-content` | Page content | The title and body typed in admin |
| `sb-rich-text` | Text · Contact call to action | A band of copy with a button |
| `sb-media-text` | Media and text | Image beside copy, either side |

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

## What does not change

Content stays in the Next admin panel. Metaobjects, products, collections,
media — `/admin` handles those far better than Shopify's own screens, and the
theme reads what it writes. The division is by frequency: content changes daily
and belongs in a table; layout changes a few times a year and belongs in a
preview. Neither tool is doing the other's job badly.
