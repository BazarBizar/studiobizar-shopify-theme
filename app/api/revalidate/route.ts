import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { TAGS } from "@/lib/shopify/constants";

/**
 * Drops the ISR cache for one entity class, so a Shopify change appears without
 * waiting out the revalidate window. This is what the cache tags on every
 * `shopifyFetch` are for — point a Shopify webhook here, or call it by hand
 * after running a seed script.
 *
 *   POST /api/revalidate?tag=products&secret=…
 *
 * Without `REVALIDATE_SECRET` set, the route only accepts requests from
 * localhost, so it is usable in development but never open in production.
 */
const VALID_TAGS = new Set(Object.values(TAGS));

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.REVALIDATE_SECRET;

  if (secret) {
    if (url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ message: "Not authorised." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "REVALIDATE_SECRET is not set; refusing to revalidate." },
      { status: 401 },
    );
  }

  const requested = url.searchParams.get("tag");
  const tags = requested ? [requested] : [...VALID_TAGS];

  const unknown = tags.filter((tag) => !VALID_TAGS.has(tag as never));
  if (unknown.length) {
    return NextResponse.json(
      { message: `Unknown tag(s): ${unknown.join(", ")}. Valid: ${[...VALID_TAGS].join(", ")}` },
      { status: 400 },
    );
  }

  // Next 16 requires the profile argument; the single-argument form is deprecated.
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags });
}
