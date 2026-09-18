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
  /** Not a metaobject type — the collection write path passes this sentinel so a
   *  collection edit drops the catalogue's collection cache and nothing else. */
  collection: [TAGS.collections],
  /**
   * The footer reads this on all twenty-three routes, and the contact block on
   * five of them — both inside documents cached under `content`, which the
   * `metaobjects` tag does not cover.
   */
  site_settings: [TAGS.content],
  contact_channel: [TAGS.content],
  location: [TAGS.content],
  faq_item: [TAGS.content],
  service: [TAGS.content],
  captioned_image: [TAGS.content],
};

export async function revalidateForType(type: string): Promise<string[]> {
  // A collection edit has nothing to do with metaobjects, so it gets only its own tag.
  // Standard Shopify resources are not metaobjects, so each drops only its own tag.
  if (type === "collection") {
    revalidateTag(TAGS.collections, "max");
    return [TAGS.collections];
  }
  if (type === "product") {
    revalidateTag(TAGS.products, "max");
    return [TAGS.products];
  }
  /**
   * A page edit drops `content`, which is the tag every `getPage` document
   * carries. It also drops `metaobjects`, because a PAGE metafield is usually a
   * REFERENCE — `hero_slides` points at captioned_image entries, `locations` at
   * location entries — and changing which entries a page points at changes what
   * those cached documents resolve to.
   */
  /**
   * A menu is read by the header and the footer, which render inside every
   * cached page document — the same reason a page edit drops `content`. Nothing
   * about menus touches metaobjects.
   */
  if (type === "menu") {
    revalidateTag(TAGS.content, "max");
    return [TAGS.content];
  }
  if (type === "page") {
    revalidateTag(TAGS.content, "max");
    revalidateTag(TAGS.metaobjects, "max");
    return [TAGS.content, TAGS.metaobjects];
  }

  const tags = [TAGS.metaobjects, ...(EXTRA_TAGS[type] ?? [])];

  for (const tag of tags) {
    // Next 16 requires the cache-profile argument; the one-argument form is
    // deprecated. "max" means "drop it now", which is the point.
    revalidateTag(tag, "max");
  }

  return tags;
}
