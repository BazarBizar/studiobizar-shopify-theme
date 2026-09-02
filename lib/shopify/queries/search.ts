import { PRODUCT_CARD_DEPS, withFragments } from "../fragments";

/**
 * Storefront search covers Product, Page and Article only — projects and
 * designers are metaobjects and are searched separately in `searchAll`.
 */
export const searchProductsQuery = withFragments(
  /* GraphQL */ `
    query SearchProducts($query: String!, $first: Int!, $after: String) {
      search(query: $query, first: $first, after: $after, types: [PRODUCT], sortKey: RELEVANCE) {
        totalCount
        nodes {
          ... on Product {
            ...ProductCardParts
          }
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

/** Instant results for the header search field. */
export const predictiveSearchQuery = withFragments(
  /* GraphQL */ `
    query PredictiveSearch($query: String!, $limit: Int!) {
      predictiveSearch(query: $query, limit: $limit, types: [PRODUCT, COLLECTION, PAGE]) {
        products {
          ...ProductCardParts
        }
        collections {
          id
          handle
          title
        }
        pages {
          id
          handle
          title
        }
      }
    }
  `,
  PRODUCT_CARD_DEPS,
);
