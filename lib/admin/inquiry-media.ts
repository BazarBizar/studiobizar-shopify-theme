import "server-only";

import type { InquiryItem } from "./inquiries";
import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

/**
 * Line items store only what the storefront captured at submission time — sku, title,
 * quantity, a variant gid and a product handle. Deliberately a SNAPSHOT rather than
 * product references, so an inquiry still reads correctly after a product is renamed or
 * withdrawn from the catalogue.
 *
 * The cost of that is thumbnails: they have to be resolved now, from the variant gids.
 * One request for the whole inquiry, not one per row.
 */

type RawVariant = {
  __typename: string;
  id: string;
  image?: { url: string } | null;
  product?: { featuredMedia?: { preview?: { image?: { url: string } | null } | null } | null } | null;
};

export type InquiryItemWithMedia = InquiryItem & { thumbnail: string | null };

export async function resolveItemThumbnails(
  items: InquiryItem[],
): Promise<InquiryItemWithMedia[]> {
  const ids = [...new Set(items.map((item) => item.variantId).filter((id): id is string => Boolean(id)))];

  if (ids.length === 0) return items.map((item) => ({ ...item, thumbnail: null }));

  try {
    const data = await adminGraphQL<{
      nodes: (RawVariant | null)[];
    }>("productVariantImages", OPERATIONS.productVariantImages.document, { ids: ids.slice(0, 250) });

    const byId = new Map(
      data.nodes
        .filter((node): node is RawVariant => Boolean(node?.id))
        // Most variants carry no image of their own, so the product's featured media is
        // the sensible fallback — otherwise nearly every row would show a placeholder.
        .map((node) => [node.id, node.image?.url ?? node.product?.featuredMedia?.preview?.image?.url ?? null]),
    );

    return items.map((item) => ({
      ...item,
      thumbnail: item.variantId ? (byId.get(item.variantId) ?? null) : null,
    }));
  } catch {
    // A missing thumbnail is a cosmetic loss; the inquiry itself must still open.
    return items.map((item) => ({ ...item, thumbnail: null }));
  }
}
