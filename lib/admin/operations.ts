import "server-only";

/**
 * THE GraphQL allowlist. Every document the admin panel can send lives here and
 * nowhere else.
 *
 * The client never sends a document — it sends an operation NAME plus variables,
 * and the server looks the name up in this table (§4.4). That is what stops a
 * `/api/admin/**` endpoint from becoming an open Admin API proxy with the store
 * owner's token behind it.
 *
 * A PARSER TRAP, learned the expensive way: never put a double quote inside a
 * `#` comment in a Shopify GraphQL document. Shopify's parser reads it as the
 * start of a string, swallows the rest of the document, and reports the error
 * against an unrelated line. That is why every explanation in this file is a JS
 * block comment above the template literal, and there are no `#` comments at
 * all inside the documents.
 */

/**
 * Shared shape of a field definition. Inlined rather than a GraphQL fragment
 * because two of the three documents that need it are separate operations and a
 * fragment spread would have to be repeated anyway.
 */
const FIELD_DEFINITIONS = `
    fieldDefinitions {
      key
      name
      description
      required
      type {
        name
        category
      }
      validations {
        name
        type
        value
      }
    }
`;

const DEFINITION_FIELDS = `
    id
    type
    name
    displayNameKey
    metaobjectsCount
    capabilities {
      publishable {
        enabled
      }
    }
${FIELD_DEFINITIONS}
`;

/**
 * The resolved target of a reference field, so a form can show what a
 * `file_reference` or `metaobject_reference` currently points at without a second
 * round trip. Unlisted kinds fall through to null, which the form renders as an
 * empty picker rather than an error.
 */
const REFERENCE_SELECTION = `
      __typename
      ... on MediaImage {
        id
        alt
        image {
          url
          altText
          width
          height
        }
      }
      ... on Video {
        id
        alt
        preview {
          image {
            url
          }
        }
      }
      ... on GenericFile {
        id
        url
        mimeType
      }
      ... on Metaobject {
        id
        handle
        type
        displayName
      }
      ... on Product {
        id
        handle
        title
      }
      ... on Collection {
        id
        handle
        title
      }
`;

/**
 * NOTE the two separate selections: Shopify exposes a single reference as
 * `reference` and a `list.*` reference as `references`, and a field only ever
 * populates one of them. Selecting just `reference` — the obvious thing — leaves
 * every list field looking empty in the form, which reads as data loss.
 */
const ENTRY_FIELDS = `
    id
    handle
    type
    updatedAt
    displayName
    capabilities {
      publishable {
        status
      }
    }
    fields {
      key
      type
      value
      reference {
${REFERENCE_SELECTION}
      }
      references(first: 50) {
        nodes {
${REFERENCE_SELECTION}
        }
      }
    }
`;

export type OperationKind = "read" | "write";

type Operation = { kind: OperationKind; document: string };

/**
 * Keyed by the name the client sends. Frozen so a later import cannot extend the
 * allowlist at runtime.
 */
export const OPERATIONS = Object.freeze({
  /** Auto-discovery: every metaobject definition the token can see. */
  metaobjectDefinitions: {
    kind: "read",
    document: `
      query AdminMetaobjectDefinitions($first: Int!, $after: String) {
        metaobjectDefinitions(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
${DEFINITION_FIELDS}
          }
        }
      }
    `,
  },

  metaobjectDefinitionByType: {
    kind: "read",
    document: `
      query AdminMetaobjectDefinitionByType($type: String!) {
        metaobjectDefinitionByType(type: $type) {
${DEFINITION_FIELDS}
        }
      }
    `,
  },

  metaobjects: {
    kind: "read",
    document: `
      query AdminMetaobjects(
        $type: String!
        $first: Int!
        $after: String
        $sortKey: String
        $reverse: Boolean
        $query: String
      ) {
        metaobjects(
          type: $type
          first: $first
          after: $after
          sortKey: $sortKey
          reverse: $reverse
          query: $query
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
${ENTRY_FIELDS}
          }
        }
      }
    `,
  },

  metaobject: {
    kind: "read",
    document: `
      query AdminMetaobject($id: ID!) {
        metaobject(id: $id) {
${ENTRY_FIELDS}
        }
      }
    `,
  },

  /**
   * Shopify Files, for the media picker behind every `file_reference` field.
   * Needs the `read_files` scope. Newest first, because the file an operator wants
   * is almost always one they just uploaded.
   */
  files: {
    kind: "read",
    document: `
      query AdminFiles($first: Int!, $after: String, $query: String) {
        files(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            __typename
            ... on MediaImage {
              id
              alt
              createdAt
              image {
                url
                altText
                width
                height
              }
            }
            ... on Video {
              id
              alt
              createdAt
              preview {
                image {
                  url
                }
              }
            }
            ... on GenericFile {
              id
              url
              createdAt
              mimeType
            }
          }
        }
      }
    `,
  },

  /**
   * Resolves many gids in one round trip, for the media fields that store a gid and
   * render its preview. One request for a whole form, not one per field.
   */
  nodes: {
    kind: "read",
    document: `
      query AdminNodes($ids: [ID!]!) {
        nodes(ids: $ids) {
          __typename
          ... on MediaImage {
            id
            alt
            fileStatus
            image {
              url
              width
              height
            }
          }
          ... on Video {
            id
            alt
            fileStatus
            preview {
              image {
                url
              }
            }
          }
          ... on GenericFile {
            id
            url
            mimeType
            fileStatus
          }
        }
      }
    `,
  },

  /**
   * Step 1 of upload: ask Shopify for a signed target. The browser never sees this —
   * the bytes go to the panel's own API, which relays them (§5.1), so the page CSP
   * stays `connect-src 'self'` and the signed target never reaches a client.
   */
  stagedUploadsCreate: {
    kind: "write",
    document: `
      mutation AdminStagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /** Step 3 of upload: register the uploaded bytes as a file in the library. */
  fileCreate: {
    kind: "write",
    document: `
      mutation AdminFileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            __typename
            id
            fileStatus
            alt
            ... on MediaImage {
              image {
                url
                width
                height
              }
            }
            ... on Video {
              preview {
                image {
                  url
                }
              }
            }
            ... on GenericFile {
              url
              mimeType
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /** Alt text. Also the mutation that detaches a file, per §2.5. */
  fileUpdate: {
    kind: "write",
    document: `
      mutation AdminFileUpdate($files: [FileUpdateInput!]!) {
        fileUpdate(files: $files) {
          files {
            id
            alt
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /* ------------------------------------------------------------------ collections */

  /**
   * `ruleSet` is SELECTED but never sent back — see `lib/admin/collections.ts`. Reading
   * it is what lets the form show the rules as context; writing it is what could empty a
   * collection on the storefront with one mistyped condition.
   */
  collections: {
    kind: "read",
    document: `
      query AdminCollections($first: Int!, $after: String) {
        collections(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            updatedAt
            sortOrder
            productsCount {
              count
            }
            image {
              url
              altText
            }
            ruleSet {
              appliedDisjunctively
              rules {
                column
                relation
                condition
              }
            }
          }
        }
      }
    `,
  },

  collection: {
    kind: "read",
    document: `
      query AdminCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          handle
          descriptionHtml
          updatedAt
          sortOrder
          templateSuffix
          productsCount {
            count
          }
          image {
            url
            altText
          }
          seo {
            title
            description
          }
          ruleSet {
            appliedDisjunctively
            rules {
              column
              relation
              condition
            }
          }
          metafields(first: 20, namespace: "custom") {
            nodes {
              id
              key
              type
              value
            }
          }
        }
      }
    `,
  },

  /** The read-only membership list: what the collection actually contains. */
  collectionProducts: {
    kind: "read",
    document: `
      query AdminCollectionProducts($id: ID!, $first: Int!, $after: String) {
        collection(id: $id) {
          products(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
              handle
              status
              featuredMedia {
                preview {
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `,
  },

  collectionCreate: {
    kind: "write",
    document: `
      mutation AdminCollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            handle
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  collectionUpdate: {
    kind: "write",
    document: `
      mutation AdminCollectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection {
            id
            handle
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /* -------------------------------------------------------------------- products */

  /**
   * The catalogue list. EVERYTHING is pushed to Shopify — search, filter, sort, paging —
   * because this store has 2027 products and no browser-side subset of that can answer a
   * filter honestly.
   */
  products: {
    kind: "read",
    document: `
      query AdminProducts(
        $first: Int!
        $after: String
        $query: String
        $sortKey: ProductSortKeys
        $reverse: Boolean
      ) {
        products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            status
            vendor
            productType
            tags
            updatedAt
            totalInventory
            tracksInventory
            variantsCount {
              count
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
            featuredMedia {
              preview {
                image {
                  url
                }
              }
            }
          }
        }
      }
    `,
  },

  /** Row count for the SAME filter the table is showing. */
  productsCount: {
    kind: "read",
    document: `
      query AdminProductsCount($query: String) {
        productsCount(query: $query) {
          count
          precision
        }
      }
    `,
  },

  /** Filter options describing the whole store, not the rows on screen. */
  productFilterOptions: {
    kind: "read",
    document: `
      query AdminProductFilterOptions {
        shop {
          productVendors(first: 250) {
            edges {
              node
            }
          }
          productTypes(first: 250) {
            edges {
              node
            }
          }
        }
      }
    `,
  },

  product: {
    kind: "read",
    document: `
      query AdminProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          status
          vendor
          productType
          tags
          descriptionHtml
          templateSuffix
          createdAt
          updatedAt
          totalInventory
          tracksInventory
          onlineStoreUrl
          seo {
            title
            description
          }
          category {
            id
            fullName
          }
          variantsCount {
            count
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          media(first: 50) {
            nodes {
              __typename
              id
              alt
              mediaContentType
              preview {
                image {
                  url
                  width
                  height
                }
              }
            }
          }
          collections(first: 25) {
            nodes {
              id
              title
              handle
            }
          }
          metafields(first: 100, namespace: "custom") {
            nodes {
              id
              key
              type
              value
            }
          }
          resourcePublicationsV2(first: 25) {
            nodes {
              isPublished
              publishDate
              publication {
                id
                name
              }
            }
          }
        }
      }
    `,
  },

  /**
   * The argument is `product:`, and `media:` is a SIBLING argument rather than a key
   * inside the input — confirmed by introspection on this API version, where
   * `ProductUpdateInput` has no `media` field.
   *
   * `productCreateMedia`, `productDeleteMedia` and `productUpdateMedia` are deliberately
   * not used. They still execute on 2026-07, but they are ABSENT from schema
   * introspection — Shopify has stopped advertising them, which is the last warning
   * before removal. Attaching goes through `media:` here, alt text and detaching through
   * `fileUpdate`, ordering through `productReorderMedia`.
   */
  productUpdate: {
    kind: "write",
    document: `
      mutation AdminProductUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) {
          product {
            id
            handle
            title
            updatedAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /**
   * Returns a background JOB, so the new order is NOT yet live when the product is read
   * back. The caller has to say so rather than re-fetch and show the old order as if the
   * save had failed.
   */
  productReorderMedia: {
    kind: "write",
    document: `
      mutation AdminProductReorderMedia($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) {
          job {
            id
            done
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /**
   * Clearing a metafield is a DELETE. `metafieldsSet` with an empty string stores an
   * empty value, which is a different thing — the field still exists and still reads as
   * present.
   */
  metafieldsDelete: {
    kind: "write",
    document: `
      mutation AdminMetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  publishablePublish: {
    kind: "write",
    document: `
      mutation AdminPublishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          publishable {
            availablePublicationsCount {
              count
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  publishableUnpublish: {
    kind: "write",
    document: `
      mutation AdminPublishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
        publishableUnpublish(id: $id, input: $input) {
          publishable {
            availablePublicationsCount {
              count
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /** Sales channels, for the product channel switches. */
  publications: {
    kind: "read",
    document: `
      query AdminPublications {
        publications(first: 50) {
          nodes {
            id
            name
          }
        }
      }
    `,
  },

  /** PRODUCT metafield definitions — the form is seeded from these, not from values. */
  productMetafieldDefinitions: {
    kind: "read",
    document: `
      query AdminProductMetafieldDefinitions {
        metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: "custom") {
          nodes {
            key
            name
            description
            type {
              name
            }
            validations {
              name
              type
              value
            }
          }
        }
      }
    `,
  },

  /* ------------------------------------------------------------------- customers */

  customers: {
    kind: "read",
    document: `
      query AdminCustomers($first: Int!, $after: String, $query: String) {
        customers(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            displayName
            firstName
            lastName
            email
            phone
            state
            note
            tags
            createdAt
            updatedAt
            numberOfOrders
            amountSpent {
              amount
              currencyCode
            }
            defaultAddress {
              formattedArea
            }
          }
        }
      }
    `,
  },

  customersCount: {
    kind: "read",
    document: `
      query AdminCustomersCount($query: String) {
        customersCount(query: $query) {
          count
          precision
        }
      }
    `,
  },

  customer: {
    kind: "read",
    document: `
      query AdminCustomer($id: ID!) {
        customer(id: $id) {
          id
          displayName
          firstName
          lastName
          email
          phone
          state
          note
          tags
          verifiedEmail
          createdAt
          updatedAt
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          defaultAddress {
            formatted
            formattedArea
          }
          addresses {
            id
            formatted
          }
          metafields(first: 30, namespace: "custom") {
            nodes {
              id
              key
              type
              value
            }
          }
        }
      }
    `,
  },

  /**
   * Only `note` and `tags` are ever sent — see the note in `lib/admin/customers.ts`.
   * A customer account is a record Shopify owns; the panel annotates it, never rewrites it.
   */
  customerUpdate: {
    kind: "write",
    document: `
      mutation AdminCustomerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            note
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
  },

  /**
   * Thumbnails for inquiry line items. The items store a variant gid taken at submission
   * time, so the image has to be looked up now — one request for the whole inquiry.
   */
  productVariantImages: {
    kind: "read",
    document: `
      query AdminProductVariantImages($ids: [ID!]!) {
        nodes(ids: $ids) {
          __typename
          ... on ProductVariant {
            id
            image {
              url
            }
            product {
              featuredMedia {
                preview {
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `,
  },

  metaobjectCreate: {
    kind: "write",
    document: `
      mutation AdminMetaobjectCreate($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
  },

  metaobjectUpdate: {
    kind: "write",
    document: `
      mutation AdminMetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
  },
} as const satisfies Record<string, Operation>);

export type OperationName = keyof typeof OPERATIONS;

const NAMES = new Set(Object.keys(OPERATIONS));

export function isOperationName(value: unknown): value is OperationName {
  return typeof value === "string" && NAMES.has(value);
}

/**
 * Resolves a name to a document, or null. Callers turn null into `NOT_ALLOWED`;
 * they never fall back to sending something the client supplied.
 */
export function resolveOperation(name: string): Operation | null {
  return isOperationName(name) ? OPERATIONS[name] : null;
}
