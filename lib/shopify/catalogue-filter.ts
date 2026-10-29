/**
 * A catalogue FILTER from the address — what a menu link like Shopify's
 * "Collection, filtered by tag", or a product-type or vendor link, opens.
 *
 *   /shop?type=Dining%20Chairs        every product of that type
 *   /shop?vendor=Atelier%20X          every product by that vendor
 *   /shop?tag=oak,handmade            every product with ALL of those tags
 *   /collections/chairs?tag=oak       the collection, narrowed to a tag
 *
 * Shopify's own addresses for the same things (`/collections/types?q=…`,
 * `/collections/vendors?q=…`, `/collections/<handle>/<tag>`) are mapped onto these by
 * `shopifyUrlToRoute` and `normalizeMenuItem`, so a menu built in the panel — or in
 * Shopify — lands here. The Liquid theme serves Shopify's addresses natively.
 *
 * Pure: no fetching, imported by pages, the products API and the grid alike.
 */

export type CatalogueFilter = {
  type: string | null;
  vendor: string | null;
  /** All must match. */
  tags: string[];
};

export const MAX_FILTER_TAGS = 10;
const MAX_VALUE = 255;

type ParamSource = (key: string) => string | string[] | null | undefined;

const one = (value: string | string[] | null | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.slice(0, MAX_VALUE) : null;
};

/** From page `searchParams` or a `URLSearchParams` — `(key) => params.get(key)`. */
export function readCatalogueFilter(get: ParamSource): CatalogueFilter {
  const tags = (one(get("tag")) ?? "")
    .split(",")
    .map((tag) => tag.trim().slice(0, MAX_VALUE))
    .filter(Boolean)
    .slice(0, MAX_FILTER_TAGS);
  return { type: one(get("type")), vendor: one(get("vendor")), tags };
}

export function hasCatalogueFilter(filter: CatalogueFilter): boolean {
  return Boolean(filter.type || filter.vendor || filter.tags.length);
}

/** A value inside Storefront search syntax: quoted, with its own quotes and backslashes escaped. */
const quoted = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Storefront `products(query:)` syntax for the whole catalogue, or undefined for none. */
export function catalogueFilterQuery(filter: CatalogueFilter): string | undefined {
  const parts = [
    ...(filter.type ? [`product_type:${quoted(filter.type)}`] : []),
    ...(filter.vendor ? [`vendor:${quoted(filter.vendor)}`] : []),
    ...filter.tags.map((tag) => `tag:${quoted(tag)}`),
  ];
  return parts.length ? parts.join(" AND ") : undefined;
}

/** Two Storefront queries that must both hold — a category chip and a menu's filter. */
export function combineQueries(...queries: (string | undefined)[]): string | undefined {
  const present = queries.filter((query): query is string => Boolean(query));
  if (present.length <= 1) return present[0];
  return present.map((query) => `(${query})`).join(" AND ");
}

/** Storefront `ProductFilter`s for a collection's products — the same narrowing inside one collection. */
export function catalogueProductFilters(filter: CatalogueFilter): Record<string, string>[] {
  return [
    ...(filter.type ? [{ productType: filter.type }] : []),
    ...(filter.vendor ? [{ productVendor: filter.vendor }] : []),
    ...filter.tags.map((tag) => ({ tag })),
  ];
}

/** Writes the filter into an address's query, for the grid's next pages and for links. */
export function setCatalogueFilterParams(params: URLSearchParams, filter: CatalogueFilter): URLSearchParams {
  if (filter.type) params.set("type", filter.type);
  if (filter.vendor) params.set("vendor", filter.vendor);
  if (filter.tags.length) params.set("tag", filter.tags.join(","));
  return params;
}

/** "Dining Chairs · oak" — what the page says it is showing, or null when unfiltered. */
export function catalogueFilterLabel(filter: CatalogueFilter): string | null {
  const parts = [filter.type, filter.vendor, ...filter.tags].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

/** A stable key for caches and React keys. */
export function catalogueFilterKey(filter: CatalogueFilter): string {
  return setCatalogueFilterParams(new URLSearchParams(), filter).toString();
}
