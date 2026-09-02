import "server-only";

import { shopifyFetch } from "./client";
import {
  PRODUCTS_PER_PAGE,
  REVALIDATE,
  TAGS,
  resolveCollectionSort,
  resolveSort,
} from "./constants";
import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery,
} from "./queries/collection";
import { getMenuQuery, getPageQuery, getPagesQuery, getShopQuery } from "./queries/content";
import { getMetaobjectQuery, getMetaobjectsQuery } from "./queries/metaobject";
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductTypesQuery,
  getProductsByIdsQuery,
  getProductsQuery,
} from "./queries/product";
import { predictiveSearchQuery, searchProductsQuery } from "./queries/search";
import {
  normalizeCollection,
  normalizeCollectionCard,
  normalizeMenuItem,
  normalizeProduct,
  normalizeProductCard,
} from "./transforms";
import type {
  Collection,
  CollectionCard,
  Connection,
  Maybe,
  MenuLink,
  Paginated,
  Product,
  ProductCard,
  ShopifyCollection,
  ShopifyMenu,
  ShopifyMetaobject,
  ShopifyPage,
  ShopifyProduct,
  ShopifyProductCard,
} from "./types";

export * from "./constants";
export * from "./transforms";
export * from "./types";
export { ShopifyError } from "./client";

/* -------------------------------------------------------------------------- *
 * Products
 * -------------------------------------------------------------------------- */

export async function getProducts({
  first = PRODUCTS_PER_PAGE,
  after,
  sort,
  query,
}: {
  first?: number;
  after?: string;
  sort?: string | null;
  query?: string;
} = {}): Promise<Paginated<ProductCard>> {
  const { sortKey, reverse } = resolveSort(sort);

  const data = await shopifyFetch<{ products: Connection<ShopifyProductCard> }>({
    query: getProductsQuery,
    variables: { first, after: after ?? null, sortKey, reverse, query: query ?? null },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return {
    items: data.products.nodes.map(normalizeProductCard),
    pageInfo: data.products.pageInfo,
  };
}

export async function getProduct(handle: string): Promise<Maybe<Product>> {
  const data = await shopifyFetch<{ product: Maybe<ShopifyProduct> }>({
    query: getProductQuery,
    variables: { handle },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return data.product ? normalizeProduct(data.product) : null;
}

export async function getProductRecommendations(productHandle: string): Promise<ProductCard[]> {
  const data = await shopifyFetch<{ productRecommendations: Maybe<ShopifyProductCard[]> }>({
    query: getProductRecommendationsQuery,
    variables: { productHandle },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return (data.productRecommendations ?? []).map(normalizeProductCard);
}


/**
 * Products by gid, for metafields that store product references.
 *
 * Deliberately NOT a `products(query: "handle:…")` search: the Storefront
 * filter has no handle term and silently ignores it, returning the whole
 * catalogue as though it had matched. `nodes(ids:)` is exact.
 *
 * Order follows the reference order, and anything unpublished drops out.
 */
export async function getProductsByIds(ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];

  const data = await shopifyFetch<{ nodes: Maybe<ShopifyProductCard>[] }>({
    query: getProductsByIdsQuery,
    variables: { ids },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return data.nodes.filter(Boolean).map((node) => normalizeProductCard(node!));
}

export async function getProductTypes(first = 250): Promise<string[]> {
  const data = await shopifyFetch<{ productTypes: { nodes: string[] } }>({
    query: getProductTypesQuery,
    variables: { first },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return data.productTypes.nodes.filter(Boolean);
}

/* -------------------------------------------------------------------------- *
 * Collections
 * -------------------------------------------------------------------------- */

export async function getCollections({
  first = 100,
  after,
  query,
}: { first?: number; after?: string; query?: string } = {}): Promise<Paginated<CollectionCard>> {
  const data = await shopifyFetch<{ collections: Connection<ShopifyCollection> }>({
    query: getCollectionsQuery,
    variables: { first, after: after ?? null, query: query ?? null },
    tags: [TAGS.collections],
    revalidate: REVALIDATE.collections,
  });

  return {
    items: data.collections.nodes.map(normalizeCollectionCard),
    pageInfo: data.collections.pageInfo,
  };
}

export async function getCollection(handle: string): Promise<Maybe<Collection>> {
  const data = await shopifyFetch<{ collection: Maybe<ShopifyCollection> }>({
    query: getCollectionQuery,
    variables: { handle },
    tags: [TAGS.collections],
    revalidate: REVALIDATE.collections,
  });

  return data.collection ? normalizeCollection(data.collection) : null;
}

export async function getCollectionProducts({
  handle,
  first = PRODUCTS_PER_PAGE,
  after,
  sort,
}: {
  handle: string;
  first?: number;
  after?: string;
  sort?: string | null;
}): Promise<Paginated<ProductCard>> {
  const { sortKey, reverse } = resolveCollectionSort(sort);

  const data = await shopifyFetch<{
    collection: Maybe<{ products: Connection<ShopifyProductCard> }>;
  }>({
    query: getCollectionProductsQuery,
    variables: { handle, first, after: after ?? null, sortKey, reverse },
    tags: [TAGS.collections, TAGS.products],
    revalidate: REVALIDATE.products,
  });

  const products = data.collection?.products;

  return {
    items: (products?.nodes ?? []).map(normalizeProductCard),
    pageInfo:
      products?.pageInfo ??
      { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
  };
}

/* -------------------------------------------------------------------------- *
 * Metaobjects
 * -------------------------------------------------------------------------- */

export async function getMetaobjects(
  type: string,
  { first = 100, after }: { first?: number; after?: string } = {},
): Promise<Paginated<ShopifyMetaobject>> {
  const data = await shopifyFetch<{ metaobjects: Connection<ShopifyMetaobject> }>({
    query: getMetaobjectsQuery,
    variables: { type, first, after: after ?? null },
    tags: [TAGS.metaobjects],
    revalidate: REVALIDATE.metaobjects,
  });

  return { items: data.metaobjects.nodes, pageInfo: data.metaobjects.pageInfo };
}

export async function getMetaobject(
  type: string,
  handle: string,
): Promise<Maybe<ShopifyMetaobject>> {
  const data = await shopifyFetch<{ metaobject: Maybe<ShopifyMetaobject> }>({
    query: getMetaobjectQuery,
    variables: { handle: { type, handle } },
    tags: [TAGS.metaobjects],
    revalidate: REVALIDATE.metaobjects,
  });

  return data.metaobject;
}

/* -------------------------------------------------------------------------- *
 * Content — pages, menus, shop
 * -------------------------------------------------------------------------- */

export async function getPage(handle: string): Promise<Maybe<ShopifyPage>> {
  const data = await shopifyFetch<{ page: Maybe<ShopifyPage> }>({
    query: getPageQuery,
    variables: { handle },
    tags: [TAGS.content],
    revalidate: REVALIDATE.content,
  });

  return data.page;
}

export async function getPages(first = 50): Promise<ShopifyPage[]> {
  const data = await shopifyFetch<{ pages: { nodes: ShopifyPage[] } }>({
    query: getPagesQuery,
    variables: { first },
    tags: [TAGS.content],
    revalidate: REVALIDATE.content,
  });

  return data.pages.nodes;
}

export async function getMenu(handle: string): Promise<MenuLink[]> {
  const data = await shopifyFetch<{ menu: Maybe<ShopifyMenu> }>({
    query: getMenuQuery,
    variables: { handle },
    tags: [TAGS.content],
    revalidate: REVALIDATE.content,
  });

  return (data.menu?.items ?? []).map(normalizeMenuItem);
}

export async function getShop() {
  const data = await shopifyFetch<{
    shop: { name: string; description: Maybe<string>; primaryDomain: { url: string } };
  }>({
    query: getShopQuery,
    tags: [TAGS.content],
    revalidate: REVALIDATE.content,
  });

  return data.shop;
}

/* -------------------------------------------------------------------------- *
 * Search
 * -------------------------------------------------------------------------- */

export async function searchProducts({
  query,
  first = PRODUCTS_PER_PAGE,
  after,
}: {
  query: string;
  first?: number;
  after?: string;
}): Promise<Paginated<ProductCard> & { totalCount: number }> {
  const data = await shopifyFetch<{
    search: Connection<ShopifyProductCard> & { totalCount: number };
  }>({
    query: searchProductsQuery,
    variables: { query, first, after: after ?? null },
    tags: [TAGS.products],
    revalidate: REVALIDATE.products,
  });

  return {
    items: data.search.nodes.filter(Boolean).map(normalizeProductCard),
    pageInfo: data.search.pageInfo,
    totalCount: data.search.totalCount,
  };
}

export async function predictiveSearch(query: string, limit = 6) {
  const data = await shopifyFetch<{
    predictiveSearch: Maybe<{
      products: ShopifyProductCard[];
      collections: { id: string; handle: string; title: string }[];
      pages: { id: string; handle: string; title: string }[];
    }>;
  }>({
    query: predictiveSearchQuery,
    variables: { query, limit },
    // Instant results must reflect the query, never a cached neighbour.
    revalidate: false,
  });

  return {
    products: (data.predictiveSearch?.products ?? []).map(normalizeProductCard),
    collections: data.predictiveSearch?.collections ?? [],
    pages: data.predictiveSearch?.pages ?? [],
  };
}

/* -------------------------------------------------------------------------- *
 * Designers
 * -------------------------------------------------------------------------- */

/**
 * Products attributed to a designer, reached through the collections that
 * credit them.
 *
 * There is no direct route: the Storefront `products(query:)` filter cannot
 * match a metafield. Both `metafields.custom.designer:<gid>` and
 * `metafield:custom.designer:<gid>` were tested against the live API — the first
 * returns nothing, the second returns the *unfiltered* catalogue, and neither
 * errors. Since every seeded product inherits its designer from its collection,
 * going via the collection is exact.
 */
export async function getProductsByDesigner(
  designerHandle: string,
  { first = 12 }: { first?: number } = {},
): Promise<{ products: ProductCard[]; collections: CollectionCard[] }> {
  const all = await getCollections({ first: 100 });
  const collections = all.items.filter((item) => item.designer?.handle === designerHandle);

  if (collections.length === 0) return { products: [], collections: [] };

  const pages = await Promise.all(
    collections.map((collection) =>
      getCollectionProducts({ handle: collection.handle, first }).then((page) => page.items),
    ),
  );

  // A product can sit in more than one of a designer's collections.
  const seen = new Set<string>();
  const products = pages.flat().filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });

  return { products: products.slice(0, first), collections };
}
