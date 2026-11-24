import "server-only";

import { headers } from "next/headers";

import { TAGS, pageTag, templateTag } from "./constants";

/**
 * Which storefront cache tags a change affects, and the second drop that waits for
 * Shopify to catch up — shared by the panel's write pipeline (`lib/admin/revalidate.ts`)
 * and Shopify's webhooks (`app/api/webhooks/shopify`).
 *
 * Here rather than in `lib/admin` because the webhook route is not part of the panel and
 * may not import from it (the import boundary in `eslint.config.mjs`). Nothing in this
 * module touches the Admin API token: it only names tags and calls this app's own
 * `/api/revalidate`.
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
 * saves, and the site shows the old version for up to a day (`REVALIDATE`).
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
export const STOREFRONT_SETTLE_MS = 35_000;

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
      // In a header, never the URL: a URL is written to access logs, a header is not.
      return fetch(url, { method: "POST", cache: "no-store", headers: secret ? { "x-revalidate-secret": secret } : {} })
        .then((response) => response.ok)
        .catch(() => false);
    }),
  );

  const ok = results.every(Boolean);
  if (!ok) console.warn(`[revalidate] the second cache drop failed for: ${tags.join(", ")}`);
  return ok;
}

/**
 * The storefront cache tags a change to `type` affects — no side effects, so the Shopify
 * webhook (`app/api/webhooks/shopify`) maps its topics through the same table. `handle`
 * narrows a page change to that one page; without it the whole of `content` goes.
 */
export function tagsForType(type: string, handle?: string): string[] {
  // A collection edit has nothing to do with metaobjects, so it gets only its own tag.
  // Standard Shopify resources are not metaobjects, so each drops only its own tag.
  if (type === "collection") return [TAGS.collections];
  if (type === "product") return [TAGS.products];
  /**
   * A menu is read by the header and the footer, which render inside every
   * cached page document — the same reason a page edit drops `content`. Nothing
   * about menus touches metaobjects.
   *
   * The Theme Builder's header and footer render inside every cached page, like a
   * menu — and the published layout itself is read under `content`.
   *
   * Shop All's category chips and the site's fixed texts — shop metafields read under
   * `content`. The texts are also in the inquiry emails, which read them fresh enough
   * from the same cache.
   */
  if (type === "menu" || type === "theme" || type === "shop_categories" || type === "site_texts" || type === "product_details") {
    return [TAGS.content];
  }
  /**
   * A page change, with its handle: that page's own document and the page list (the
   * sitemap) — not every page on the site. A PAGE metafield that REFERENCES entries
   * (`hero_slides` → captioned_image, `locations` → location) is resolved inside that
   * same `getPage` query, so its tag covers what the references resolve to.
   *
   * Without a handle (a rename, where the OLD address must go too), the safe wide drop:
   * every page document, and the metaobjects those documents point at.
   */
  if (type === "page") return handle ? [pageTag(handle), TAGS.pages] : [TAGS.content, TAGS.metaobjects];

  /**
   * A template (Website → Templates), with its kind: that template's document only —
   * every page drawn from it (all product pages, say) used it and so is refreshed.
   */
  if (type === "template") return handle ? [templateTag(handle)] : [TAGS.content];

  /**
   * Not page caches: the email routing and the panel's own branding are held in
   * memory (see `dropNow` in `lib/admin/revalidate.ts`), so they have no tags.
   */
  if (type === "email_notification" || type === "admin_settings") return [];

  return [TAGS.metaobjects, ...(EXTRA_TAGS[type] ?? [])];
}
