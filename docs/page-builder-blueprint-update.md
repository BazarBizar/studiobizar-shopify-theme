# Page Builder Blueprint — update (since 2026-10-28)

Only what changed on top of [page-builder-blueprint.md](page-builder-blueprint.md).

## Menus (Website → Menus)

- **Create / delete menus.** The site's own five (Main, Second, Footer About / Info / Legal) keep
  their handle and cannot be deleted or emptied. A menu used by an Appearance layout cannot be
  deleted.
- **Links three levels deep.** Drag to move; drag right to nest under the link above, left to take
  it out. The ⋯ menu does the same from the keyboard.
- **Link picker, as in Shopify:** Home, Search, Collections, Products, Pages, Product types,
  Vendors, Designers, Projects, Policies, Customer account, Web address.
- **Collection filtered by tags.**
- **On the site (Next + Liquid):** dropdown, **mega menu** (when a third level exists), phone
  drawer that opens each level in place.

## Appearance (was "Header & footer")

- Four tabs: **Header, Footer, Site style, Pop-ups**.
- The Menu element can show any menu. *Show sub-links in a dropdown* is on by default for the main
  menu.
- **Announcement bar:** up to 8 messages, each with its own link and dates; one at a time or
  scrolling across; visitors can close it; colours; per device.
- **Pop-ups:** up to 10, at most one opens per page. Content | Style tabs like a section.
  - Shape: box in the middle, box in a corner, bar along the bottom.
  - Opens after N seconds, after scrolling N%, or when the pointer leaves through the top.
  - How often, which pages, which devices, dates.
  - Style: background, spacing, border & shadow, typography, buttons (filled / outlined /
    underlined), images, size per device, page behind it, close button, animation.
  - Four ready-made starts.
- Announcement bar and pop-ups: **Next only** for now, not yet in Liquid.

## Site-wide (Settings → Site-wide)

- New **Logo, icon & SEO**: website name, logo, small logo, logo colours, browser tab icon,
  description for search engines, share image, browser colour on phones, Google Search Console
  code. Next + Liquid. Every field may be empty.

## Page builder

- **`innerSpacing` removed.** Padding always offers four sides. Image banner and Hero slider: top
  and bottom move the text away from the photo's edges; the height stays the Height choice.
- **An image someone added always shows.**
  - Columns: "Media" only decides what fills a column without an image. "Image shape" is always
    offered.
  - Steps: the "Show images" switch is gone.
- **Marquee:** a phrase can link; the strip stops under the pointer.
- **New field kind `color`:** swatch, hex, Clear.
- **Suggest field `menus`:** pick a menu; a deleted one shows "(deleted)".

## Checks

- `yarn audit:page-builder` — every setting must show or change something on Next and Liquid.
- `yarn check:menus` — addresses, filter, tree changes, the three-level limit.
- `yarn check:site-identity` — logo, icon and SEO reading, unsafe URLs refused.
