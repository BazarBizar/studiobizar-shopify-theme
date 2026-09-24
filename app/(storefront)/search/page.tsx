import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { ProductGrid } from "@/components/shop/product-grid";
import { Container } from "@/components/ui/container";
import { PRODUCTS_PER_PAGE, searchProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

/**
 * Product results on the shared grid — the same card as the shop, and the same
 * load more / infinite scroll, so "332 results" is not a promise of 24.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const results = query ? await searchProducts({ query, first: PRODUCTS_PER_PAGE }) : null;

  return (
    <PageShell surface="light">
      <Container className="py-section">
        <h1 className="text-h1">Search</h1>

        <form action="/search" className="mt-8 max-w-[32rem]">
          <div className="flex items-center gap-4 border-b border-foreground pb-2">
            <label htmlFor="q" className="sr-only">
              Search products
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search products"
              className="text-body w-full bg-transparent placeholder:text-muted focus:outline-none"
            />
            <button type="submit" className="text-button shrink-0 uppercase tracking-[0.06em]">
              Search
            </button>
          </div>
        </form>

        {results && (
          <p className="text-tertiary mt-6 text-muted">
            {results.totalCount} {results.totalCount === 1 ? "result" : "results"} for “{query}”
          </p>
        )}

        {results && results.items.length > 0 && (
          <div className="mt-10">
            <ProductGrid key={query} initial={results} search={query} />
          </div>
        )}

        {results && results.items.length === 0 && (
          <p className="text-body mt-10 text-muted">
            Nothing matched “{query}”. Try a different word, or browse{" "}
            <Link href="/shop" className="sb-underline">
              all products
            </Link>
            .
          </p>
        )}
      </Container>
    </PageShell>
  );
}
