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
