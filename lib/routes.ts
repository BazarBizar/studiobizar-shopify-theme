/**
 * Shopify menus store absolute URLs against the Shopify domain
 * (`https://studiobizar.be/pages/our-services`). This maps them onto the routes
 * this app actually serves, so the nav never leaves the Next application.
 */

/** Shopify page handle → app route, where the two differ. */
const PAGE_ROUTES: Record<string, string> = {
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
