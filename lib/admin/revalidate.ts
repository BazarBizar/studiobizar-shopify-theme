import "server-only";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

import { clearAdminSettingsCache } from "@/lib/admin/admin-settings";
import { clearNotificationRecipientsCache } from "@/lib/email/notification-recipients";
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

/**
 * WHY EVERY WRITE DROPS THE CACHE TWICE.
 *
 * The Storefront API goes on serving its cached response for a while after an
 * Admin write — 21 to 29 seconds, measured on this store. Dropping Next's cache
 * at the moment of the write lets the next visitor refill it from that stale
 * response, and the stale copy then stays for the whole ISR window: an operator
 * saves, and the site shows the old version for up to an hour.
 *
 * So the same tags are dropped again once Shopify has had time to catch up, from
 * `after()` so the response is not held for it. The write routes set
 * `maxDuration` so the function may run that long after responding.
 *
 * THE SECOND DROP MUST BE A SEPARATE REQUEST. Next honours one `revalidateTag`
 * per tag per request: calling it again for the same tag later in the same
 * request — `after()` included — is silently ignored. Measured, not assumed; see
 * `dropInFreshRequest`. So the second drop goes through `/api/revalidate`, which
 * is its own request.
 *
 * `settle: false` is for callers that schedule their own second drop, which the
 * page builder does after polling for the exact version it published.
 */
const STOREFRONT_SETTLE_MS = 35_000;

/**
 * Hosts this app may call itself on. The second drop carries `REVALIDATE_SECRET`,
 * so it is only ever sent to this app's own origin — never to whatever a request's
 * Host header claims.
 */
function trustedOrigin(host: string, proto: string): string | null {
  const name = host.split(":")[0]!.toLowerCase();
  const allowed = new Set(
    [
      process.env.STOREFRONT_URL,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        try {
          return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );

  const local = name === "localhost" || name === "127.0.0.1";
  if (!local && !allowed.has(name)) return null;
  return `${local ? proto : "https"}://${host}`;
}

/**
 * Drops `tags` from a NEW request — the only way a second drop of a tag already
 * dropped in this request takes effect. Reads this request's headers for the
 * origin, which route handlers may do inside `after()`.
 */
export async function dropInFreshRequest(tags: string[]): Promise<boolean> {
  if (tags.length === 0) return true;

  let origin: string | null = null;
  try {
    const incoming = await headers();
    const host = incoming.get("host");
    const proto = incoming.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    origin = host ? trustedOrigin(host, proto) : null;
  } catch {
    origin = null;
  }

  if (!origin) {
    console.warn("[revalidate] no trusted origin for the second cache drop; the ISR window will catch up instead.");
    return false;
  }

  const secret = process.env.REVALIDATE_SECRET;
  const results = await Promise.all(
    tags.map((tag) => {
      const url = new URL("/api/revalidate", origin);
      url.searchParams.set("tag", tag);
      if (secret) url.searchParams.set("secret", secret);
      return fetch(url, { method: "POST", cache: "no-store" })
        .then((response) => response.ok)
        .catch(() => false);
    }),
  );

  const ok = results.every(Boolean);
  if (!ok) console.warn(`[revalidate] the second cache drop failed for: ${tags.join(", ")}`);
  return ok;
}

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
  { settle = true }: { settle?: boolean } = {},
): Promise<string[]> {
  const tags = dropNow(type);
  if (settle) dropAgainOnceShopifyCatchesUp(tags);
  return tags;
}

function dropNow(type: string): string[] {
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

  /**
   * Not a page cache: the routing is held in memory by the email senders for a
   * minute. Dropping it here makes an edit live at once on this instance; any other
   * instance picks it up when its minute runs out.
   */
  if (type === "email_notification") {
    clearNotificationRecipientsCache();
    return [];
  }
  // The panel's own branding — no storefront page reads it.
  if (type === "admin_settings") {
    clearAdminSettingsCache();
    return [];
  }

  const tags = [TAGS.metaobjects, ...(EXTRA_TAGS[type] ?? [])];

  for (const tag of tags) {
    // Next 16 requires the cache-profile argument; the one-argument form is
    // deprecated. "max" means "drop it now", which is the point.
    revalidateTag(tag, "max");
  }

  return tags;
}
