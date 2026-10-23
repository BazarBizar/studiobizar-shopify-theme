# Security audit — 2026-10-23

Scope: the admin panel and its API, the page builder and Theme Builder (editor, live
preview, stored values), the public storefront endpoints, the Liquid theme's design
settings, and dependencies. `yarn check:security` keeps the fixes below tested (20 checks).

## Fixed

| Finding | Fix |
|---|---|
| **Critical:** Next.js 16.3.3 — RCE (image optimizer, `use cache`), Server Actions DoS, cache poisoning, SSRF; `sharp`, `source-map-js` below it | Next and `eslint-config-next` 16.4.2. `source-map-js` and exceljs' `brace-expansion` pinned to patched versions (`resolutions` in package.json). |
| Login throttle keyed by `email:ip`, where the ip is the caller-supplied `x-forwarded-for` — a new made-up ip per guess meant unlimited guesses at one address | A second bucket keyed by the email alone (`loginAccount`: 20, then one a minute) — `lib/admin/auth.ts`, `lib/admin/rate-limit.ts`. |
| The limiter's clean-up dropped any bucket idle 10 minutes, quietly shortening every slower limit | Dropped only once it has refilled. |
| Public forms (contact, inquiry, newsletter): no rate limit, body read whole, inquiry items unbounded. The inquiry confirmation goes to the address typed in, carrying visitor text — usable to send mail in the shop's name | `lib/public-form.ts`: per visitor, per form (a ceiling no made-up ip escapes), per recipient address (3, then one per 20 min); body capped as it streams; inquiry: at most 100 products, every field length-bounded. |
| `/api/revalidate`: secret only in the query string (lands in access logs), compared with `!==` | Header `x-revalidate-secret` (query still accepted), constant-time compare. |
| Liquid `sb-design`: one select value written into an attribute unescaped (merchant-only) | Escaped. |

## Checked and sound

- Every `/api/admin/**` route and Server Function requires a valid staff session (`guard` /
  `currentStaff`); writes are same-origin (CSRF) and rate-limited; `proxy.ts` is only the
  optimistic gate.
- Admin and preview pages: nonce CSP, `connect-src 'self'`; the preview can be framed by this
  origin only.
- Builder values: links `isSafeHref` (no `javascript:`/`data:`), rich text escaped with a scheme
  allowlist, design values narrow (hex colours, enums, bounded numbers), images only from the
  Shopify CDN; preview messages checked for origin, and only `data-sb-*` attributes can be set.
- Uploads: MIME allowlist (no SVG) and size limits, checked on the server.
- Login redirect cannot leave `/admin`; one error message for every login failure.
- `.env` is not tracked; no secrets in `NEXT_PUBLIC_*`.

## Fixed for production (second pass, same day)

| Was open | Now |
|---|---|
| Storefront had no CSP or framing rule | `storefrontCsp()` in `next.config.ts` on every path but `/admin`, `/staff`, `/preview` (which keep `proxy.ts`'s nonce policy — two policies on one response would both apply): scripts only from this origin, `connect-src 'self'`, images and media only from the Shopify CDN and the Instagram hosts, frames only the two video players, `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`, plus `X-Frame-Options: DENY`. Inline scripts stay allowed: the pages are prerendered, and a nonce would make each render per request. A crawl of 21 storefront pages under `next start` found no violation. Zod runs `jitless` (`lib/zod-config.ts`), so the forms no longer probe for `eval`. Customer sign-in/out are full page loads (`ButtonLink reload`), since a client navigation would fetch Shopify's redirect. |
| `uuid` under exceljs | Pinned to 11.1.1 (`resolutions`); exceljs only calls `v4()`, checked by writing and reading back a workbook. `yarn audit --groups dependencies`: 0. |
| Rate limits per process | `limit()` in `lib/admin/rate-limit.ts` counts in Upstash Redis when `UPSTASH_REDIS_REST_URL/TOKEN` (or Vercel KV's) are set — every instance shares one count; a Redis that does not answer in 1.5s falls back to the instance's own buckets rather than locking anyone out. Without them, production logs a warning. |
| No bot challenge | A honeypot field in the three forms (`components/forms/honeypot.tsx`, `lib/honeypot.ts`): off screen, hidden from assistive technology, skipped by Tab. Filled → thanked and dropped, nothing sent or stored. |

## Not covered here

- The **Liquid theme** is served by Shopify, which sets its headers; the inquiry App Proxy
  target is not part of this app.
- **Turnstile / CAPTCHA** would need a Cloudflare account and keys; the honeypot and the
  per-form ceilings bound what a script can do without one.
- Adding a third party to the storefront means adding its hosts to `storefrontCsp()`.
