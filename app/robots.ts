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
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/staff", "/api/", "/account", "/inquiry", "/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
