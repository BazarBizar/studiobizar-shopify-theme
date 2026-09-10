import type { NextConfig } from "next";

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
   * Deliberately NOT here: `Content-Security-Policy` and `X-Frame-Options`. Both
   * are set per-request for `/admin/**` in `proxy.ts`, where the CSP can carry a
   * nonce. The storefront has no CSP today; adding one is a change to the public
   * site (analytics, the Behold Instagram feed, any embedded map or chat) and has
   * to be made deliberately, not inherited from the admin panel.
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

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
