import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, after } from "next/server";

import { TAGS } from "@/lib/shopify/constants";
import { STOREFRONT_SETTLE_MS, dropInFreshRequest, tagsForType } from "@/lib/shopify/revalidation";

/**
 * SHOPIFY WEBHOOKS → STOREFRONT CACHE.
 *
 * Changes made in the panel refresh the storefront themselves (`lib/admin/revalidate.ts`).
 * This route does the same for changes made in Shopify's own admin, or by an import or
 * app — so the cache windows can be long (a day, `REVALIDATE`) without anything going
 * stale for that long.
 *
 * Registered by `yarn setup:webhooks` (scripts/setup-webhooks.mjs) through the panel's own
 * Shopify app: products, collections and the site's metaobject types, create / update /
 * delete. Shopify signs them with that app's client secret (API secret key), which goes in
 * `SHOPIFY_WEBHOOK_SECRET`.
 *
 * DELIBERATELY NOT inventory or order topics: the storefront shows neither price nor
 * stock, and those are the topics that fire hundreds of times in a stock sync.
 *
 * SECURITY. Every request must carry Shopify's HMAC of the exact body, checked in
 * constant time before anything else is read; an unsigned or wrongly signed request
 * changes nothing. The body is size-capped, the topic must be on the list below, and the
 * only effect a valid call can have is marking cached pages stale.
 *
 * WHY THE DROP WAITS. The Storefront API serves its old copy for 21–29 s after an
 * admin change (measured — see `lib/shopify/revalidation.ts`). Dropping at once would let
 * the next visitor refill the cache from that old copy for a whole day. So the drop
 * happens once Shopify has caught up, after responding — Shopify wants an answer within
 * five seconds.
 *
 * COST. Several webhooks for the same thing before anyone visits still mean one fresh
 * page: a drop only marks pages stale, the next visit draws the new copy, and Vercel
 * stores it only if it differs.
 */

/** Room for the wait before the drop. */
export const maxDuration = 60;

/** Well over a large product's payload, well under the platform's body limit. */
const MAX_BODY_BYTES = 2_000_000;

/** Metaobject types that also name a non-metaobject change in `tagsForType`. */
const NOT_METAOBJECT_TYPES = new Set(["collection", "product", "menu", "theme", "page", "shop_categories", "site_texts", "product_details"]);

/**
 * Entries that visitors' forms create (inquiries, contact messages, newsletter sign-ups) —
 * never on a page, so they must not refresh the site. `scripts/setup-webhooks.mjs` does not
 * subscribe them either; this is the second lock.
 */
const VISITOR_METAOBJECT_TYPES = new Set(["inquiry", "contact_message", "newsletter_subscriber"]);

function tagsForTopic(topic: string, body: unknown): string[] | null {
  const [resource, event] = topic.split("/");
  if (event !== "create" && event !== "update" && event !== "delete") return null;
  if (resource === "products") return tagsForType("product");
  if (resource === "collections") return tagsForType("collection");
  if (resource === "metaobjects") {
    const type = typeof (body as { type?: unknown } | null)?.type === "string" ? (body as { type: string }).type : "";
    if (VISITOR_METAOBJECT_TYPES.has(type)) return null;
    return type && !NOT_METAOBJECT_TYPES.has(type) ? tagsForType(type) : [TAGS.metaobjects];
  }
  return null;
}

function validSignature(raw: Buffer, given: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(raw).digest();
  let received: Buffer;
  try {
    received = Buffer.from(given, "base64");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/shopify] SHOPIFY_WEBHOOK_SECRET is not set; refusing every webhook.");
    return NextResponse.json({ message: "Not configured." }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ message: "Too large." }, { status: 413 });

  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ message: "Too large." }, { status: 413 });

  if (!validSignature(raw, request.headers.get("x-shopify-hmac-sha256") ?? "", secret)) {
    return NextResponse.json({ message: "Not authorised." }, { status: 401 });
  }

  // Signed by Shopify from here on — only now is the body worth parsing.
  const topic = request.headers.get("x-shopify-topic") ?? "";
  let body: unknown = null;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    body = null;
  }

  const tags = tagsForTopic(topic, body);
  // A topic we do not act on still gets a 200: anything else makes Shopify retry it for
  // two days and, in the end, remove the subscription.
  if (!tags?.length) return NextResponse.json({ ignored: topic });

  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, STOREFRONT_SETTLE_MS));
    await dropInFreshRequest(tags);
  });

  return NextResponse.json({ revalidating: tags });
}
