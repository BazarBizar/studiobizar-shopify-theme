import "server-only";

import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * The write half of a settings document kept as ONE json metafield on the shop and read
 * by the storefront — Shop categories (`shop-categories.ts`) and Site texts
 * (`site-texts.ts`). Each screen reads its own document with its own allowlisted query;
 * the write and the definition are the same for all of them.
 */

type UserError = { field?: string[] | null; message: string; code?: string | null };

/** Someone else saved since this screen read the document. */
export class ShopJsonConflict extends Error {
  constructor() {
    super("The document changed since it was read.");
    this.name = "ShopJsonConflict";
  }
}

/**
 * Creates the `custom.<key>` definition with storefront access. Called on a document's
 * first save when the store has none, so the screen works without a setup script.
 */
export async function ensureShopJsonDefinition({
  key,
  name,
  description,
}: {
  key: string;
  name: string;
  description: string;
}) {
  const data = await adminGraphQL<{ metafieldDefinitionCreate: { userErrors: UserError[] } }>(
    "metafieldDefinitionCreate",
    OPERATIONS.metafieldDefinitionCreate.document,
    {
      definition: {
        name,
        namespace: METAFIELD_NAMESPACE,
        key,
        type: "json",
        ownerType: "SHOP",
        access: { storefront: "PUBLIC_READ" },
        description,
      },
    },
  );
  // Made in another tab a moment ago — that is the outcome wanted.
  assertNoUserErrors(data.metafieldDefinitionCreate.userErrors.filter((error) => error.code !== "TAKEN"));
}

/**
 * Writes the whole document, refused with `ShopJsonConflict` when the stored one is no
 * longer `digest` (null: there must be none yet). Returns the new digest.
 */
export async function writeShopJson({
  shopId,
  key,
  value,
  digest,
}: {
  shopId: string;
  key: string;
  value: unknown;
  digest: string | null;
}): Promise<string | null> {
  const data = await adminGraphQL<{
    metafieldsSet: { metafields: { key: string; compareDigest: string }[] | null; userErrors: UserError[] };
  }>("shopJsonSet", OPERATIONS.shopJsonSet.document, {
    metafields: [
      { ownerId: shopId, namespace: METAFIELD_NAMESPACE, key, type: "json", value: JSON.stringify(value), compareDigest: digest },
    ],
  });
  if (data.metafieldsSet.userErrors.some((error) => error.code === "STALE_OBJECT")) throw new ShopJsonConflict();
  assertNoUserErrors(data.metafieldsSet.userErrors);
  return data.metafieldsSet.metafields?.[0]?.compareDigest ?? null;
}
