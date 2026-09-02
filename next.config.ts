import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Images are served straight from the Shopify CDN and sized with its own
    // `?width=` transform, so Vercel's optimizer is deliberately bypassed.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
};

export default nextConfig;
