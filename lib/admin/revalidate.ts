import "server-only";

import { revalidateTag } from "next/cache";

import { TAGS } from "@/lib/shopify/constants";

/**
 * Drops the storefront's ISR cache for whatever an admin write just changed.
 *
 * This is the one thing a single-repo setup gets for free that two separate apps
 * cannot have: the process that wrote to Shopify is the same process that serves
 * the public pages, so it can invalidate them in-band. No webhook to register, no
 * deploy, no waiting out a TTL — an operator saves a project and the change is on
 * the site.
 *
 * It is deliberately NOT a full cache purge. `TAGS.products` and
 * `TAGS.collections` are left alone by a metaobject write, because rebuilding the
 * catalogue pages costs real Storefront API budget and a designer's bio has
 * nothing to do with them.
 */

/**
 * Metaobject type -> storefront cache tags.
 *
 * Everything reaches the storefront through a metaobject query, so `metaobjects`
 * is always right. `content` is added for the types that are ALSO pulled in via
 * PAGE metafields (`lib/shopify/constants.ts` PAGE_METAFIELDS: `channels`,
 * `locations`, `inquiry_types`) — those render inside cached page documents, which
 * the `metaobjects` tag does not cover.
 */
const EXTRA_TAGS: Record<string, string[]> = {
  contact_channel: [TAGS.content],
  location: [TAGS.content],
  faq_item: [TAGS.content],
  service: [TAGS.content],
  captioned_image: [TAGS.content],
};

export async function revalidateForType(type: string): Promise<string[]> {
  const tags = [TAGS.metaobjects, ...(EXTRA_TAGS[type] ?? [])];

  for (const tag of tags) {
    // Next 16 requires the cache-profile argument; the one-argument form is
    // deprecated. "max" means "drop it now", which is the point.
    revalidateTag(tag, "max");
  }

  return tags;
}
