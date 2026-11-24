import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * robots.txt.
 *
 * The disallow list is the admin half plus the parts of the storefront that are
 * a step in a flow rather than a destination. `/api` is there because those
 * routes answer JSON to the app's own fetches; a crawler following one gets
 * nothing useful and spends budget doing it.
 *
 * `/search` is disallowed rather than merely left out of the sitemap: a search
 * page generates an unbounded set of URLs from query strings, and every one of
 * them is thin content competing with the pages it links to.
 *
 * THE SAME GOES FOR SHOP ALL'S QUERY STRINGS. Sort, chips, menu filters and the
 * infinite scroll's cursor (`lib/shopify/catalogue-filter.ts`, `ShopControls`) make
 * thousands of URL combinations of ONE page — each declares `/shop` canonical, so none
 * is meant to be indexed, and each crawl was a full page render. Every product is
 * still reachable through the sitemap and the plain `/shop` grid.
 *
 * AI TRAINING CRAWLERS ARE TURNED AWAY; AI SEARCH IS NOT. The bots below collect pages
 * to train models — they send no visitors and crawl hard. The ones that power AI
 * search answers and link back (OAI-SearchBot, ChatGPT-User, Claude-SearchBot,
 * PerplexityBot) are not listed, so they follow the `*` rules like Google and Bing.
 * `Google-Extended` and `Applebot-Extended` are opt-outs from training only; they do
 * not affect Google Search or Apple's search.
 */
const QUERY_VARIANTS = ["sort", "after", "view", "category", "collection", "type", "vendor", "tag", "q"].map(
  (key) => `/*?*${key}=`,
);

const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "Diffbot",
  "Omgilibot",
  "cohere-training-data-crawler",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/staff", "/preview", "/api/", "/account", "/inquiry", "/search", ...QUERY_VARIANTS],
      },
      { userAgent: AI_TRAINING_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
