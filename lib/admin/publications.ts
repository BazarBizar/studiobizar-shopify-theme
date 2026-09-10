import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

/**
 * Sales channels. Listed separately from the product because the switch list has to offer
 * every channel in the store, including the ones this product is NOT on — a list built
 * only from the product's own assignments could never be used to add one.
 */

export async function listPublications(): Promise<{ id: string; name: string }[]> {
  const data = await adminGraphQL<{ publications: { nodes: { id: string; name: string }[] } }>(
    "publications",
    OPERATIONS.publications.document,
    {},
  );

  return data.publications.nodes;
}
