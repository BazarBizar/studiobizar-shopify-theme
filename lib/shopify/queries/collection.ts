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
