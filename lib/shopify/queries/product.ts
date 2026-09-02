import { PRODUCT_CARD_DEPS, PRODUCT_DEPS, withFragments } from "../fragments";

export const getProductsQuery = withFragments(
  /* GraphQL */ `
    query GetProducts(
      $first: Int!
      $after: String
      $sortKey: ProductSortKeys
      $reverse: Boolean
      $query: String
    ) {
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, query: $query) {
        nodes {
          ...ProductCardParts
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `,
  PRODUCT_CARD_DEPS,
);

export const getProductQuery = withFragments(
  /* GraphQL */ `
    query GetProduct($handle: String!) {
      product(handle: $handle) {
        ...ProductParts
      }
    }
  `,
  PRODUCT_DEPS,
);

/** Backs "Discover More" on Shop Detail. */
export const getProductRecommendationsQuery = withFragments(
  /* GraphQL */ `
    query GetProductRecommendations($productHandle: String!) {
      productRecommendations(productHandle: $productHandle) {
        ...ProductCardParts
      }
    }
  `,
  PRODUCT_CARD_DEPS,
);

/** Feeds the category chips on Shop All. */
export const getProductTypesQuery = /* GraphQL */ `
  query GetProductTypes($first: Int!) {
    productTypes(first: $first) {
      nodes
    }
  }
`;

/**
 * Exact lookup by gid. Needed because the Storefront `products(query:)` filter
 * has no `handle:` term — it silently ignores one and returns the unfiltered
 * catalogue, which looks like a match rather than an error.
 */
export const getProductsByIdsQuery = withFragments(
  /* GraphQL */ `
    query GetProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          ...ProductCardParts
        }
      }
    }
  `,
  PRODUCT_CARD_DEPS,
);
