import { NextResponse } from "next/server";

import { categoryQuery, findCategory } from "@/lib/shopify/categories";
import {
  PRODUCTS_PER_PAGE,
  getCollectionProducts,
  getProducts,
  searchProducts,
} from "@/lib/shopify";

/**
 * Feeds the client-side infinite scroll on Shop All, collection pages and
 * search. The first page is rendered by the Server Component; this serves every
 * page after it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = findCategory(params.get("category"));

  const collection = params.get("collection");
  const search = params.get("q")?.trim();

  try {
    // A collection listing pages through the collection itself, which uses a
    // different sort-key enum — see resolveCollectionSort.
    const page = search
      ? await searchProducts({
          query: search,
          first: PRODUCTS_PER_PAGE,
          after: params.get("after") ?? undefined,
        })
      : collection
        ? await getCollectionProducts({
            handle: collection,
            first: PRODUCTS_PER_PAGE,
            after: params.get("after") ?? undefined,
            sort: params.get("sort"),
          })
        : await getProducts({
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
