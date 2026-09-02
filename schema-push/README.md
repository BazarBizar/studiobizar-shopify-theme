# schema-push

Provisions the Studio Bizar / DESK catalogue schema — every **metaobject definition** and
**metafield definition** — plus the storefront navigation it hangs off — the **pages** and
**menus** behind the header and footer — on a Shopify store through the Admin GraphQL API,
so nobody has to click through hundreds of fields in the admin.

The storefront stays a Liquid theme (Dawn). This is a one-off provisioning tool that is
safe to re-run.

- **Additive only.** It never updates, overwrites, or deletes an existing definition.
- **Idempotent.** Anything already present is reported as `SKIP (exists)`.
- **No dependencies.** Node 20+ and the built-in `fetch`. Nothing to `npm install`.

---

## 1. Create a custom app in Shopify

1. Shopify admin → **Settings** → **Apps and sales channels**
2. **Develop apps** → *Allow custom app development* if you have not already
3. **Create an app** → name it e.g. `Schema Push`
4. **Configure Admin API scopes** and tick the scopes in the next section
5. **Save**, then **Install app**
6. **API credentials** → **Reveal token once** → copy the `shpat_…` Admin API access token

The token is shown exactly once. Copy it straight into `.env`.

## 2. Required Admin API scopes

| Scope | Needed for |
|---|---|
| `read_metaobject_definitions` | reading existing metaobject definitions (`verify`, idempotency check) |
| `write_metaobject_definitions` | `metaobjectDefinitionCreate`, `metaobjectDefinitionUpdate` |
| `read_products` | reading PRODUCT and COLLECTION metafield definitions |
| `write_products` | creating PRODUCT and COLLECTION metafield definitions |
| `read_content` | reading PAGE metafield definitions and existing pages |
| `write_content` | creating PAGE metafield definitions and pages |
| `read_online_store_navigation` | reading existing menus (`verify`, idempotency check) |
| `write_online_store_navigation` | `menuCreate`, `menuUpdate` |

`read_legal_policies` is optional: with it, the footer's LEGAL menu links to the store's
Shopify policies; without it, it links to the four legal pages this script creates.

`read_metaobjects` / `write_metaobjects` (entries, not definitions) are **not** required —
this script only touches definitions.

## 3. Install and run

```bash
cd schema-push
cp .env.example .env      # then paste your token in
```

`.env` is read from `schema-push/.env` first, then falls back to the repo-root `.env`
one level up. If the root `.env` already holds `SHOPIFY_STORE_DOMAIN` and
`SHOPIFY_ADMIN_API_ACCESS_TOKEN`, you can skip the copy entirely.

```bash
node index.js verify              # list what already exists — changes nothing
node index.js push --dry-run      # print the plan — changes nothing
node index.js push                # create everything that is missing
```

Scoped runs:

```bash
node index.js push --only=metaobjects
node index.js push --only=metafields
node index.js push --only=pages             # every page behind the nav
node index.js push --only=menus             # the five header/footer menus
node index.js push --only=designer          # the designer metaobject + designer metafields
node index.js push --only=product           # every PRODUCT metafield
node index.js push --only=product.designer  # one definition
node index.js push --only=faq,desk-primary  # one page and one menu, by handle
```

Other flags:

| Flag | Effect |
|---|---|
| `--dry-run` | Print the plan, send no mutations |
| `--no-pin` | Do not pin new metafield definitions in the admin UI (pinned by default) |
| `--no-patch` | Do not append missing fields to definitions that already exist |
| `--verbose` | Log GraphQL query cost and throttle status per request |

Exit code is `1` if anything failed, `0` otherwise — safe to use in CI.

Or via npm scripts: `npm run verify`, `npm run plan`, `npm run push`.

---

## What gets created

**Metaobject definitions** (in this order — the order matters, see below):

| Type | Fields | Publishable |
|---|---|---|
| `captioned_image` | 4 | no |
| `designer` | 8 | yes |
| `project` | 16 | yes |
| `contact_channel` | 5 | no |
| `faq_item` | 4 | no |

**Metafield definitions**, all in the `custom` namespace: 18 on `PRODUCT`, 10 on
`COLLECTION`, 8 on `PAGE`.

Both are created with `access: { storefront: PUBLIC_READ }` so the Liquid theme and the
Storefront API can read them.

**Pages** — the eleven destinations the header and footer point at. `projects` and
`contact` get a template suffix so they render `templates/page.projects.json` and
`templates/page.contact.json`; the rest get a one-line placeholder body to replace in the
admin. All are created published, otherwise the nav links 404.

| Handle | Title | Template |
|---|---|---|
| `our-story` | Our Story | |
| `our-services` | Our Services | |
| `projects` | Projects | `projects` |
| `professionals` | Professionals | |
| `faq` | FAQ | |
| `careers` | Careers | |
| `contact` | Contact | `contact` |
| `privacy-policy` | Privacy Policy | |
| `terms-conditions` | Terms & Conditions | |
| `shipping-delivery` | Shipping & Delivery | |
| `returns-refunds` | Returns & Refunds | |

**Menus** — one per nav in the design, wired up in
`shopify_theme/sections/header-group.json` and `footer-group.json`:

| Handle | Where | Items |
|---|---|---|
| `desk-primary` | header, left of the wordmark | Products · Collections · Projects · Services |
| `desk-secondary` | header, right cluster | About · Info · Professionals |
| `desk-footer-about` | footer, ABOUT column | Our Story · Our Services · Projects · Items |
| `desk-footer-info` | footer, INFO column | FAQ · Careers · Contact |
| `desk-footer-legal` | footer, LEGAL column | Privacy Policy · Terms & Conditions · Shipping & Delivery · Returns & Refunds |

### Five things worth knowing

**Dependency order.** `project.gallery` points at `captioned_image`, and
`product.designer` points at `designer`. A reference field needs the target definition's
`gid`, which only exists after the target has been created. The script walks
`src/definitions/metaobjects.js` top to bottom, keeps a `type → gid` map in memory, and
pushes metaobjects before metafields. Reordering that array will break things.

**The `project` self-reference.** `project.related_projects` is a
`list.metaobject_reference` pointing at `project` itself — a chicken-and-egg problem,
because the gid does not exist until the create call returns. That field is marked
`deferred: true`: it is left out of `metaobjectDefinitionCreate`, then appended in a
second pass with `metaobjectDefinitionUpdate` once the gid is known. The second pass only
ever sends `{ create: … }` operations for keys that are absent, so re-running is safe.

**Throttling.** The Admin API uses a cost-based leaky bucket. Every response carries
`extensions.cost.throttleStatus`; the client reads it and sleeps pre-emptively when
`currentlyAvailable` drops low, rather than waiting to be rejected. `THROTTLED`, HTTP 429
and 5xx are retried up to 5 times with exponential backoff and jitter; HTTP 429 honours
`Retry-After`.

**`userErrors` are not exceptions.** Shopify returns HTTP 200 even when a mutation is
rejected. Every mutation result is checked for `userErrors` and both `field` and `message`
are printed.

**Pages before menus.** A `PAGE` menu item needs the page's gid, the same way a
`metaobject_reference` metafield needs the metaobject definition's gid, so the phases run
metaobjects → metafields → pages → menus. `push --only=menus` still works on its own: the
handles are looked up in the store instead. Anything that will not resolve — a page that
does not exist, a collection nobody has created yet, a `MenuItemType` this API version does
not know — degrades to a plain HTTP link to the canonical storefront path and logs a
warning, so a menu is never created with a dead item.

**Not `main-menu`, not `footer`.** Those two handles exist on every Shopify store,
pre-filled with Shopify's own links. Pushing into them would either be skipped (leaving
Home/Catalog/Contact live) or clobber a nav someone had already built, so the five menus
get their own handles and the theme's section groups point at those. Shopify's defaults
are left untouched — `verify` lists them under "other menus in store".

---

## Adding a definition later

**A new metafield** — add an entry to the right array in
`src/definitions/metafields.js`:

```js
{ key: 'warranty_years', name: 'Warranty (years)', type: 'number_integer' }
```

**A new metaobject** — append to `metaobjectDefinitions` in
`src/definitions/metaobjects.js`. Put it *after* anything it references:

```js
{
  type: 'material',
  name: 'Material',
  displayNameKey: 'name',
  publishable: false,
  fields: [
    { key: 'name', name: 'Name', type: 'single_line_text_field', required: true },
    { key: 'swatch', name: 'Swatch', type: 'file_reference', validations: [IMAGE_ONLY] },
  ],
}
```

**Referencing another metaobject** — use the `metaobjectRef` placeholder rather than a
hard-coded gid. It is resolved at runtime:

```js
{ key: 'materials', name: 'Materials', type: 'list.metaobject_reference',
  validations: [metaobjectRef('material')] }
```

**Restricting values** — `choices('A', 'B')` for a fixed set,
`IMAGE_ONLY` to keep a `file_reference` to images.

**A new page** — append to `pageDefinitions` in `src/definitions/pages.js`:

```js
{ handle: 'press', title: 'Press', body: '<p>…</p>' }
```

Add `templateSuffix: 'press'` if the theme has a `templates/page.press.json` to match.

**A new nav item** — add it to the right menu in `src/definitions/menus.js`. One
destination key per item:

```js
{ page: 'press' }                     // PAGE, resolved from the page handle
{ collection: 'new-in' }              // COLLECTION, resolved from the handle
{ type: 'COLLECTIONS' }               // a bare MenuItemType, no resource
{ policy: 'PRIVACY_POLICY',
  page: 'privacy-policy' }            // the shop policy if written, else the page
{ url: 'https://instagram.com/…' }    // HTTP
```

`fallbackType` covers a collection that does not exist yet — `Products` uses
`{ collection: 'shop-all', fallbackType: 'CATALOG' }` so it points at `/collections/all`
until someone creates the catalogue collection.

Then run `node index.js push --dry-run` and, if the plan looks right, `node index.js push`.
Existing definitions, pages and menus are skipped; only the new ones are created.

---

## Warnings

- **This script deletes nothing.** There is no `metaobjectDefinitionDelete` or
  `metafieldDefinitionDelete` anywhere in it, by design. Removing a definition means
  deleting the data stored under it, so that stays a deliberate manual action in the admin.
- **It does not change existing definitions either.** If a definition already exists with
  the wrong type, `verify` reports `TYPE MISMATCH` but the script will not touch it — fix
  it by hand in the admin. The same goes for content: a page that already exists keeps its
  title, body and published state, and an existing menu keeps its items, titles and order.
- The exceptions are all additive patches, disabled together by `--no-patch`: fields
  missing from an existing metaobject definition are appended, a menu missing an item this
  script declares gets it appended at the end, and a page with *no* template assigned gets
  the one it expects. A page carrying a *different* template suffix is reported and left
  alone.
- **`shop-all` does not exist yet.** The header's "Products" and the footer's "Items"
  want the catalogue collection, which is created by hand in the admin (and given the
  `collection.shop-all` template suffix — see `shopify_theme/README.md`). Until then both
  point at `/collections/all` and the push logs a warning. Re-point them by creating the
  collection and re-running with `--only=menus`… which will skip, because the menu already
  exists — change the two items in the admin instead, or delete the menu and re-push.
- **Never commit `.env`.** It is already covered by the repo `.gitignore` (`.env*`).
  If a token leaks, uninstall the custom app in the Shopify admin to revoke it.
