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
