import {
  COLLECTION_METAFIELDS,
  METAFIELD_NAMESPACE,
  PAGE_METAFIELDS,
  PRODUCT_CARD_METAFIELDS,
  PRODUCT_DETAIL_METAFIELDS,
} from "./constants";

/**
 * NO PRICE, NO INVENTORY.
 *
 * These fragments must never request `priceRange`, `compareAtPriceRange`,
 * `price`, `compareAtPrice`, `availableForSale`, `quantityAvailable` or
 * `totalInventory`. The storefront is inquiry-only, so the data is stripped at
 * the query rather than hidden in the UI. `scripts/check-no-price.ts` enforces
 * this — run it before committing changes here.
 */

/** Builds the `identifiers:` literal for a `metafields(...)` selection. */
const identifiers = (keys: readonly string[]) =>
  `[${keys.map((key) => `{namespace:"${METAFIELD_NAMESPACE}",key:"${key}"}`).join(",")}]`;

export const imageFragment = /* GraphQL */ `
  fragment ImageParts on Image {
    url
    altText
    width
    height
  }
`;

export const seoFragment = /* GraphQL */ `
  fragment SeoParts on SEO {
    title
    description
  }
`;

/**
 * A reference one level down — enough to resolve the image inside a
 * captioned_image without recursing forever.
 */
export const leafReferenceFragment = /* GraphQL */ `
  fragment LeafRefParts on MetafieldReference {
    __typename
    ... on MediaImage {
      id
      alt
      image {
        ...ImageParts
      }
    }
    ... on GenericFile {
      id
      url
      mimeType
      previewImage {
        ...ImageParts
      }
    }
    ... on Video {
      id
      sources {
        url
        mimeType
        format
        height
        width
      }
      previewImage {
        ...ImageParts
      }
    }
  }
`;

export const metaobjectLeafFragment = /* GraphQL */ `
  fragment MetaobjectLeafParts on Metaobject {
    id
    handle
    type
    fields {
      key
      type
      value
      reference {
        ...LeafRefParts
      }
      references(first: 20) {
        nodes {
          ...LeafRefParts
        }
      }
    }
  }
`;

export const referenceFragment = /* GraphQL */ `
  fragment RefParts on MetafieldReference {
    __typename
    ... on MediaImage {
      id
      alt
      image {
        ...ImageParts
      }
    }
    ... on GenericFile {
      id
      url
      mimeType
      previewImage {
        ...ImageParts
      }
    }
    ... on Video {
      id
      sources {
        url
        mimeType
        format
        height
        width
      }
      previewImage {
        ...ImageParts
      }
    }
    ... on Metaobject {
      ...MetaobjectLeafParts
    }
    ... on Product {
      id
      handle
      title
      featuredImage {
        ...ImageParts
      }
    }
    ... on Collection {
      id
      handle
      title
    }
    ... on Page {
      id
      handle
      title
    }
  }
`;

export const metafieldFragment = /* GraphQL */ `
  fragment MetafieldParts on Metafield {
    key
    namespace
    type
    value
    reference {
      ...RefParts
    }
    references(first: 30) {
      nodes {
        ...RefParts
      }
    }
  }
`;

export const metaobjectFragment = /* GraphQL */ `
  fragment MetaobjectParts on Metaobject {
    id
    handle
    type
    updatedAt
    fields {
      key
      type
      value
      reference {
        ...RefParts
      }
      references(first: 30) {
        nodes {
          ...RefParts
        }
      }
    }
  }
`;

export const productCardFragment = /* GraphQL */ `
  fragment ProductCardParts on Product {
    id
    handle
    title
    tags
    images(first: 2) {
      nodes {
        ...ImageParts
      }
    }
    variants(first: 1) {
      nodes {
        id
        title
      }
    }
    metafields(identifiers: ${identifiers(PRODUCT_CARD_METAFIELDS)}) {
      ...MetafieldParts
    }
  }
`;

export const productFragment = /* GraphQL */ `
  fragment ProductParts on Product {
    id
    handle
    title
    description
    descriptionHtml
    vendor
    productType
    tags
    updatedAt
    seo {
      ...SeoParts
    }
    featuredImage {
      ...ImageParts
    }
    images(first: 20) {
      nodes {
        ...ImageParts
      }
    }
    options(first: 10) {
      id
      name
      optionValues {
        id
        name
      }
    }
    variants(first: 100) {
      nodes {
        id
        title
        sku
        selectedOptions {
          name
          value
        }
        image {
          ...ImageParts
        }
      }
    }
    metafields(identifiers: ${identifiers(PRODUCT_DETAIL_METAFIELDS)}) {
      ...MetafieldParts
    }
  }
`;

export const collectionFragment = /* GraphQL */ `
  fragment CollectionParts on Collection {
    id
    handle
    title
    description
    descriptionHtml
    updatedAt
    image {
      ...ImageParts
    }
    seo {
      ...SeoParts
    }
    metafields(identifiers: ${identifiers(COLLECTION_METAFIELDS)}) {
      ...MetafieldParts
    }
  }
`;

export const pageFragment = /* GraphQL */ `
  fragment PageParts on Page {
    id
    handle
    title
    body
    bodySummary
    updatedAt
    seo {
      ...SeoParts
    }
    metafields(identifiers: ${identifiers(PAGE_METAFIELDS)}) {
      ...MetafieldParts
    }
  }
`;

/** Fragment bundles — spread into a query so every dependency travels with it. */
export const REFERENCE_DEPS = [imageFragment, leafReferenceFragment, metaobjectLeafFragment, referenceFragment];

export const PRODUCT_CARD_DEPS = [...REFERENCE_DEPS, metafieldFragment, productCardFragment];

export const PRODUCT_DEPS = [...REFERENCE_DEPS, seoFragment, metafieldFragment, productFragment];

export const COLLECTION_DEPS = [...REFERENCE_DEPS, seoFragment, metafieldFragment, collectionFragment];

export const PAGE_DEPS = [...REFERENCE_DEPS, seoFragment, metafieldFragment, pageFragment];

export const METAOBJECT_DEPS = [...REFERENCE_DEPS, metaobjectFragment];

/**
 * Assembles a query from its fragment dependencies. Lives here rather than in
 * `client.ts` so query modules stay importable outside a server runtime — the
 * smoke test in `scripts/check-queries.ts` depends on that.
 */
export function withFragments(operation: string, fragments: string[]) {
  return [operation, ...fragments].join("\n");
}
