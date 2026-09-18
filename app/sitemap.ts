import type { MetadataRoute } from "next";

import { LEGAL_HANDLES } from "@/lib/routes";
import {
  METAOBJECT_TYPES,
  getCollections,
  getMetaobjects,
  getProducts,
} from "@/lib/shopify";
import { SITE_URL } from "@/lib/site";

/**
 * The sitemap.
 *
 * NO `lastModified` ANYWHERE. None of the card shapes this storefront reads
 * carries an `updatedAt`, and a date invented from the build time is worse than
 * no date at all: it tells a crawler that 1,595 products all changed at once,
 * every deploy. Omitting it leaves the crawler to decide, which is what it does
 * well.
 *
 * `/inquiry`, `/inquiry/success`, `/account` and `/search` are deliberately
 * absent. The first three are steps in a flow rather than destinations, and a
 * search results page is thin content that competes with the pages it links to.
 */

/** Storefront routes that exist without any Shopify record behind them. */
const STATIC_PATHS = [
  "/",
  "/shop",
  "/collections",
  "/projects",
  "/designers",
  "/gallery",
  "/our-story",
  "/services",
  "/our-artisans",
  "/our-locations",
  "/care-maintenance",
  "/careers",
  "/professionals",
  "/faq",
  "/contact",
];

/**
 * Every product, in pages of 250 — the Storefront API's maximum.
 *
 * `sort: "a-z"` IS LOAD-BEARING, and the default is not safe here.
 * `resolveSort(undefined)` returns the first option, which is `RELEVANCE` — a
 * sort key Shopify only defines in a search context. Paginating through the
 * whole catalogue with it gives an unstable order, and records fall between the
 * cursors: measured against this store it returned 1,457 of 1,595 products, a
 * silent 9% loss with no error anywhere. `TITLE` is a total order, so every
 * record appears exactly once.
 *
 * The page cap exists so a pagination bug cannot turn this into an unbounded
 * loop against Shopify. 20 pages is 5,000 products against a catalogue of 1,595,
 * so hitting it means something is wrong rather than that the store grew.
 */
async function allProductHandles(): Promise<string[]> {
  const handles: string[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const result = await getProducts({ first: 250, after, sort: "a-z" });
    handles.push(...result.items.map((product) => product.handle));

    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
    after = result.pageInfo.endCursor;
  }

  return handles;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * Each source is allowed to fail on its own. A sitemap missing its projects is
   * useful; a sitemap that threw is a 500, and a crawler that gets one stops
   * asking for a while.
   */
  const [products, collections, designers, projects] = await Promise.all([
    allProductHandles().catch(() => []),
    getCollections({ first: 100 })
      .then((page) => page.items.map((item) => item.handle))
      .catch(() => []),
    getMetaobjects(METAOBJECT_TYPES.designer)
      .then((page) => page.items.map((entry) => entry.handle))
      .catch(() => []),
    getMetaobjects(METAOBJECT_TYPES.project)
      .then((page) => page.items.map((entry) => entry.handle))
      .catch(() => []),
  ]);

  const url = (path: string) => ({ url: `${SITE_URL}${path}` });

  return [
    ...STATIC_PATHS.map(url),
    ...LEGAL_HANDLES.map((handle) => url(`/legal/${handle}`)),
    ...collections.map((handle) => url(`/collections/${handle}`)),
    ...designers.map((handle) => url(`/designers/${handle}`)),
    ...projects.map((handle) => url(`/projects/${handle}`)),
    ...products.map((handle) => url(`/shop/${handle}`)),
  ];
}
