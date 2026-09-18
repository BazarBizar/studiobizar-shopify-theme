import "server-only";

/**
 * The public origin of this storefront.
 *
 * SHOPIFY CANNOT ANSWER THIS. On a headless store `shop.primaryDomain` reports
 * the Shopify-hosted domain, not the Next app serving the catalogue — which is
 * the same reason `lib/admin/links.ts` reads `STOREFRONT_URL` for its "View on
 * store" links rather than asking the Storefront API.
 *
 * It matters in three places, and getting it wrong is silent in all of them:
 * `metadataBase` resolves every canonical and Open Graph URL against it, the
 * sitemap lists absolute URLs, and robots.txt points at the sitemap.
 *
 * The fallback is localhost because that is the truth in development and because
 * a wrong absolute origin in production is worse than an obviously local one —
 * a sitemap full of `https://www.example.com` would be submitted and indexed.
 */
const FALLBACK = "http://localhost:3000";

function resolve(): string {
  const configured = process.env.STOREFRONT_URL?.trim().replace(/\/$/, "");
  if (!configured) return FALLBACK;

  try {
    // Rejects a bare domain typed without a scheme, which `new URL` would throw
    // on and which would otherwise surface as an unrelated build error.
    return new URL(configured).origin;
  } catch {
    return FALLBACK;
  }
}

export const SITE_URL = resolve();

/** Absolute URL for a storefront path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
