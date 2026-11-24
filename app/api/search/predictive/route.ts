import { NextResponse } from "next/server";

import { NO_STORE_HEADERS, PUBLIC_CACHE_HEADERS } from "@/lib/public-api";
import { predictiveSearch } from "@/lib/shopify";

/**
 * Backs the header's search overlay — instant results as you type, no page
 * navigation. `predictiveSearch` itself was already built and query-checked;
 * it just had no caller until now.
 *
 * Cached at the CDN per exact query for a few minutes (`lib/public-api.ts`): the same
 * words typed by different visitors are answered once. Never a neighbouring query's
 * results — the cache key is the whole URL.
 */
const MAX_QUERY_LENGTH = 100;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ products: [], collections: [], pages: [] }, { headers: PUBLIC_CACHE_HEADERS });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ message: "That search is too long." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const results = await predictiveSearch(query);
    return NextResponse.json(results, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("[api/search/predictive]", error);
    return NextResponse.json({ message: "Search is unavailable right now." }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
