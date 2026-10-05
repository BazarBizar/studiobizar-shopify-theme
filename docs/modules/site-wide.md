# Site-wide

One admin screen, `/admin/site-wide`, with a tab per setting that belongs to the whole site rather than
to one page. Every tab is a **metaobject in Shopify**. The panel stores nothing of its own: it reads each
definition and renders the form or table from it.

| Tab | Metaobject type | Kind | Storefront access | Read by |
|---|---|---|---|---|
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

## Admin panel (`admin_settings`)

| Field | Type |
|---|---|
| `panel_title`, `panel_initials` (max 3) | `single_line_text_field` |
| `favicon` | `file_reference` (image) |

- These fields control the sidebar name, the square with the initials, the browser-tab title
  (`%s · <title>`) and the admin favicon.
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

## Pitfalls

These are the same as for every metaobject:

- Every value is a string. Booleans are `"true"`/`"false"`, and `Boolean("false")` is `true`.
- `list.*` values are a JSON array stored as a string.
- `file_reference` fields store a GID and must be resolved before you have a URL.
