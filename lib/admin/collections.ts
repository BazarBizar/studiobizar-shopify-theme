import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Collections data layer.
 *
 * THE WRITE SCOPE IS CREATE AND EDIT. No delete, and — the important one —
 * **`ruleSet` is never sent**. A smart collection's rules decide which of two thousand
 * products appear in it, and one mistyped condition empties it on the storefront with no
 * undo. The rules are READ so the form can show them as context; that the display is
 * read-only is a consequence of this module never sending them, not a UI choice.
 *
 * This store happens to have twelve collections, all manual — but the rule is written
 * for the store, not for today's data.
 */

/**
 * Shopify's enum, in words. `MOST_RELEVANT` is in here because it is what every
 * collection in this store actually uses, and it is absent from the usual published
 * list — without it the panel would show a raw enum on every single row.
 */
const SORT_ORDER_LABELS: Record<string, string> = {
  ALPHA_ASC: "Alphabetical, A–Z",
  ALPHA_DESC: "Alphabetical, Z–A",
  BEST_SELLING: "Best selling",
  CREATED: "Newest first",
  CREATED_DESC: "Oldest first",
  MANUAL: "Manual",
  MOST_RELEVANT: "Most relevant",
  PRICE_ASC: "Price, low to high",
  PRICE_DESC: "Price, high to low",
};

export function sortOrderLabel(value: string | null | undefined): string {
  if (!value) return "—";
  // An unknown enum falls back to a humanised form rather than a blank: a new Shopify
  // value should read oddly, not vanish.
  return SORT_ORDER_LABELS[value] ?? value.toLowerCase().replace(/_/g, " ");
}

export const SORT_ORDER_OPTIONS = Object.entries(SORT_ORDER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export type CollectionRule = { column: string; relation: string; condition: string };

export type CollectionRuleSet = {
  /** true = ANY rule matches; false = ALL must match. */
  appliedDisjunctively: boolean;
  rules: CollectionRule[];
};

export type CollectionRow = {
  id: string;
  param: string;
  title: string;
  handle: string;
  updatedAt: string;
  sortOrder: string | null;
  productsCount: number;
  image: { url: string; altText: string | null } | null;
  smart: boolean;
};

export type CollectionDetail = CollectionRow & {
  descriptionHtml: string;
  templateSuffix: string | null;
  seo: { title: string | null; description: string | null };
  ruleSet: CollectionRuleSet | null;
  metafields: { id: string; key: string; type: string; value: string }[];
};

const COLLECTION_GID_PREFIX = "gid://shopify/Collection/";

export function collectionIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${COLLECTION_GID_PREFIX}${param}` : null;
}

export function paramFromCollectionId(id: string): string {
  return id.startsWith(COLLECTION_GID_PREFIX) ? id.slice(COLLECTION_GID_PREFIX.length) : id;
}

type RawCollection = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
  sortOrder: string | null;
  productsCount: { count: number } | null;
  image: { url: string; altText: string | null } | null;
  ruleSet: CollectionRuleSet | null;
  descriptionHtml?: string;
  templateSuffix?: string | null;
  seo?: { title: string | null; description: string | null };
  metafields?: { nodes: { id: string; key: string; type: string; value: string }[] };
};

function toRow(raw: RawCollection): CollectionRow {
  return {
    id: raw.id,
    param: paramFromCollectionId(raw.id),
    title: raw.title,
    handle: raw.handle,
    updatedAt: raw.updatedAt,
    sortOrder: raw.sortOrder,
    productsCount: raw.productsCount?.count ?? 0,
    image: raw.image,
    smart: Boolean(raw.ruleSet),
  };
}

/**
 * Every collection. Client-strategy: this is a screen with dozens of rows, not
 * thousands, so filtering and sorting in the browser are correct over the full set.
 */
export async function listCollections(): Promise<CollectionRow[]> {
  const all: CollectionRow[] = [];
  let after: string | null = null;

  for (;;) {
    const data: {
      collections: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawCollection[];
      };
    } = await adminGraphQL("collections", OPERATIONS.collections.document, { first: 250, after });

    all.push(...data.collections.nodes.map(toRow));

    if (!data.collections.pageInfo.hasNextPage) break;
    after = data.collections.pageInfo.endCursor;
    if (!after) break;
  }

  return all;
}

export async function getCollection(id: string): Promise<CollectionDetail | null> {
  const data = await adminGraphQL<{ collection: RawCollection | null }>(
    "collection",
    OPERATIONS.collection.document,
    { id },
  );

  const raw = data.collection;
  if (!raw) return null;

  return {
    ...toRow(raw),
    descriptionHtml: raw.descriptionHtml ?? "",
    templateSuffix: raw.templateSuffix ?? null,
    seo: raw.seo ?? { title: null, description: null },
    ruleSet: raw.ruleSet,
    metafields: raw.metafields?.nodes ?? [],
  };
}

export type CollectionProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
};

export async function listCollectionProducts(
  id: string,
  { first = 24, after = null }: { first?: number; after?: string | null } = {},
): Promise<{ products: CollectionProduct[]; hasNextPage: boolean; endCursor: string | null }> {
  const data = await adminGraphQL<{
    collection: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: {
          id: string;
          title: string;
          handle: string;
          status: string;
          featuredMedia: { preview: { image: { url: string } | null } | null } | null;
        }[];
      };
    } | null;
  }>("collectionProducts", OPERATIONS.collectionProducts.document, { id, first, after });

  const products = data.collection?.products;
  if (!products) return { products: [], hasNextPage: false, endCursor: null };

  return {
    products: products.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      thumbnail: node.featuredMedia?.preview?.image?.url ?? null,
    })),
    hasNextPage: products.pageInfo.hasNextPage,
    endCursor: products.pageInfo.endCursor,
  };
}

/* -------------------------------------------------------------------------- *
 * Writes
 * -------------------------------------------------------------------------- */

/**
 * The only keys this panel will ever send. `ruleSet` is absent by construction, so no
 * caller can smuggle one through — the type simply has no place to put it.
 */
export type CollectionWriteInput = {
  title?: string;
  handle?: string;
  descriptionHtml?: string;
  sortOrder?: string;
  templateSuffix?: string | null;
  seo?: { title?: string; description?: string };
  image?: { src: string; altText?: string } | null;
  metafields?: { key: string; type: string; value: string }[];
};

const NAMESPACE = "custom";

function toShopifyInput(input: CollectionWriteInput) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.handle !== undefined ? { handle: input.handle } : {}),
    ...(input.descriptionHtml !== undefined ? { descriptionHtml: input.descriptionHtml } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.templateSuffix !== undefined ? { templateSuffix: input.templateSuffix } : {}),
    ...(input.seo !== undefined ? { seo: input.seo } : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
    ...(input.metafields !== undefined
      ? {
          metafields: input.metafields.map((field) => ({
            namespace: NAMESPACE,
            key: field.key,
            type: field.type,
            value: field.value,
          })),
        }
      : {}),
  };
}

export async function createCollection(input: CollectionWriteInput) {
  const data = await adminGraphQL<{
    collectionCreate: {
      collection: { id: string; handle: string; title: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("collectionCreate", OPERATIONS.collectionCreate.document, { input: toShopifyInput(input) });

  assertNoUserErrors(data.collectionCreate.userErrors);
  if (!data.collectionCreate.collection) throw new Error("Shopify created nothing.");

  return data.collectionCreate.collection;
}

/**
 * Only the keys that actually changed are sent — Shopify leaves an omitted key alone, so
 * a partial input is what stops this from overwriting a field another editor touched a
 * moment ago. The caller does the diffing; this just refuses to invent keys.
 */
export async function updateCollection(id: string, input: CollectionWriteInput) {
  const data = await adminGraphQL<{
    collectionUpdate: {
      collection: { id: string; handle: string; title: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("collectionUpdate", OPERATIONS.collectionUpdate.document, {
    input: { id, ...toShopifyInput(input) },
  });

  assertNoUserErrors(data.collectionUpdate.userErrors);
  if (!data.collectionUpdate.collection) throw new Error("Shopify updated nothing.");

  return data.collectionUpdate.collection;
}
