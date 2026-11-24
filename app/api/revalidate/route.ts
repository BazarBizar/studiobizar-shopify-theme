import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { TAGS } from "@/lib/shopify/constants";

/**
 * Drops the ISR cache for one entity class, so a Shopify change appears without
 * waiting out the revalidate window. This is what the cache tags on every
 * `shopifyFetch` are for — the panel's second drop comes through here, and it can be
 * called by hand after running a seed script.
 *
 *   POST /api/revalidate?tag=products     with header  x-revalidate-secret: …
 *   POST /api/revalidate?tag=page:about   one page builder page
 *   POST /api/revalidate?tag=all          every tag — on purpose, never by omission
 *
 * THE SECRET GOES IN THE HEADER ONLY. A query string is written to access logs, where
 * it outlives the request and is read by more people than the code is. Shopify's own
 * webhooks, which cannot set a header, have their own signed route
 * (`app/api/webhooks/shopify`).
 *
 * Without `REVALIDATE_SECRET` set, the route only works in development, so it is never
 * open in production.
 */
const VALID_TAGS = new Set<string>(Object.values(TAGS));
/** `page:<handle>` — `pageTag` in `lib/shopify/constants.ts`, Shopify's handle alphabet. */
const PAGE_TAG = /^page:[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

/** Equal, in time that does not depend on how much of the guess was right. */
function sameSecret(given: string, secret: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.REVALIDATE_SECRET;

  if (secret) {
    if (!sameSecret(request.headers.get("x-revalidate-secret") ?? "", secret)) {
      return NextResponse.json({ message: "Not authorised." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "REVALIDATE_SECRET is not set; refusing to revalidate." },
      { status: 401 },
    );
  }

  const requested = url.searchParams.get("tag");
  if (!requested) {
    return NextResponse.json(
      { message: `Say which tag: ?tag=<tag>, or ?tag=all for every one. Valid: ${[...VALID_TAGS].join(", ")}, page:<handle>` },
      { status: 400 },
    );
  }

  const tags = requested === "all" ? [...VALID_TAGS] : [requested];
  const unknown = tags.filter((tag) => !VALID_TAGS.has(tag) && !PAGE_TAG.test(tag));
  if (unknown.length) {
    return NextResponse.json(
      { message: `Unknown tag. Valid: ${[...VALID_TAGS].join(", ")}, page:<handle>, all` },
      { status: 400 },
    );
  }

  // Next 16 requires the profile argument; the single-argument form is deprecated.
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags });
}
