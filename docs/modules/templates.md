# Templates (Website → Templates)

The pages drawn from an item, not written one by one, each have ONE layout that staff edit with
the page builder. Change the product page template once and every product page follows. Elementor
calls these Theme Builder templates; Shopify calls them `templates/product.json` and friends.

| Template | Pages | Its own sections |
|---|---|---|
| Product page | `/shop/<product>` | Product details (photos + parts: path, name, designer, description, photos in a room, details, price note, inquiry button, fold-out panels, your own text), The idea, About the designer, More from the collection, You may also like |
| Collection page | `/collections/<collection>` | Collection photo and name, The idea, About the designer, Collection pieces, Projects with this collection |
| Project page | `/projects/<project>` | Project photo, Project story, Pieces in this project, Other projects |
| Designer page | `/designers/<designer>` | Designer profile, Pieces by the designer, Their collections, Projects with their pieces |
| All products | `/shop` (filters, sort) | Products with filters |
| Search results | `/search` | Search box and results |
| All collections | `/collections` | Collections list |
| All projects | `/projects` (filter, view) | Projects with filters |

Every ordinary section (banners, Custom section, rich text, FAQ…) can be used in a template too.
A template's own sections are offered only in that template. The write paths refuse them on a page,
in another template, and in the header and footer (`misplacedSections`, `AREA_EXCLUDED_SECTIONS`).

`/designers` (the list) is not a template: it is the builder page `professionals`. `/legal/*` render
the Shopify page body. There is no blog in this store.

## Layout settings (Content tab)

Each template section has, beside what it shows, the layout controls the landing sections have
(`lib/page-builder/template-look.ts`). All default to "As designed", which adds nothing to the page.

- **Headings:** heading or name size (Small to Extra large), colour, and alignment.
- **Cards** (lists and product rows):
  - cards across on desktop and on phones, and the space between them (grids only; Shop and Search
    keep the visitor's own S / M / L);
  - photo shape and photo corners;
  - a colour over the photos, with its strength;
  - card style: plain, on a coloured card, with a border, or divided by lines; plus the card or border colour;
  - name size, name colour, and text alignment.
- **Collection cards' three texts**, each with a size (Small, Medium, Large, Extra large) and a
  colour: *Title on the photo* (the name in large letters, or the logo's width), *Collection name*
  (under the photo) and *Designer* (the "by …" line, `data-byline`). They replace the generic Name
  size / colour on collection lists (`collectionTextFields`; `cardFields({ names: false })`). Also on
  the page sections *Collection carousel* and *Collection grid*, with the card settings above, through
  the shared `Look` wrapper (`components/page-builder/card-look.tsx`). The colour over the photos is
  drawn under the title, so it makes the title readable instead of dimming it.
- **Product rows:** “view all” on or off, its text, and its position.
- **Photo beside text** (The idea, About the designer): photo width, photo shape, text position,
  width, and link style.
- **Photo headers** (collection, project): a colour over the photo with its strength; for the
  collection, the name's size and colour.
- **Product details:** how much room the photos take, the space between photos and details, details
  that stay in view while scrolling, and the name's size, colour and alignment.
- **Project story:** credits beside or above the story. **Designer profile:** portrait shape and corners.

The cards are restyled without changing their components. A wrapper carries `data-tl-*` attributes and
custom properties, and `styles/sb-template-look.css` draws them. A card is an `li` or a carousel slide,
its photo is the box holding the `<img>`, and its name is its `h2`/`h3`.

## How a page uses its template

```
route: load item + getPublishedTemplate(kind)
  ├─ template published → <BuilderPage doc={template} record={item} before={JSON-LD} />
  └─ none / unreadable  → the route's own JSX, unchanged
```

Until a template is first published, its route draws the layout in its code, exactly as before. The
editor opens on `defaultTemplateContent(kind)`, which reproduces that layout section for section.
`yarn check:templates` proves this tag for tag on real items, then tries every setting of every
template section (see Checks below).

Each section reads the item from `context.record` (`TemplateRecord` in
`components/page-builder/renderer-kit.ts`). Where an item lacks what a section shows (a product with
no designer), the live page leaves the section out, as the route did. The editor's preview shows a
dashed note instead, so a section never seems to vanish.

## How a designer is linked

A product and a collection each name a designer (`custom.designer`). A project names none: it lists the
products it used (`featured_items`). So a designer's **collections** are those that name them, their
**products** those collections' products, and their **projects** those listing one of those products
(`getProductsByDesigner`, `getProjectsByDesigner` in `lib/shopify`; the theme checks a product's own
designer and its collections'). The designers list (`/designers`, the builder page `professionals`,
section *Designers*) has the card settings too, plus *Show the studio under the name* and *Photos in
black and white*.

## Data

Three JSON metafields per template on the SHOP, like the header and footer:

| Key | Storefront | Holds |
|---|---|---|
| `custom.template_<kind>` | `PUBLIC_READ` | published — the only one the storefront reads |
| `custom.template_<kind>_draft` | none | the working copy the editor autosaves |
| `custom.template_<kind>_previous` | none | what the last publish replaced (rollback) |

The document is a page builder document (`PageDocument`). The published copy's definition is created
on the first publish (`ensureShopJsonDefinition`). `schema-push` lists all 24 for a fresh store.

## Editor

`/admin/templates` lists the eight templates with their status:

- **Original layout**: never edited.
- **Not in use yet**: edited, not published.
- **Changes not published**.
- **In use**.

`/admin/templates/<kind>` is the page builder (`PageBuilder` with `template`). The differences from
a page:

- It saves through `/api/admin/templates`.
- **Preview with** picks the product, collection, project or designer to draw. Search results take a word.
- Add section lists the template's own sections first, under the page's name.
- ⋮ → **Stop using this template** removes the published copy, so the pages go back to their original
  layout. The draft is kept, and *Load previously published version* brings the template back.
- Before the first publish, *Discard* becomes **Start again from the original layout**.

Pointers: Pages has a banner leading to Templates. Each product and collection screen has a
**Page layout** button.

## Caching

`getPublishedTemplate(kind)` is cached under `content` and `template:<kind>`. Publish and Stop using
drop only `template:<kind>` (`tagsForType("template", kind)`): at once, and again once the
Storefront API serves the new copy (up to about half a minute).

## Files

| Path | Role |
|---|---|
| `lib/page-builder/template-kinds.ts` | the eight kinds, labels, paths, metafield keys |
| `lib/page-builder/sections-template.ts` | the templates' own sections |
| `lib/page-builder/template-defaults.ts` | each template's original layout |
| `components/page-builder/renderers-template.tsx` | how they draw (the routes' markup) |
| `components/page-builder/template-record.ts` | preview items and the item loader (panel) |
| `lib/admin/templates.ts` | read / save / publish / discard / rollback / stop using / list |
| `app/api/admin/templates/route.ts` | the write endpoint |
| `app/(admin)/admin/templates/**` | the list and the editor |
| `app/(admin)/preview/templates/[kind]` | the draft preview |

## Checks

```bash
yarn check:templates    # offline apart from reading the store: route JSX vs original template, tag for tag,
                        # on 24 real pages; then every template section setting must change the page
yarn check:page-builder # includes: originals pass the write schema, sections offered only where they belong
yarn check:admin-ops    # the four template operations parse against Shopify (nothing written)
```

## The Liquid theme

Each template section has its theme twin, `theme/sections/sb-t-<type>.liquid`, listed in
`LIQUID_SECTIONS` (`scripts/lib/liquid.ts`). Its schema is generated from the Next fields
(`yarn liquid:schemas`), with `enabled_on` set to the Shopify template that draws the same
pages (`TEMPLATE_THEME_TEMPLATES`):

| Template | Theme template | Sections |
|---|---|---|
| Product page | `templates/product.json` | `sb-t-product-*` |
| Collection page | `templates/collection.json` | `sb-t-collection-*`, then Go back |
| Project / Designer page | `templates/metaobject/project.json`, `designer.json` | `sb-t-project-*`, `sb-t-designer-*` |
| All products | `templates/collection.shop.json` (assign it to the `all` collection, or `?view=shop`) | `sb-t-shop-main` |
| Search results | `templates/search.json` | `sb-t-search-main` |
| All collections | `templates/list-collections.json` | `sb-t-collections-main` |
| All projects | `templates/page.projects-list.json` (a new page template; `page.projects.json` is left as it was) | `sb-t-projects-main` |

Each JSON template holds the original layout, written from `defaultTemplateContent`. The
Collection page's *Contact* band has no theme section yet, so it is left out there.

The card settings are the same attributes in both builds: `snippets/sb-template-look.liquid`
writes what `cardLook` writes, and `styles/sb-template-look.css` is in both stylesheets.
`snippets/sb-template-heading.liquid` is `headingLook`; `snippets/sb-template-rail.liquid` is
the scrolling product row.

Checks: `yarn check:liquid` (schemas, every setting read), `yarn check:liquid-render` (every
section drawn with a sample product, collection, project and designer; the card look compared
with `cardLook` value for value).

The theme reads the item from Shopify's own objects (`product`, `collection`, `metaobject`),
not the template documents the panel saves — Shopify's templates are its JSON files, edited in
the theme editor.

## Not yet

- **Per-item templates.** Elementor conditions and Shopify `template_suffix`, e.g. a different layout
  for one collection.
- **Dynamic text in ordinary sections**, e.g. a heading that says "More by {designer}".
- **A blog.** It would need articles in Shopify first; its template would follow the same pattern.
