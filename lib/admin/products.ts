import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Products data layer.
 *
 * WRITE SCOPE: **edit only**. No create, no delete — those stay in Shopify, and
 * `productCreate`/`productDelete` are absent from the operation allowlist entirely, so
 * there is nothing here for a caller to reach for.
 *
 * This store has 2027 products, so every list is server-driven: search, filter, sort and
 * paging all happen in Shopify. Nothing here loads the catalogue into memory.
 */

const PRODUCT_GID_PREFIX = "gid://shopify/Product/";

export function productIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${PRODUCT_GID_PREFIX}${param}` : null;
}

export function paramFromProductId(id: string): string {
  return id.startsWith(PRODUCT_GID_PREFIX) ? id.slice(PRODUCT_GID_PREFIX.length) : id;
}

export type Money = { amount: string; currencyCode: string };

export type ProductRow = {
  id: string;
  param: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  updatedAt: string;
  variants: number;
  /**
   * null when the product does not track inventory. NOT zero — this catalogue is
   * made-to-order and every product is untracked, so rendering `0` would mark all 2027
   * as out of stock.
   */
  stock: number | null;
  price: { min: Money; max: Money };
  thumbnail: string | null;
};

type RawProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  updatedAt: string;
  totalInventory: number | null;
  tracksInventory: boolean;
  variantsCount: { count: number } | null;
  priceRangeV2: { minVariantPrice: Money; maxVariantPrice: Money };
  featuredMedia: { preview: { image: { url: string } | null } | null } | null;
};

function toRow(raw: RawProduct): ProductRow {
  return {
    id: raw.id,
    param: paramFromProductId(raw.id),
    title: raw.title,
    handle: raw.handle,
    status: raw.status,
    vendor: raw.vendor,
    productType: raw.productType,
    tags: raw.tags,
    updatedAt: raw.updatedAt,
    variants: raw.variantsCount?.count ?? 0,
    // The distinction Shopify does not make for you.
    stock: raw.tracksInventory ? (raw.totalInventory ?? 0) : null,
    price: { min: raw.priceRangeV2.minVariantPrice, max: raw.priceRangeV2.maxVariantPrice },
    thumbnail: raw.featuredMedia?.preview?.image?.url ?? null,
  };
}

/**
 * Builds Shopify's query string from the filter state.
 *
 * Assembled HERE, never accepted from the client, so a caller cannot inject query
 * syntax. Values are quoted because Shopify's PRODUCT search — unlike its file search —
 * does treat quotes as grouping; a vendor called `Jungle Fish` needs them.
 */
export function buildProductQuery({
  search,
  status,
  vendors,
  productTypes,
  updatedFrom,
  updatedTo,
}: {
  search?: string | null;
  status?: string[];
  vendors?: string[];
  productTypes?: string[];
  updatedFrom?: string | null;
  updatedTo?: string | null;
}): string | null {
  const clauses: string[] = [];

  const quote = (value: string) => `'${value.replace(/'/g, "")}'`;
  const anyOf = (field: string, values: string[] | undefined) => {
    if (!values?.length) return;
    clauses.push(`(${values.map((value) => `${field}:${quote(value)}`).join(" OR ")})`);
  };

  if (search?.trim()) {
    // Strip the characters that carry query meaning, then let Shopify match the rest.
    const term = search.replace(/["':()\\*]/g, " ").replace(/\s+/g, " ").trim();
    if (term) clauses.push(`title:*${term}*`);
  }

  anyOf("status", status);
  anyOf("vendor", vendors);
  anyOf("product_type", productTypes);

  if (updatedFrom) clauses.push(`updated_at:>='${updatedFrom}'`);
  if (updatedTo) clauses.push(`updated_at:<='${updatedTo}'`);

  return clauses.length ? clauses.join(" AND ") : null;
}

export type ProductSortKey =
  | "UPDATED_AT"
  | "CREATED_AT"
  | "TITLE"
  | "VENDOR"
  | "PRODUCT_TYPE"
  | "INVENTORY_TOTAL";

export type ProductPage = {
  products: ProductRow[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export async function listProducts({
  first = 50,
  after = null,
  query = null,
  sortKey = "UPDATED_AT",
  reverse = true,
}: {
  first?: number;
  after?: string | null;
  query?: string | null;
  sortKey?: ProductSortKey;
  reverse?: boolean;
}): Promise<ProductPage> {
  const data = await adminGraphQL<{
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RawProduct[];
    };
  }>("products", OPERATIONS.products.document, { first, after, query, sortKey, reverse });

  return {
    products: data.products.nodes.map(toRow),
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
  };
}

/**
 * The row count for the SAME filter the table is showing — not `rows.length`, which with
 * cursor paging only ever means "how far have I scrolled".
 */
export async function countProducts(query: string | null): Promise<{ count: number; exact: boolean }> {
  const data = await adminGraphQL<{ productsCount: { count: number; precision: string } }>(
    "productsCount",
    OPERATIONS.productsCount.document,
    { query },
  );

  return {
    count: data.productsCount.count,
    exact: data.productsCount.precision === "EXACT",
  };
}

/** Vendors and types across the whole store, for the filters. */
export async function getProductFilterOptions(): Promise<{ vendors: string[]; productTypes: string[] }> {
  const data = await adminGraphQL<{
    shop: {
      productVendors: { edges: { node: string }[] };
      productTypes: { edges: { node: string }[] };
    };
  }>("productFilterOptions", OPERATIONS.productFilterOptions.document, {});

  return {
    vendors: data.shop.productVendors.edges.map((edge) => edge.node).filter(Boolean),
    productTypes: data.shop.productTypes.edges.map((edge) => edge.node).filter(Boolean),
  };
}

/* -------------------------------------------------------------------------- *
 * Detail
 * -------------------------------------------------------------------------- */

export type ProductMedia = {
  id: string;
  alt: string | null;
  contentType: string;
  preview: string | null;
};

export type ProductChannel = {
  publicationId: string;
  name: string;
  /** Whether the product is ASSIGNED to the channel. See the note in the editor. */
  assigned: boolean;
  publishDate: string | null;
};

export type ProductDetail = ProductRow & {
  descriptionHtml: string;
  templateSuffix: string | null;
  createdAt: string;
  onlineStoreUrl: string | null;
  seo: { title: string | null; description: string | null };
  category: { id: string; fullName: string } | null;
  media: ProductMedia[];
  collections: { id: string; title: string; handle: string }[];
  metafields: { id: string; key: string; type: string; value: string }[];
  channels: ProductChannel[];
};

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const data = await adminGraphQL<{
    product:
      | (RawProduct & {
          descriptionHtml: string;
          templateSuffix: string | null;
          createdAt: string;
          onlineStoreUrl: string | null;
          seo: { title: string | null; description: string | null };
          category: { id: string; fullName: string } | null;
          media: {
            nodes: {
              id: string;
              alt: string | null;
              mediaContentType: string;
              preview: { image: { url: string } | null } | null;
            }[];
          };
          collections: { nodes: { id: string; title: string; handle: string }[] };
          metafields: { nodes: { id: string; key: string; type: string; value: string }[] };
          resourcePublicationsV2: {
            nodes: {
              isPublished: boolean;
              publishDate: string | null;
              publication: { id: string; name: string };
            }[];
          };
        })
      | null;
  }>("product", OPERATIONS.product.document, { id });

  const raw = data.product;
  if (!raw) return null;

  return {
    ...toRow(raw),
    descriptionHtml: raw.descriptionHtml,
    templateSuffix: raw.templateSuffix,
    createdAt: raw.createdAt,
    onlineStoreUrl: raw.onlineStoreUrl,
    seo: raw.seo,
    category: raw.category,
    media: raw.media.nodes.map((node) => ({
      id: node.id,
      alt: node.alt,
      contentType: node.mediaContentType,
      preview: node.preview?.image?.url ?? null,
    })),
    collections: raw.collections.nodes,
    metafields: raw.metafields.nodes,
    /**
     * `resourcePublicationsV2` reports ASSIGNMENT. A draft product keeps its channel
     * assignments while reporting `isPublished: false` everywhere, so binding a switch to
     * `isPublished` would show every channel as off for a product that is genuinely on
     * them — and flipping the switch would then try to assign something already assigned.
     */
    channels: raw.resourcePublicationsV2.nodes.map((node) => ({
      publicationId: node.publication.id,
      name: node.publication.name,
      assigned: true,
      publishDate: node.publishDate,
    })),
  };
}

/* -------------------------------------------------------------------------- *
 * Writes — edit only
 * -------------------------------------------------------------------------- */

export type ProductUpdateFields = {
  title?: string;
  handle?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  tags?: string[];
  seo?: { title?: string; description?: string };
  metafields?: { key: string; type: string; value: string }[];
};

const NAMESPACE = "custom";

export async function updateProduct(
  id: string,
  fields: ProductUpdateFields,
  /** Media to ATTACH. Shopify creates a new file per URL; there is no attach-existing. */
  media?: { originalSource: string; alt?: string; mediaContentType: string }[],
) {
  const product: Record<string, unknown> = { id };

  if (fields.title !== undefined) product.title = fields.title;
  if (fields.handle !== undefined) product.handle = fields.handle;
  if (fields.descriptionHtml !== undefined) product.descriptionHtml = fields.descriptionHtml;
  if (fields.vendor !== undefined) product.vendor = fields.vendor;
  if (fields.productType !== undefined) product.productType = fields.productType;
  if (fields.status !== undefined) product.status = fields.status;
  if (fields.tags !== undefined) product.tags = fields.tags;
  if (fields.seo !== undefined) product.seo = fields.seo;

  if (fields.metafields?.length) {
    product.metafields = fields.metafields.map((field) => ({
      namespace: NAMESPACE,
      key: field.key,
      type: field.type,
      value: field.value,
    }));
  }

  const data = await adminGraphQL<{
    productUpdate: {
      product: { id: string; handle: string; title: string; updatedAt: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("productUpdate", OPERATIONS.productUpdate.document, {
    product,
    media: media?.length ? media : null,
  });

  assertNoUserErrors(data.productUpdate.userErrors);
  if (!data.productUpdate.product) throw new Error("Shopify updated nothing.");

  return data.productUpdate.product;
}

/**
 * Clears metafields. This is `metafieldsDelete`, NOT `metafieldsSet` with an empty
 * string: setting "" stores an empty value and the field still reads as present, which
 * is a different state from never having been filled in.
 */
export async function clearProductMetafields(ownerId: string, keys: string[]) {
  if (keys.length === 0) return;

  const data = await adminGraphQL<{
    metafieldsDelete: {
      deletedMetafields: { key: string }[] | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("metafieldsDelete", OPERATIONS.metafieldsDelete.document, {
    metafields: keys.map((key) => ({ ownerId, namespace: NAMESPACE, key })),
  });

  assertNoUserErrors(data.metafieldsDelete.userErrors);
}

/** Channel assignment. Saves immediately — it is not part of any form's Save. */
export async function setProductPublication(
  id: string,
  publicationId: string,
  publish: boolean,
) {
  const operation = publish ? "publishablePublish" : "publishableUnpublish";

  const data = await adminGraphQL<Record<string, { userErrors: { field?: string[] | null; message: string }[] }>>(
    operation,
    OPERATIONS[operation].document,
    { id, input: [{ publicationId }] },
  );

  assertNoUserErrors(data[operation].userErrors);
}
