# Studio Bizar

A Next.js 16 (App Router) storefront for Studio Bizar, plus a custom admin panel
at `/admin` that replaces the Shopify admin UI for day-to-day content and
catalogue work.

Shopify is the only data store. There is no external database: content lives as
metaobjects, and products, collections and customers are ordinary Shopify
resources.

```bash
yarn dev        # http://localhost:3000
yarn build      # must be clean (0 TS errors, 0 lint errors) before merging
yarn lint
```

Copy `.env.example` to `.env` and fill it in first.

## Layout

One application, two halves, separated by route group:

```
app/(storefront)/   every public route — reads via the Storefront API
app/(admin)/        /admin and /staff/login — writes via the Admin API
app/api/            storefront APIs, + /api/admin/** and /api/staff-auth/**
lib/shopify/        Storefront client and queries
lib/admin/          admin panel only; every module is `server-only`
proxy.ts            admin CSP + optimistic auth gate (Next 16: not middleware.ts)
scripts/            one-off checks and seeds, run by hand
schema-push/        provisions metaobject/metafield definitions, pages and menus
```

A route group is not a URL segment, so `app/(storefront)/faq/page.tsx` still
serves `/faq`.

**The import boundary is enforced, not conventional.** `lib/admin/**` reads the
Shopify Admin API token; nothing outside the admin half may import it. ESLint's
`no-restricted-imports` fails the build on any attempt, including relative paths
that dodge the `@/` alias. If you need Shopify data on a public page, go through
`lib/shopify`.

## Storefront caching

Storefront fetches carry cache tags (`lib/shopify/constants.ts`) with per-entity
ISR windows. `POST /api/revalidate?tag=<tag>&secret=…` drops one entity class.
`REVALIDATE_SECRET` is required in production, where the route otherwise refuses
every request.

Admin fetches are always `no-store`: an operator must see the store as it is now,
not a snapshot they might overwrite.

## Admin panel

### Signing in

Staff sign in at **`/staff/login`** — not `/login`, and not through the same
system as customers. The storefront has its own Shopify Customer Account sign-in
(OAuth + PKCE, cookie `sb_customer_session`, routes under `/api/auth/**`). The two
are fully independent: different URLs, different cookie names, different base
paths. Signing in or out on one side never affects the other.

Generate the three secrets the panel needs:

```bash
yarn admin:credentials              # generates a password too
yarn admin:credentials "a password" # or hash one you have chosen
```

All staff share `ADMIN_PASSWORD_HASH`; `ADMIN_ALLOWED_EMAILS` decides who may use
it. Removing an address locks that person out on their next request — the
allowlist is re-checked on every page view and every API call, not just at
sign-in.

### Required Admin API scopes

The panel needs far less than a default custom app grants. Start with the first
row and add a row only when you build the phase that needs it:

| Scope | Needed for |
|---|---|
| `read_metaobjects`, `write_metaobjects` | reading and editing content entries |
| `read_metaobject_definitions` | discovering which content types exist |
| `read_files` | the media picker |
| `write_files` | uploading media from the panel |
| `read_products`, `write_products` | product and collection screens |
| `read_customers` | the customer list |

`schema-push` needs a different, wider set — see `schema-push/README.md`. Consider
giving it its own app so the panel's token stays narrow.

### GraphQL

The client never sends a GraphQL document. It sends an operation **name** plus
variables, and the server picks the document out of the allowlist in
`lib/admin/operations.ts` — the only file permitted to define GraphQL. That is
what stops an admin endpoint from becoming an open Admin API proxy.

Neither `tsc` nor `next build` can see inside a GraphQL template literal, so
after changing any document run it against the real store:

```bash
yarn check:admin-ops
```

One trap worth knowing before you edit `operations.ts`: **never put a `"` inside a
`#` comment in a Shopify GraphQL document.** The parser reads it as the start of a
string, swallows the rest of the document, and reports the error against an
unrelated line.

## Two things that will waste your afternoon

- **`ADMIN_PASSWORD_HASH` is colon-separated**, not `$`-separated like every other
  crypt-style hash. Next loads `.env` through dotenv-expand, which performs `$VAR`
  substitution on values and silently deletes half the hash. The symptom is a
  correct password being rejected with no clue why.
- **`tsconfig.json` includes `.next/dev/types/**`**, so after moving or renaming a
  route, `next build` type-checks a stale validator from the last `next dev` run
  and fails on modules that no longer exist. `rm -rf .next/dev` and build again.

## Admin design system

The panel follows the shared admin design system (shadcn `radix-nova` + `neutral`, Geist,
lucide icons only, sonner for toasts). `components.json` holds the canonical config; the
components live in **`components/admin/ui/`**, not `components/ui/`, because the storefront
already owns that folder.

**How two design systems share one stylesheet.** The storefront publishes
`--color-background`, `--color-foreground`, `--color-muted`, `--color-border`,
`--color-primary`, `--color-primary-foreground` and `--color-accent` from its own
`--sb-*` variables — and shadcn wants the same seven utility names. Rather than merge or
fork them, section K of `globals.css` keeps those mappings pointing at `--sb-*` and lets
`[data-admin]` re-point the `--sb-*` variables at the panel's tokens. `bg-background` then
means white inside the panel and earth on the shop, and no storefront rule is edited.

Two consequences worth knowing before you touch the CSS:

- **`data-admin` must be on every Radix portal root.** A dialog, popover, dropdown, select,
  sheet or tooltip mounts at `<body>`, outside the panel, so without it the surface picks up
  storefront colours. The attribute is already patched into those six components; re-running
  `shadcn add` on them will drop it.
- **`hooks/use-mobile.ts` is a rewrite of what the CLI generates.** The generated version
  calls `setState` inside an effect, which this repo's lint config rejects — and which mounts
  the sidebar in the wrong mode for a frame. Re-running `shadcn add sidebar` will overwrite it.

Colour appears in exactly two places: category series (`lib/admin/series-colors.ts`) and an
amber "needs attention" marker that always carries a sentence. The series palette is
validated for colour-vision deficiency — **never substitute green/red for two series that
must be told apart**; that pairing measures ΔE 3.0 under protanopia, i.e. indistinguishable.

### Data tables

Every list screen is built from `components/admin/data-table/*`, which is one system rather
than a component copied per resource. The toolbar is assembled from `column.meta` and
contains no resource names — **adding a filter means changing a column definition, not the
toolbar**. `data-table.tsx` is purely presentational, which is what lets the same shell serve
both the client-loaded and server-paged strategies.

Metaobject lists all use the client strategy (largest collection here is 18 rows), so
per-column sorting and faceted filters are correct over the complete set. A collection that
can exceed ~1,000 rows moves to the server strategy — and at that point every column must set
`enableSorting: false` and the column filters must go, because both would then describe one
page rather than the collection.

### Checking rendered markup

```bash
yarn build && yarn start                 # one terminal
yarn check:nesting admin admin/project   # another
```

React reports invalid element nesting as a **hydration error in the browser console** — not
at build time, not in the server log, and not in a status code. A page can return 200,
contain every class you grepped for, and still be broken. That is how a `<li>` nested inside
a `<li>` shipped from the breadcrumb component.

`scripts/check-html-nesting.mjs` scans server-rendered HTML for nesting HTML forbids
(`li`/`p`/`a`/`button`/`form` inside themselves). Two things about it are deliberate: it
models no auto-closing, because React validates the tree as authored and a browser's repairs
would hide the bug; and it stops the ancestor search at `ul`/`ol`, because `<li><ul><li>` is
a valid submenu and flagging the storefront's dropdown nav would make the check noise.

Pass a bare path (`admin`, not `/admin`) — Git Bash on Windows rewrites a leading slash into
a filesystem path. For authenticated pages set `ADMIN_COOKIE` to the staff session cookie.

## Security checklist before deploying

- [ ] `yarn build` is clean, and `yarn lint` reports no errors.
- [ ] The Admin API token is scoped to the table above — **not** a
      grant-everything token. One process serves both public traffic and the
      panel, so the token's blast radius is the whole store. Check the current
      grant with `currentAppInstallation { accessScopes { handle } }`.
- [ ] No secret appears in the client bundle:
      `grep -r "$SHOPIFY_ADMIN_API_ACCESS_TOKEN" .next/static` finds nothing.
- [ ] `AUTH_SECRET` is at least 32 characters and unique to this deployment.
- [ ] `ADMIN_ALLOWED_EMAILS` lists only people who should have access today.
- [ ] `REVALIDATE_SECRET` is set, or `/api/revalidate` will refuse everything.
- [ ] `/admin` redirects to `/staff/login` with no cookie, with a forged cookie,
      and for an email that has been removed from the allowlist.
- [ ] HTTPS is terminated in front of the app. The staff cookie is
      `__Secure-`-prefixed in production and browsers will not store it over
      plain http.
- [ ] Storefront routes still resolve and did not get heavier:
      `yarn build && yarn measure:first-load`, compared against the previous run.

## Deploying

One build, one deploy, both halves together. A copy change on the storefront
redeploys the panel, and a bug in the panel can take down the shop — which is why
the build must be clean and why no admin route may appear in a public page's
render path.
