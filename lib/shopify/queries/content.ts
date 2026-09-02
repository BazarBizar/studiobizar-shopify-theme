import { PAGE_DEPS, withFragments } from "../fragments";

export const getPageQuery = withFragments(
  /* GraphQL */ `
    query GetPage($handle: String!) {
      page(handle: $handle) {
        ...PageParts
      }
    }
  `,
  PAGE_DEPS,
);

export const getPagesQuery = withFragments(
  /* GraphQL */ `
    query GetPages($first: Int!) {
      pages(first: $first) {
        nodes {
          ...PageParts
        }
      }
    }
  `,
  PAGE_DEPS,
);

export const getMenuQuery = /* GraphQL */ `
  query GetMenu($handle: String!) {
    menu(handle: $handle) {
      id
      handle
      title
      items {
        id
        title
        url
        type
        items {
          id
          title
          url
          type
        }
      }
    }
  }
`;

export const getShopQuery = /* GraphQL */ `
  query GetShop {
    shop {
      name
      description
      primaryDomain {
        url
      }
    }
  }
`;
