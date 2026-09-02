import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
