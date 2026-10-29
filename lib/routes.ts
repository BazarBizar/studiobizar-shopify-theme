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
 * Page handles that have a route of their own. A page builder page may not take
 * one of these — `/home` and `/our-services` would otherwise render a second copy
 * of a page that already lives at `/` and `/services`.
 */
export const DEDICATED_PAGE_HANDLES: readonly string[] = Object.keys(PAGE_ROUTES);

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

/**
 * Shopify's catalogue addresses that carry a filter, onto the shop's own query (see
 * `lib/shopify/catalogue-filter.ts`): `/collections/types?q=Chairs` → `/shop?type=Chairs`,
 * `/collections/vendors?q=X` → `/shop?vendor=X`, and a collection narrowed to a tag,
 * `/collections/<handle>/<tag>`, → the shop's grid of that collection with `?tag=`
 * (`collectionTagRoute`). That tag is Shopify's handle of it; a menu item knows the tag
 * itself and `normalizeMenuItem` uses that instead.
 */
const FILTER_COLLECTIONS: Record<string, "type" | "vendor"> = { types: "type", vendors: "vendor" };

/**
 * A collection narrowed to tags. The collection's own page is editorial (a mosaic of
 * ten); a filtered list belongs in the shop's grid, which pages through it.
 */
export function collectionTagRoute(handle: string, tags: string[]): string {
  const tag = tags.join(",");
  return CATALOGUE_HANDLES.has(handle)
    ? `/shop?${new URLSearchParams({ tag })}`
    : `/shop?${new URLSearchParams({ view: "collection", collection: handle, tag })}`;
}

/** The paths Shopify gives its own storefront resources — what a menu's absolute url points at. */
const SHOPIFY_PATHS = new Set(["pages", "policies", "products", "collections", "search"]);

export function shopifyUrlToRoute(url: string | null | undefined): string {
  if (!url) return "/";

  let parsed: URL;
  try {
    parsed = new URL(url, "https://shop.invalid");
  } catch {
    return url;
  }
  if (!/^(https?:\/\/|\/)/i.test(url)) return url;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const [first, second, third] = segments;

  // An absolute url is the shop's own only on its myshopify domain or at one of
  // Shopify's resource paths; anything else is another website and stays as it is.
  const absolute = /^https?:\/\//i.test(url);
  const ownHost = parsed.hostname.endsWith(".myshopify.com");
  if (absolute && !ownHost && !(first && SHOPIFY_PATHS.has(first))) return url;

  const pathname = parsed.pathname;
  const search = parsed.searchParams;
  if (segments.length === 0) return "/";

  // A metaobject's own page — a designer, a project — is `/pages/<type>/<handle>` on
  // Shopify and `/<type>/<handle>` here.
  if (first === "pages") return third ? `/${second}/${third}` : (PAGE_ROUTES[second] ?? `/${second}`);
  if (first === "policies") return PAGE_ROUTES[second] ?? `/legal/${second}`;
  if (first === "products") return second ? `/shop/${second}` : "/shop";
  if (first === "collections") {
    if (!second) return "/collections";
    const filter = FILTER_COLLECTIONS[second];
    const value = search.get("q")?.trim();
    if (filter) return value ? `/shop?${new URLSearchParams({ [filter]: value })}` : "/shop";
    if (third) return collectionTagRoute(second, decodeURIComponent(third).split("+"));
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
