# Layout Shell (Step 2)

Header, navigation, mobile drawer and footer — the frame every page composes.

## Files

| File | Role |
|---|---|
| `components/layout/page-shell.tsx` | `PageShell` — surface + header + main + footer + back-to-top |
| `components/layout/header.tsx` | Server Component; fetches the two header menus |
| `components/layout/header-actions.tsx` | Client; EN switch, search, inquiry bag |
| `components/layout/mobile-nav.tsx` | Client; slide-in drawer under 1024px |
| `components/layout/footer.tsx` | Server Component; fetches the three footer menus |
| `components/layout/newsletter-form.tsx` | Client; posts to `/api/newsletter` |
| `components/layout/social-links.tsx` | The 2×3 grid of social marks |
| `components/layout/logo.tsx` | Logo lockup and mark, as recolourable CSS masks |
| `components/layout/back-to-top.tsx` | Appears past 900px of scroll |
| `components/ui/container.tsx` | The 1728px canvas with its 20px gutter |
| `lib/navigation.ts` | Menu handles + a hardcoded fallback nav |
| `lib/routes.ts` | Shopify URL → app route mapping |
| `lib/social.ts` | The six social channels |
| `app/api/newsletter/route.ts` | Validates, logs, succeeds — no provider yet |

## Why pages compose the shell instead of inheriting it

The ground changes per page: Shop All is earth, Landing is dark wood, Contact is mocha, Projects
Detail is off-black — and the footer changes with it (olive nearly everywhere, dark wood on
Contact). A root layout cannot read which surface its child page wants, so each page renders its
own shell:

```tsx
<PageShell surface="dark" footerSurface="olive">…</PageShell>
```

The header paints no background of its own. It inherits `text-foreground` from the surrounding
`data-surface`, exactly as the designs do — the same header is dark-wood on Shop All and earth on
Landing without a single variant class.

## Header geometry, measured from the PDFs

Content sits at y=20–42 on the 1728px canvas:

- Logo lockup x=18.5→202 (183.5×20)
- Primary nav from x=254, 16px: Products · Collections · Projects · Services
- Secondary nav from x=1353, 14px: About · Info · Professionals
- `EN` at x=1598, 9px (`text-micro`)
- Two icons at x=1637 and x=1695 — search and the inquiry bag
- Right edge lands on 1708, i.e. the 20px gutter

The primary nav sits immediately right of the logo, not centred.

## Footer geometry

Ground `#41473E`, height 401px:

- Logo mark at x=35, y=43, 126×90; tagline below it
- Newsletter copy and field at x=41
- Three link columns at x=701, x=990, x=1244
- Social marks 2×3 at x=1629/1663, y=37/71/106, each 27×27
- `Belgium — (EUR)` at x=1383 and the copyright at x=1550

## Menus come from Shopify

All five `desk-*` menus exist and match the design exactly. `lib/routes.ts` rewrites Shopify's
absolute URLs onto this app's routes:

| Shopify | App |
|---|---|
| `/collections/all` (CATALOG) | `/shop` |
| `/pages/our-services` | `/services` |
| `/pages/our-story` | `/our-story` |
| `/policies/privacy-policy` | `/legal/privacy-policy` |
| `/products/<handle>` | `/shop/<handle>` |

If a menu fetch fails or returns nothing, `FALLBACK_NAV` renders the same links from code, so the
shell never collapses into a logo on its own.

## Brand assets are extracted vector

`lucide-react` v1 ships **no brand icons** — no Instagram, Facebook or Pinterest — so the logo and
the six social marks were read out of the PDF content streams as paths and written to
`public/brand/`. All UI icons still come from lucide, per the brief.

They are applied as CSS masks with `background-color: currentColor`, so one file works on every
surface. That is why the logo is dark wood in the Shop All header and earth in the Landing header
without a second asset.

Verified: `logo.svg` is the mark plus a wordmark whose glyphs spell S-t-u-d-i-o / B-i-z-a-r
(the dotted `i` is a separate subpath, as expected).

## Open: which platform is which social icon

**The design never labels the six social marks.** `lib/social.ts` carries an inferred mapping,
derived from each glyph's subpath count and aspect ratio. Only Instagram, Facebook and Pinterest
are named anywhere in the designs (Contact page, all `@studiobizarantwerp`), and even those were
matched to icons by shape.

Icons 4–6 render at reduced opacity with **no link** rather than pointing somewhere wrong.
Rendered large for confirmation: <https://claude.ai/code/artifact/d7956a6c-972f-44a8-a961-fd43b9bfeef7>

## Deliberately incomplete

- **Inquiry badge** — the bag has no count. The Zustand store is Step 5; the slot is in
  `header-actions.tsx`.
- **`EN` switch** — rendered because the design has it, but inert. No second locale is configured.
- **Newsletter** — `/api/newsletter` validates the address and returns success, but logs a warning
  that nothing was stored. Follows the brief's Resend convention of degrading rather than throwing.
  Wire a provider in that one route.
- **`/search`** — minimal but working, so the header's search control is not a dead link. Step 13
  adds projects and designers, `nuqs` URL state, infinite scroll and the shared product card.

## Verification

`yarn build` and `eslint` pass. Against the running dev server:

- `/`, `/search`, `/search?q=basket` all 200; `POST /api/newsletter` returns its message
- Surfaces nest correctly: `light` (html) → `dark` (page) → `olive` (footer)
- Header and footer render **live Shopify menus**, with every URL rewritten to an app route
- All eight brand SVGs serve as `image/svg+xml`, well-formed, no `NaN` in any path
- `/search?q=basket` returns real products
