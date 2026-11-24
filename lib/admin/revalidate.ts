import "server-only";

import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { clearAdminSettingsCache } from "@/lib/admin/admin-settings";
import { clearNotificationRecipientsCache } from "@/lib/email/notification-recipients";
import { STOREFRONT_SETTLE_MS, dropInFreshRequest, tagsForType } from "@/lib/shopify/revalidation";

/** Shared with the Shopify webhook route; re-exported so the panel's imports stay here. */
export { STOREFRONT_SETTLE_MS, dropInFreshRequest, tagsForType };

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
 * Every write drops the cache twice — see `STOREFRONT_SETTLE_MS` in
 * `lib/shopify/revalidation.ts` for why, and `settle: false` for callers (the page
 * builder) that schedule their own second drop after polling for what they published.
 */

function dropAgainOnceShopifyCatchesUp(tags: string[]) {
  if (tags.length === 0) return;
  try {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, STOREFRONT_SETTLE_MS));
      await dropInFreshRequest(tags);
    });
  } catch {
    // Outside a request (a script, a test) there is no `after` — and no visitor
    // whose cache needs the second drop.
  }
}

export async function revalidateForType(
  type: string,
  { settle = true, handle }: { settle?: boolean; handle?: string } = {},
): Promise<string[]> {
  const tags = dropNow(type, handle);
  if (settle) dropAgainOnceShopifyCatchesUp(tags);
  return tags;
}

function dropNow(type: string, handle?: string): string[] {
  /**
   * Not a page cache: the routing is held in memory by the email senders for a
   * minute. Dropping it here makes an edit live at once on this instance; any other
   * instance picks it up when its minute runs out.
   */
  if (type === "email_notification") clearNotificationRecipientsCache();
  // The panel's own branding — no storefront page reads it.
  if (type === "admin_settings") clearAdminSettingsCache();

  const tags = tagsForType(type, handle);
  for (const tag of tags) {
    // Next 16 requires the cache-profile argument; the one-argument form is
    // deprecated. "max" marks the entries stale: the next visit is served the old
    // copy while a fresh one is drawn — and Vercel stores (and bills) that fresh copy
    // only when it actually differs.
    revalidateTag(tag, "max");
  }
  return tags;
}
