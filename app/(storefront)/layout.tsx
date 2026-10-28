import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";
import { getSiteIdentity } from "@/lib/shopify";
import { cdnImage } from "@/lib/shopify/transforms";

/**
 * Storefront-only shell. `Providers` (TanStack Query + the nuqs adapter) lives
 * here rather than in the root layout so that the admin panel — a sibling route
 * group — does not ship the storefront's client runtime, and vice versa. Moving
 * it up to the root would put both halves' client weight on every route.
 *
 * A route group is not a URL segment, so every storefront path is unchanged.
 */
export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return <Providers>{children}</Providers>;
}

/**
 * The site-wide defaults from Site-wide → Logo, icon & SEO (`site_identity`): the name
 * after every title, the description and share image for any page without its own, the
 * browser-tab icon, and Google's verification tag. A page's own metadata still wins
 * key by key — and `openGraph` as a whole, which is why product, project, designer and
 * collection pages (which set their own photo) are unaffected.
 */
export async function generateMetadata(): Promise<Metadata> {
  const identity = await getSiteIdentity();
  const share = identity.shareImage;
  const favicon = identity.favicon;

  return {
    title: { default: identity.siteName, template: `%s · ${identity.siteName}` },
    ...(identity.metaDescription ? { description: identity.metaDescription } : {}),
    applicationName: identity.siteName,
    openGraph: {
      siteName: identity.siteName,
      type: "website",
      // No title or description here: Next fills both from the page's own, which a
      // fixed value would override on every page that has one.
      ...(share
        ? { images: [{ url: cdnImage(share.url, 1200), width: 1200, alt: share.altText ?? identity.siteName }] }
        : {}),
    },
    twitter: { card: share ? "summary_large_image" : "summary" },
    // The uploaded icon, sized by Shopify's CDN; otherwise /favicon.ico from public/.
    icons: favicon
      ? {
          icon: [{ url: cdnImage(favicon.url, 64, 64), sizes: "64x64" }],
          apple: [{ url: cdnImage(favicon.url, 180, 180), sizes: "180x180" }],
        }
      : { icon: "/favicon.ico" },
    ...(identity.googleVerification ? { verification: { google: identity.googleVerification } } : {}),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const identity = await getSiteIdentity();
  return identity.themeColor ? { themeColor: identity.themeColor } : {};
}
