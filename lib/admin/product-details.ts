import "server-only";

import { z } from "zod";

import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";
import {
  DEFAULT_PRODUCT_DETAILS,
  DETAIL_KEY,
  DETAIL_LIMITS,
  detailKeyFor,
  PANEL_TYPES,
  parseProductDetails,
  PRODUCT_DETAILS_KEY,
  PRODUCT_DETAILS_VERSION,
  ROW_TYPES,
  type ProductDetails,
  type StoredProductDetails,
} from "@/lib/shopify/product-details";

import { OPERATIONS } from "./operations";
import { ensureShopJsonDefinition, ShopJsonConflict, writeShopJson } from "./shop-json";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Content → Product details: which product fields the product page shows, in what order
 * and under what label (`lib/shopify/product-details.ts`). One json metafield on the
 * shop, written whole and named by its digest, like Shop categories.
 *
 * "A new field" creates the PRODUCT metafield definition straight away — the product
 * form builds itself from the definitions, so the field is there to fill in at once.
 */

export class ProductDetailsError extends Error {
  readonly code: "CONFLICT" | "INVALID";
  constructor(code: ProductDetailsError["code"], message: string) {
    super(message);
    this.name = "ProductDetailsError";
    this.code = code;
  }
}

/** A product field as the screen offers it. */
export type ProductField = { key: string; name: string; type: string };

type UserError = { field?: string[] | null; message: string; code?: string | null };

async function readState() {
  const [shop, fields] = await Promise.all([
    adminGraphQL<{
      shop: { id: string; details: { value: string; compareDigest: string } | null };
      metafieldDefinitions: { nodes: { id: string }[] };
    }>("productDetails", OPERATIONS.productDetails.document, {}),
    listProductFields(),
  ]);
  return {
    shopId: shop.shop.id,
    digest: shop.shop.details?.compareDigest ?? null,
    stored: parseProductDetails(shop.shop.details?.value),
    hasDefinition: shop.metafieldDefinitions.nodes.length > 0,
    fields,
  };
}

/** Every text field on products — what a row or a panel can show. */
async function listProductFields(): Promise<ProductField[]> {
  const data = await adminGraphQL<{
    metafieldDefinitions: { nodes: { key: string; name: string; type: { name: string } }[] };
  }>("productMetafieldDefinitions", OPERATIONS.productMetafieldDefinitions.document, {});
  const usable = new Set<string>([...ROW_TYPES, ...PANEL_TYPES]);
  return data.metafieldDefinitions.nodes
    .filter((definition) => usable.has(definition.type.name))
    .map((definition) => ({ key: definition.key, name: definition.name, type: definition.type.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ProductDetailsView = ProductDetails & {
  saved: boolean;
  digest: string | null;
  fields: ProductField[];
  savedAt: string | null;
  savedBy: string | null;
};

export async function productDetailsView(): Promise<ProductDetailsView> {
  const state = await readState();
  const details = state.stored ?? DEFAULT_PRODUCT_DETAILS;
  return {
    rows: details.rows,
    panels: details.panels,
    saved: state.stored !== null,
    digest: state.digest,
    fields: state.fields,
    savedAt: state.stored?.savedAt ?? null,
    savedBy: state.stored?.savedBy ?? null,
  };
}

const detail = z.strictObject({
  key: z.string().regex(DETAIL_KEY),
  label: z
    .string()
    .trim()
    .min(1, "Every row and panel needs a label.")
    .max(DETAIL_LIMITS.label, `A label can be at most ${DETAIL_LIMITS.label} characters.`),
});

export const productDetailsInput = z.strictObject({
  digest: z.string().max(200).nullable(),
  rows: z.array(detail).max(DETAIL_LIMITS.rows),
  panels: z.array(detail).max(DETAIL_LIMITS.panels),
});

const CONFLICT = "Someone else changed the product details just now. Reload the page to see their version.";

export async function saveProductDetails(
  input: z.infer<typeof productDetailsInput>,
  actor: string,
): Promise<{ digest: string | null; savedAt: string }> {
  const state = await readState();
  if (state.digest !== input.digest) throw new ProductDetailsError("CONFLICT", CONFLICT);

  // Only fields that exist and can be shown — a key typed into a request is not enough.
  const types = new Map(state.fields.map((field) => [field.key, field.type]));
  const check = (list: { key: string }[], allowed: readonly string[], what: string) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (!allowed.includes(types.get(item.key) ?? "")) {
        throw new ProductDetailsError("INVALID", `The product field “${item.key}” cannot be shown as a ${what}.`);
      }
      if (seen.has(item.key)) throw new ProductDetailsError("INVALID", `The same field is listed twice as a ${what}.`);
      seen.add(item.key);
    }
  };
  check(input.rows, ROW_TYPES, "row");
  check(input.panels, PANEL_TYPES, "panel");

  const savedAt = new Date().toISOString();
  const next: StoredProductDetails = {
    version: PRODUCT_DETAILS_VERSION,
    rows: input.rows,
    panels: input.panels,
    savedAt,
    savedBy: actor,
  };

  if (!state.hasDefinition) {
    await ensureShopJsonDefinition({
      key: PRODUCT_DETAILS_KEY,
      name: "Product details",
      description: "Which product fields the product page shows, managed under Content → Product details in the admin panel. Do not edit by hand.",
    });
  }

  try {
    const digest = await writeShopJson({ shopId: state.shopId, key: PRODUCT_DETAILS_KEY, value: next, digest: state.digest });
    return { digest, savedAt };
  } catch (error) {
    if (error instanceof ShopJsonConflict) throw new ProductDetailsError("CONFLICT", CONFLICT);
    throw error;
  }
}

export const productFieldInput = z.strictObject({
  name: z.string().trim().min(1, "Give the new field a name.").max(DETAIL_LIMITS.label),
  kind: z.enum(["row", "panel"]),
});

/**
 * A new product field: one line for a row, formatted text for a panel. Readable by the
 * storefront; filled in per product under Products.
 */
export async function createProductField(input: z.infer<typeof productFieldInput>): Promise<ProductField> {
  const existing = await listAllProductFieldKeys();
  const key = detailKeyFor(input.name, existing);
  const type = input.kind === "row" ? "single_line_text_field" : "rich_text_field";

  const data = await adminGraphQL<{ metafieldDefinitionCreate: { userErrors: UserError[] } }>(
    "metafieldDefinitionCreate",
    OPERATIONS.metafieldDefinitionCreate.document,
    {
      definition: {
        name: input.name,
        namespace: METAFIELD_NAMESPACE,
        key,
        type,
        ownerType: "PRODUCT",
        access: { storefront: "PUBLIC_READ" },
        description: `Shown on the product page — added under Content → Product details.`,
      },
    },
  );
  assertNoUserErrors(data.metafieldDefinitionCreate.userErrors);
  return { key, name: input.name, type };
}

/** Every product field key, whatever its type — a new key must not collide with any. */
async function listAllProductFieldKeys(): Promise<string[]> {
  const data = await adminGraphQL<{ metafieldDefinitions: { nodes: { key: string }[] } }>(
    "productMetafieldDefinitions",
    OPERATIONS.productMetafieldDefinitions.document,
    {},
  );
  return data.metafieldDefinitions.nodes.map((definition) => definition.key);
}
