import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * THE STOREFRONT'S CSP — its own policy, not a relaxed copy of the admin one.
 *
 * Static, because the pages are prerendered: a nonce would make every page render per
 * request. So `script-src` allows inline scripts (Next's bootstrap writes some) but no
 * script from anywhere else — an injected `<script src>` to another host is refused,
 * and with `connect-src 'self'` anything injected has nowhere to send what it reads.
 *
 * What the shop really loads from elsewhere, and nothing more: photographs from the
 * Shopify CDN and the Instagram feed's hosts (the same list as `images.remotePatterns`),
 * and the two video players `parseVideoUrl` allows, framed only once play is pressed.
 * Adding analytics, a map or chat means adding its hosts here, on purpose.
 */
function storefrontCsp(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.shopify.com https://*.cdninstagram.com https://*.fbcdn.net https://behold.pictures https://feeds.behold.so",
    "media-src 'self' https://cdn.shopify.com",
    "font-src 'self' data:",
    // The dev server's live reload is a websocket; production talks to its own /api only.
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const nextConfig: NextConfig = {
  /** The version banner is free reconnaissance. Nothing needs it. */
  poweredByHeader: false,

  images: {
    // Images are served straight from the Shopify CDN and sized with its own
    // `?width=` transform, so Vercel's optimizer is deliberately bypassed.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      // Behold serves Instagram media straight from Meta's CDNs.
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "feeds.behold.so" },
      { protocol: "https", hostname: "behold.pictures" },
    ],
  },

  /**
   * Site-wide security headers. These live here rather than in `proxy.ts` so the
   * storefront keeps its statically prerendered pages — a header set in the proxy
   * would run a function on every public request, and the nonce the admin CSP
   * needs would force dynamic rendering.
   *
   * The admin half (`/admin`, `/staff`, `/preview`) gets its CSP and framing rule
   * per request in `proxy.ts`, where the CSP can carry a nonce — so the storefront's
   * own policy below is kept off those paths: two policies on one response are BOTH
   * enforced, and this one's `frame-ancestors 'none'` would stop the builder's preview.
   */
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
    ];

    // HSTS only in production: sending it from a dev server would pin
    // localhost to https in the browser and make the dev server unreachable.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      { source: "/:path*", headers },
      {
        // Everything but the admin half, which `proxy.ts` covers. `/api` answers JSON, where a
        // policy does no harm and keeps a response opened directly from being framed.
        source: "/((?!admin|staff|preview).*)",
        headers: [
          { key: "Content-Security-Policy", value: storefrontCsp() },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
