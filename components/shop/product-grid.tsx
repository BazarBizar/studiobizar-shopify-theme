"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ProductCard } from "@/components/product/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { DEFAULT_SORT } from "@/lib/shopify/constants";
import type { Paginated, ProductCard as ProductCardType } from "@/lib/shopify/types";

async function fetchPage({
  pageParam,
  category,
  sort,
  collection,
}: {
  pageParam?: string;
  category?: string;
  sort?: string;
  collection?: string;
}): Promise<Paginated<ProductCardType>> {
  const params = new URLSearchParams();
  if (pageParam) params.set("after", pageParam);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (collection) params.set("collection", collection);

  const response = await fetch(`/api/products?${params}`);
  if (!response.ok) throw new Error("Could not load more products.");
  return response.json() as Promise<Paginated<ProductCardType>>;
}

/**
 * The first page comes from the server so the grid is in the HTML; this only
 * takes over once the sentinel scrolls into view. The "Load more" button is a
 * real control, not a fallback — it is what keyboard users reach for.
 */
export function ProductGrid({
  initial,
  category,
  sort,
  collection,
}: {
  initial: Paginated<ProductCardType>;
  category?: string;
  sort?: string;
  /** Pages through one collection instead of the whole catalogue. */
  collection?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, refetch } =
    useInfiniteQuery({
      // The key carries the filters, so switching category starts a fresh list.
      queryKey: ["products", collection ?? category ?? "all", sort ?? DEFAULT_SORT],
      queryFn: ({ pageParam }) => fetchPage({ pageParam, category, sort, collection }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor ?? undefined : undefined),
      initialData: { pages: [initial], pageParams: [undefined] },
    });

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const products = data.pages.flatMap((page) => page.items);

  if (products.length === 0) {
    return (
      <p className="text-body py-16 text-muted">
        Nothing here yet. Try another category.
      </p>
    );
  }

  return (
    <>
      <ul className="sb-grid-4">
        {products.map((product, index) => (
          <li key={`${product.id}-${index}`}>
            <ProductCard product={product} priority={index < 4} />
          </li>
        ))}
        {isFetchingNextPage &&
          Array.from({ length: 4 }).map((_, index) => (
            <li key={`skeleton-${index}`}>
              <ProductCardSkeleton />
            </li>
          ))}
      </ul>

      <div ref={sentinel} className="h-px" />

      <div className="flex justify-center py-12">
        {isError ? (
          <button type="button" onClick={() => void refetch()} className="text-button sb-underline">
            Something went wrong — try again
          </button>
        ) : hasNextPage ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-button sb-underline uppercase tracking-[0.06em] disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading" : "Load more"}
          </button>
        ) : (
          <span className="text-tertiary text-muted">That’s everything.</span>
        )}
      </div>
    </>
  );
}
