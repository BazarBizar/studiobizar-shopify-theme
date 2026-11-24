# Storefront caching & Vercel usage

How storefront pages are cached, how changes reach them, and the rules that keep the
Vercel bill (ISR writes, Active CPU, invocations) low. Written after the 2026-11 usage
audit, where ISR writes ran at 373K/200K and Active CPU at 5h/4h.

## How Vercel counts (the two facts everything below follows from)

- **ISR writes are 8 KB units**, not pages. A ~250 KB page (HTML + RSC) is ~30 units each
  time it is stored.
- **A re-drawn page that is byte-for-byte the same is not stored or billed.** So the cost
  comes from (a) NEW cache keys and (b) pages whose output differs on every draw — not
  from revalidation as such.

## The model

| Route | Mode | How a change arrives |
|---|---|---|
| Content pages, `/`, `/<builder page>`, `/legal/*`, sitemap | ISR, 1 day (`/` 1 h: Instagram feed) | tag drop |
| `/shop/[handle]`, `/collections/[handle]`, `/designers/[handle]`, `/projects/[handle]` | ISR on demand (`generateStaticParams` returns `[]`), 1 day | tag drop |
| `/shop`, `/projects`, `/search` | dynamic (query strings) | – |
| `/api/products`, `/api/search/predictive` | dynamic, CDN-cached 5 min (`lib/public-api.ts`) | – |
| `/admin/*`, `/preview/*` | dynamic, never cached | – |

`REVALIDATE` (`lib/shopify/constants.ts`) is **a safety net, not the delivery mechanism**,
and all four windows are equal on purpose: a page re-draws at the shortest window of
anything on it, and every page carries the header and footer.

Changes arrive by tag:

- **Panel writes** → `revalidateForType` (`lib/admin/revalidate.ts`) → tags from
  `tagsForType` (`lib/shopify/revalidation.ts`), dropped at once and again ~35 s later
  (the Storefront API lags Admin writes by 21–29 s).
- **Shopify admin / imports** → webhook `POST /api/webhooks/shopify` (HMAC-verified),
  same tag table, one drop after the lag.
- A page builder publish drops only `page:<handle>` and `pages` (the sitemap list), not the
  whole site. Menus, header & footer and site texts drop `content` — they genuinely
  change every page.

A drop only marks entries stale ("max" profile): several drops before anyone visits
still mean one re-draw.

## Webhook setup (once per store)

`yarn setup:webhooks` (`scripts/setup-webhooks.mjs`) subscribes through the panel's own
Shopify app, to `https://<site>/api/webhooks/shopify`:

- products and collections: create, update, delete (payload cut to `id`);
- metaobjects of the types the website shows: create, update, delete, one subscription per
  event filtered `type:a OR type:b …` (payload cut to `id`, `type`). Visitors' entries
  (`inquiry`, `contact_message`, `newsletter_subscriber`) and the panel's own settings are
  left out, and the route ignores them too: a newsletter sign-up must not refresh the site.

Shopify signs app subscriptions with the **app's client secret (API secret key)**: Shopify
admin → Settings → Apps → Develop apps → the Admin app → API credentials (or the Dev
Dashboard → app → Settings). Put it in `SHOPIFY_WEBHOOK_SECRET` in Vercel (Production) and
in `.env`.

Order, because Shopify deletes a subscription whose address keeps failing:

1. Deploy the version with `app/api/webhooks/shopify`.
2. Add `SHOPIFY_WEBHOOK_SECRET` in Vercel and redeploy (env changes need a deploy).
3. `yarn setup:webhooks`. It first checks that the live address refuses an unsigned call
   and accepts one signed with the secret in `.env`, and stops with the fix if not. It
   follows the site's redirect (`studiobizar.be` → `www.`), since Shopify does not.

`--dry-run`, `--list`, `--test` (check only) and `--remove` are there too. Run it again after
adding a new kind of website entry, so its type joins the filter.

**Do not** subscribe inventory or order topics: the storefront shows neither, and they
fire hundreds of times per stock sync. Without the webhooks, changes made outside the
panel appear within a day.

## The proxy's part (`proxy.ts`)

- Scanner probes (`*.php`, `/.env`, `/.git/*`, `/wp-*`, backups…) get a bare 404 — no
  render, nothing stored.
- `/<handle>` matches any one-segment address. An address that is not a route, not a file
  in `public/` and not a published builder page (`lib/builder-page-handles.ts`, refreshed
  each minute) is rewritten to `/not-found`: **one** shared cached 404 instead of one per
  address a bot invents. If the page list cannot be loaded, requests pass through as
  before.
- Prefetches and sub-folder assets skip the proxy entirely.

## Rules for new code

1. **Server output must be deterministic.** No `Date.now()`, `Math.random()` or request
   data in a cached page — each makes every re-draw a paid write. Time-dependent UI
   decides in the browser; give the server a value that only changes when the result
   does (see `scheduleMoment` in `lib/theme-builder/promo.ts`).
2. **No unbounded cache keys.** A dynamic segment must reject what is not real before
   it renders, or share one not-found entry.
3. **Wrap per-request data functions in `React.cache()`.** Shopify queries are POST, which
   Next does not deduplicate; a page and its `generateMetadata` otherwise both fetch.
4. **Grids of links prefetch on intent** (pointer, focus, touch — see `ProductCard`), not
   on sight.
5. **Keep a new window equal to `REVALIDATE`,** or know that it sets the pace for every
   page it appears on.

## What to watch in Vercel

Observability → ISR (writes by path), Functions (Active CPU by route), Firewall (bot
share). Random one-segment paths at the top of ISR writes would mean the proxy gate is
bypassed; a content page writing on every revalidation means non-deterministic output.
