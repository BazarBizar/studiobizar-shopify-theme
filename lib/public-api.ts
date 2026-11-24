/**
 * Shared rules for the storefront's public JSON routes (`/api/products`,
 * `/api/search/predictive`) — the ones the browser calls without signing in.
 *
 * CACHED AT THE CDN. Every visitor scrolling Shop All asks for the same next pages, and
 * every visitor typing "chair" asks the same question; answering each from a function
 * was a render per visitor. A short shared cache answers the repeats at the edge. Five
 * minutes, then served stale for up to an hour while ONE request refreshes it — a
 * product change reaches these lists within minutes, and the product page itself is
 * refreshed at once by its cache tag.
 *
 * BOUNDED INPUT. A query string longer than anything the site sends is refused before
 * it reaches Shopify, so the routes cannot be used to push oversized queries upstream
 * or to fill the cache with junk variants.
 */

export const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
} as const;

/** Errors are never cached: the next request should try again. */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const MAX_PARAM_LENGTH = 512;
const MAX_QUERY_LENGTH = 2048;

/** True when every parameter is a sane length — far above what the site's own UI sends. */
export function boundedParams(url: URL): boolean {
  if (url.search.length > MAX_QUERY_LENGTH) return false;
  for (const value of url.searchParams.values()) if (value.length > MAX_PARAM_LENGTH) return false;
  return true;
}
