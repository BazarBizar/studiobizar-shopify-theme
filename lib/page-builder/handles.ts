import { DEDICATED_PAGE_HANDLES, LEGAL_HANDLES } from "@/lib/routes";

/**
 * Which handles a page builder page may use.
 *
 * Builder pages render at `/<handle>`, beside every other storefront route, so a
 * handle is refused when it would collide with:
 *
 *  1. a route segment this app already serves (`/shop`, `/admin`, `/api`, …) —
 *     Next resolves a static segment before the dynamic one, so the builder page
 *     would simply never be reachable;
 *  2. a path Shopify itself owns on the store domain (`/products`, `/cart`, …),
 *     so the same handle stays usable if the store moves to a Liquid theme;
 *  3. a Shopify page that already has a dedicated route (`home`, `our-services`).
 *
 * `yarn check:handles` fails when a folder is added under `app/` without being
 * listed in (1) — the list cannot drift silently behind the routes.
 */

/** Every top-level segment under `app/` and `app/(storefront)/`. Checked by `scripts/check-reserved-handles.ts`. */
export const APP_ROUTE_SEGMENTS = [
  "account",
  "admin",
  "api",
  "care-maintenance",
  "careers",
  "collections",
  "contact",
  "designers",
  "faq",
  "gallery",
  "inquiry",
  "legal",
  "our-artisans",
  "our-locations",
  "our-story",
  "preview",
  "projects",
  "search",
  "services",
  "shop",
  "staff",
] as const;

/** Paths Shopify serves on a store domain, plus framework paths. */
const PLATFORM_SEGMENTS = [
  "apps",
  "blogs",
  "cart",
  "checkout",
  "checkouts",
  "community",
  "discount",
  "gift_cards",
  "orders",
  "pages",
  "password",
  "policies",
  "products",
  "services",
  "tools",
  "sitemap",
  "robots",
  "favicon",
  "manifest",
  "not-found",
] as const;

const RESERVED = new Set<string>([
  ...APP_ROUTE_SEGMENTS,
  ...PLATFORM_SEGMENTS,
  ...DEDICATED_PAGE_HANDLES,
  ...LEGAL_HANDLES,
]);

/** Shopify's own handle alphabet, without leading or trailing hyphens. */
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

/** A reason the handle cannot be used, or null when it can. */
export function builderHandleProblem(handle: string): string | null {
  if (!HANDLE.test(handle)) {
    return "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.";
  }
  if (RESERVED.has(handle)) {
    return `“/${handle}” is already used by the site. Choose another handle.`;
  }
  return null;
}

/** Taken by a route or by Shopify — renaming ANY page to one of these breaks something. */
export function isReservedHandle(handle: string): boolean {
  return RESERVED.has(handle);
}

export function isBuilderHandle(handle: string): boolean {
  return builderHandleProblem(handle) === null;
}

/** Title → a handle suggestion. The operator can still edit it. */
export function handleFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}
