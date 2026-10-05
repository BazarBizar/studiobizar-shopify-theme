import { COLLECTION_DEPS, PRODUCT_CARD_DEPS, withFragments } from "../fragments";

export const getCollectionsQuery = withFragments(
  /* GraphQL */ `
    query GetCollections($first: Int!, $after: String, $query: String) {
      collections(first: $first, after: $after, query: $query, sortKey: TITLE) {
        nodes {
          ...CollectionParts
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
  COLLECTION_DEPS,
);

export const getCollectionQuery = withFragments(
  /* GraphQL */ `
    query GetCollection($handle: String!) {
      collection(handle: $handle) {
        ...CollectionParts
      }
    }
  `,
  COLLECTION_DEPS,
);

export const getCollectionProductsQuery = withFragments(
  /* GraphQL */ `
    query GetCollectionProducts(
      $handle: String!
      $first: Int!
      $after: String
      $sortKey: ProductCollectionSortKeys
      $reverse: Boolean
    ) {
      collection(handle: $handle) {
        id
        handle
        title
        products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
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
    }
  `,
  PRODUCT_CARD_DEPS,
);

/**
 * Collection has no product count in the Storefront API, so Shop All's
 * "N items" counts the ids instead. Curated collections hold a dozen or so
 * products; one page of 250 covers them, and `hasNextPage` says when it doesn't.
 */
export const countCollectionProductsQuery = /* GraphQL */ `
  query CountCollectionProducts($handle: String!) {
    collection(handle: $handle) {
      products(first: 250) {
        nodes {
          id
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;
