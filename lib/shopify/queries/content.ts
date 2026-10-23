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

/**
 * Just the published page builder document — what the admin polls after a publish
 * to learn when Shopify has started serving it. See `waitForStorefront` in
 * `lib/admin/page-builder.ts`.
 */
/**
 * The Theme Builder's PUBLISHED header and footer layout — a shop metafield, the only
 * one of its three copies the Storefront API can read. See `lib/theme-builder/layout.ts`.
 */
export const getThemeLayoutQuery = /* GraphQL */ `
  query GetThemeLayout {
    shop {
      layout: metafield(namespace: "custom", key: "theme_layout") {
        value
      }
    }
  }
`;

export const getPageBuilderDocumentQuery = /* GraphQL */ `
  query GetPageBuilderDocument($handle: String!) {
    page(handle: $handle) {
      id
      document: metafield(namespace: "custom", key: "sections") {
        value
      }
    }
  }
`;
