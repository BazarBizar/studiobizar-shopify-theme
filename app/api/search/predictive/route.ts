import { NextResponse } from "next/server";

import { predictiveSearch } from "@/lib/shopify";

/**
 * Backs the header's search overlay — instant results as you type, no page
 * navigation. `predictiveSearch` itself was already built and query-checked;
 * it just had no caller until now.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ products: [], collections: [], pages: [] });
  }

  try {
    const results = await predictiveSearch(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/search/predictive]", error);
    return NextResponse.json({ message: "Search is unavailable right now." }, { status: 502 });
  }
}
