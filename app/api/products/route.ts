import { NextResponse } from "next/server";

import { categoryQuery, findCategory } from "@/lib/shopify/categories";
import { PRODUCTS_PER_PAGE, getProducts } from "@/lib/shopify";

/**
 * Feeds the client-side infinite scroll on Shop All. The first page is
 * rendered by the Server Component; this serves every page after it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = findCategory(params.get("category"));

  try {
    const page = await getProducts({
      first: PRODUCTS_PER_PAGE,
      after: params.get("after") ?? undefined,
      sort: params.get("sort"),
      query: categoryQuery(category),
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("[api/products]", error);
    return NextResponse.json({ message: "Could not load more products." }, { status: 502 });
  }
}
