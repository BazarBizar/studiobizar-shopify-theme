import "server-only";

import { z } from "zod";

import {
  assignSlugs,
  CATEGORY_LIMITS,
  DEFAULT_CATEGORIES,
  parseShopCategories,
  SHOP_CATEGORIES_KEY,
  SHOP_CATEGORIES_VERSION,
  type Category,
  type StoredShopCategories,
} from "@/lib/shopify/categories";

import { OPERATIONS } from "./operations";
import { ensureShopJsonDefinition, ShopJsonConflict, writeShopJson } from "./shop-json";
import { adminGraphQL } from "./shopify";

/**
 * Content → Shop categories: the chips above Shop All's grid (`lib/shopify/categories.ts`).
 *
 * One json metafield on the shop, written whole. Like the email settings, a save names
 * the digest it was made from and Shopify refuses it when someone saved in between, so
 * two tabs cannot overwrite each other unseen.
 *
 * The first save also creates the metafield's definition when the store has none: the
 * definition is what lets the Storefront API read the list, and making it here means
 * nobody has to run a setup script before the screen works.
 */

export class ShopCategoriesError extends Error {
  readonly code: "CONFLICT" | "INVALID";
  constructor(code: ShopCategoriesError["code"], message: string) {
    super(message);
    this.name = "ShopCategoriesError";
    this.code = code;
  }
}

type Raw = {
  shop: { id: string; categories: { value: string; compareDigest: string } | null };
  productTypes: { nodes: string[] };
  metafieldDefinitions: { nodes: { id: string }[] };
};

async function readState() {
  const data = await adminGraphQL<Raw>("shopCategories", OPERATIONS.shopCategories.document, {});
  return {
    shopId: data.shop.id,
    digest: data.shop.categories?.compareDigest ?? null,
    stored: parseShopCategories(data.shop.categories?.value),
    productTypes: data.productTypes.nodes.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    hasDefinition: data.metafieldDefinitions.nodes.length > 0,
  };
}

export type ShopCategoriesView = {
  /** The saved list, or the original one before the first save. */
  categories: Category[];
  /** False until the list has been saved once — the site still draws the original. */
  saved: boolean;
  /** Names the version on screen; a save from an older one is refused. */
  digest: string | null;
  /** Every product type in the store, alphabetical. */
  productTypes: string[];
  savedAt: string | null;
  savedBy: string | null;
};

export async function shopCategoriesView(): Promise<ShopCategoriesView> {
  const state = await readState();
  return {
    categories: state.stored ? state.stored.categories : DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    saved: state.stored !== null,
    digest: state.digest,
    productTypes: state.productTypes,
    savedAt: state.stored?.savedAt ?? null,
    savedBy: state.stored?.savedBy ?? null,
  };
}

export const shopCategoriesInput = z.strictObject({
  digest: z.string().max(200).nullable(),
  categories: z
    .array(
      z.strictObject({
        slug: z.string().max(80).nullable(),
        label: z
          .string()
          .trim()
          .min(1, "Every category needs a name.")
          .max(CATEGORY_LIMITS.label, `A category name can be at most ${CATEGORY_LIMITS.label} characters.`),
        types: z
          .array(z.string().min(1).max(CATEGORY_LIMITS.type))
          .min(1, "Every category needs at least one product type.")
          .max(CATEGORY_LIMITS.types),
      }),
    )
    .max(CATEGORY_LIMITS.categories, `The Shop page can show at most ${CATEGORY_LIMITS.categories} categories.`),
});

export type ShopCategoriesInput = z.infer<typeof shopCategoriesInput>;

const CONFLICT = "Someone else changed the categories just now. Reload the page to see their version.";

export async function saveShopCategories(
  input: ShopCategoriesInput,
  actor: string,
): Promise<{ digest: string | null; categories: Category[]; savedAt: string }> {
  const state = await readState();
  if (state.digest !== input.digest) throw new ShopCategoriesError("CONFLICT", CONFLICT);

  const categories = assignSlugs(input.categories);
  const savedAt = new Date().toISOString();
  const next: StoredShopCategories = { version: SHOP_CATEGORIES_VERSION, categories, savedAt, savedBy: actor };

  if (!state.hasDefinition) {
    await ensureShopJsonDefinition({
      key: SHOP_CATEGORIES_KEY,
      name: "Shop categories",
      description: "The category chips on the Shop page, managed under Content → Shop categories in the admin panel. Do not edit by hand.",
    });
  }

  try {
    const digest = await writeShopJson({ shopId: state.shopId, key: SHOP_CATEGORIES_KEY, value: next, digest: state.digest });
    return { digest, categories, savedAt };
  } catch (error) {
    if (error instanceof ShopJsonConflict) throw new ShopCategoriesError("CONFLICT", CONFLICT);
    throw error;
  }
}
