/**
 * Outbound links to the public storefront.
 *
 * `STOREFRONT_URL` has to be configured; Shopify cannot answer this for a headless
 * store. `shop.primaryDomain` on this store reports the Shopify-hosted domain, not the
 * Next app serving the catalogue, so building a "View on store" link from it would send
 * an operator to the wrong site.
 */
export function storefrontUrl(path: string): string | null {
  const base = process.env.STOREFRONT_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
