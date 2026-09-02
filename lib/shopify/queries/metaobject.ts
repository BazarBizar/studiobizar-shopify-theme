import { METAOBJECT_DEPS, withFragments } from "../fragments";

/**
 * `metaobjects` takes no `query` argument, so filtering (e.g. projects by
 * category) happens after fetching. Ordering follows each type's own
 * `sort_order` field rather than a Shopify sort key.
 */
export const getMetaobjectsQuery = withFragments(
  /* GraphQL */ `
    query GetMetaobjects($type: String!, $first: Int!, $after: String) {
      metaobjects(type: $type, first: $first, after: $after) {
        nodes {
          ...MetaobjectParts
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
  METAOBJECT_DEPS,
);

export const getMetaobjectQuery = withFragments(
  /* GraphQL */ `
    query GetMetaobject($handle: MetaobjectHandleInput!) {
      metaobject(handle: $handle) {
        ...MetaobjectParts
      }
    }
  `,
  METAOBJECT_DEPS,
);
