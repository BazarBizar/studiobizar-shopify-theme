/**
 * Shopify menus store absolute URLs against the Shopify domain
 * (`https://studiobizar.be/pages/our-services`). This maps them onto the routes
 * this app actually serves, so the nav never leaves the Next application.
 */

/** Shopify page handle → app route, where the two differ. */
const PAGE_ROUTES: Record<string, string> = {
  /**
   * The landing page reads its content from the page `home`, so a link to
   * /pages/home is a link to the site root. Without this it fell through to the
   * default below and produced `/home`, which this app does not serve.
   */
  home: "/",
  "our-story": "/our-story",
  "our-services": "/services",
  projects: "/projects",
  professionals: "/professionals",
  faq: "/faq",
  careers: "/careers",
  contact: "/contact",
  "privacy-policy": "/legal/privacy-policy",
  "terms-conditions": "/legal/terms-conditions",
  "shipping-delivery": "/legal/shipping-delivery",
  "returns-refunds": "/legal/returns-refunds",
};

/**
 * The route that renders a given page, for the admin panel's Pages screen.
 *
 * Deliberately NOT derived from `templateSuffix`. A suffix names a Liquid
 * template, and this storefront is not a theme — every route reads its page with
 * `getPage(handle)` and never looks at the suffix. Only two of the store's
 * sixteen pages carry one, both set by `schema-push` for the Online Store theme,
 * so gating on it would report fourteen live pages as having no route.
 */
export function routeForPageHandle(handle: string): string {
  return shopifyUrlToRoute(`/pages/${handle}`);
}

/** The catalogue collection stands in for the whole shop. */
const CATALOGUE_HANDLES = new Set(["all", "shop-all"]);

export function shopifyUrlToRoute(url: string | null | undefined): string {
  if (!url) return "/";

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    if (!url.startsWith("/")) return url;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const [first, second] = segments;

  if (first === "pages") return PAGE_ROUTES[second] ?? `/${second}`;
  if (first === "policies") return PAGE_ROUTES[second] ?? `/legal/${second}`;
  if (first === "products") return second ? `/shop/${second}` : "/shop";
  if (first === "collections") {
    if (!second) return "/collections";
    return CATALOGUE_HANDLES.has(second) ? "/shop" : `/collections/${second}`;
  }
  if (first === "search") return "/search";

  return pathname;
}

/**
 * The four legal pages provisioned by `schema-push`.
 *
 * Lives here rather than in the route that renders them because the sitemap
 * needs the same list, and two copies of an allowlist is how one of them ends up
 * shorter than the other.
 */
export const LEGAL_HANDLES = [
  "privacy-policy",
  "terms-conditions",
  "shipping-delivery",
  "returns-refunds",
] as const;

/** Static routes, for the sitemap and for nav fallbacks. */
export const ROUTES = {
  home: "/",
  shop: "/shop",
  collections: "/collections",
  projects: "/projects",
  designers: "/designers",
  gallery: "/gallery",
  ourStory: "/our-story",
  services: "/services",
  contact: "/contact",
  search: "/search",
  inquiry: "/inquiry",
  account: "/account",
} as const;
