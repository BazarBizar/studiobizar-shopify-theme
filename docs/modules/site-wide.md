# Site-wide

One admin screen, `/admin/site-wide`, with a tab per setting that belongs to the whole site rather than
to one page. Every tab is a **metaobject in Shopify**. The panel stores nothing of its own: it reads each
definition and renders the form or table from it.

| Tab | Metaobject type | Kind | Storefront access | Read by |
|---|---|---|---|---|
| Logo, icon & SEO | `site_identity` | singleton | `PUBLIC_READ` | Both storefronts: Next (`getSiteIdentity`) and Liquid (`shop.metaobjects.site_identity`) |
| Site settings | `site_settings` | singleton | `PUBLIC_READ` | Storefront (footer, CTA, socials, featured collections) |
| Locations | `location` | collection | `PUBLIC_READ` | Storefront (Our Locations, page metafields) |
| Contact channels | `contact_channel` | collection | `PUBLIC_READ` | Storefront (Contact page) |
| Email notifications | `email_notification` | collection | `NONE` | Server (`lib/email/notification-recipients.ts`) |
| Admin panel | `admin_settings` | singleton | `NONE` | Panel (`lib/admin/admin-settings.ts`) |

**Access rule:** a type is `PUBLIC_READ` only when the storefront renders it. Anything read only by the
server (email routing, submissions, panel branding) is `NONE`. `scripts/set-private-access.mjs`
enforces this on existing definitions.

## How a tab behaves

- **Singleton:** the tab *is* the edit form for the first entry. With no entry, the tab shows the
  command that creates one.
- **Collection:** the tab embeds the same table as the type's list screen, with a **New** button.
  Rows open `/admin/<type>/<id>`, and that screen's back link returns to the tab.
- A tab appears only when its definition exists in the store.
- The old list URL `/admin/<type>` redirects to the tab, so breadcrumbs and bookmarks still work.
- These types are hidden from the sidebar. The **Site-wide** row stays highlighted on their entry
  screens.

## Logo, icon & SEO (`site_identity`)

Created by `scripts/add-site-identity.mjs` (`yarn setup:site-identity`). The script is idempotent. The entry `site-identity` is seeded with the name and description the site already used.

| Field | Type | Used for |
|---|---|---|
| `site_name` | text (required) | Title template `%s · <name>`, `og:site_name`, `application-name`; in Liquid, the `<title>` suffix |
| `logo`, `logo_mark` | image | Replace `public/brand/logo.svg` / `mark.svg` everywhere `<Logo>` / `sb-logo` is drawn |
| `logo_colour` | `text` / `original` | `text` draws the upload as a mask in the text colour, like the original. `original` draws it as a picture. |
| `favicon` | image | `<link rel=icon>` (64 px) and `apple-touch-icon` (180 px), via the Shopify CDN |
| `meta_description` | multi-line text | `<meta name=description>` for pages without their own |
| `share_image` | image | `og:image` for pages without their own photo; switches the Twitter card to `summary_large_image` |
| `theme_color` | color | `<meta name=theme-color>` |
| `google_verification` | text | `google-site-verification`. Either the code or the whole pasted tag is accepted. |

Every field may be empty, and an empty field changes nothing.

**Next**
- **Metadata:** `app/(storefront)/layout.tsx` builds it in `generateMetadata` / `generateViewport`.
- **No og title or description in the layout:** the layout does not set `og:title` or `og:description`. Next derives them from each page, and a fixed value would override them. Pages that set their own `openGraph` (product, project, designer, collection) replace the default as a whole, photo included.
- **Logo:** `<SiteIdentityStyle>` in `PageShell` writes custom properties that `styles/sb-logo.css` reads. `<Logo>` itself stays a plain component that client components can render too. Only a plain https URL is ever written into that `<style>`.
- **Favicon file:** the favicon moved from `app/favicon.ico` to `public/favicon.ico`. A favicon in `app/` is file-based metadata, which always wins, so no setting could replace it.

**Liquid**
- `theme.liquid` reads the entry for the icon, theme colour, verification tag, title suffix and description.
- `sb-meta-tags` reads it for the site name, share image and description.
- `sb-logo` reads it for the logo.
- Each falls back to the theme setting or `shop.name`.

**Timing:** a save reaches the storefront in about 40 seconds. That is Shopify's Storefront API catching up, behind the panel's second cache drop.

Checks: `yarn check:site-identity` (offline: reading, the logo stylesheet, refusal of unsafe URLs, Google's code).

## Admin panel (`admin_settings`)

| Field | Type |
|---|---|
| `panel_title`, `panel_subtitle`, `panel_initials` (max 3) | `single_line_text_field` |
| `logo`, `favicon` | `file_reference` (image) |
| `dashboard_title` | `single_line_text_field` |
| `dashboard_description` | `multi_line_text_field` |

- These fields control the sidebar name and the line under it (default "Admin"), the square beside it
  (the logo when set, otherwise the initials), the browser-tab title (`%s · <title>`), the admin
  favicon, and the heading and sentence on the dashboard (`/admin`).
- The sign-in page (`/staff/login`) shows the same title and logo.
- Empty text fields fall back to the old hardcoded wording.
- The values are cached for 60 seconds, and saving clears the cache on the instance that handled the
  save.
- On any failure the panel falls back to "Studio Bizar" / "SB" and the site favicon. It never throws.
- Light/dark mode is deliberately not stored here. It is each person's own preference.

## Adding a tab

1. Create the definition and, for a singleton, its entry. Follow the pattern of the idempotent,
   additive-only scripts: `scripts/add-site-settings.mjs`, `add-email-notifications.mjs` and
   `add-admin-settings.mjs`.
2. Add a row to `SITE_WIDE_SECTIONS` in `lib/admin/site-wide.ts`. Its position sets the tab order, and
   the row holds the label, `singleton` or `collection`, a one-line description, and the setup command.
3. Optionally, add a module in `lib/admin/modules.ts` for columns and search fields, and set
   `deletable: false` on a singleton.
4. If the storefront must not read the type, add it to `PRIVATE_TYPES` in
   `scripts/set-private-access.mjs`.
5. Give each field a plain label and one line of help in `lib/admin/field-copy.ts` (see below).

## Words on screen (`lib/admin/field-copy.ts`)

The panel is used by people who do not know Shopify's vocabulary, so no screen shows a field key,
a gid, JSON or a type name.

- **Field labels and help** for every metaobject type and for product metafields (`product`) live in
  `FIELD_COPY`. A field with no entry falls back to its Shopify name and description, so add one
  whenever a field is added in Shopify.
- **`choiceLabels`** gives a stored code a name (`product_inquiry` → "Product inquiries"), in forms
  and in tables.
- **`hidden`** keeps a field off the form while still sending its value. A module's `orderField` is
  always hidden: rows are reordered by dragging in the list, which saves the new positions, and a
  new entry goes to the end of the list.
- A module's `singular` and `description` (`lib/admin/modules.ts`) name the "New …" button and the
  sentence under a list's title.

## Pitfalls

These are the same as for every metaobject:

- Every value is a string. Booleans are `"true"`/`"false"`, and `Boolean("false")` is `true`.
- `list.*` values are a JSON array stored as a string.
- `file_reference` fields store a GID and must be resolved before you have a URL.
