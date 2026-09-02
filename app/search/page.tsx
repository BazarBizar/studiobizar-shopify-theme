import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { cdnImage, searchProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

/**
 * Minimal but working, so the header's search control has a real destination.
 * Step 13 adds projects and designers, `nuqs` URL state and infinite scroll,
 * and swaps this grid for the shared product card.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const results = query ? await searchProducts({ query, first: 24 }) : null;

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
          <ul className="sb-grid-4 mt-10">
            {results.items.map((product) => (
              <li key={product.id}>
                <Link href={`/shop/${product.handle}`} className="group block">
                  <div className="aspect-card overflow-hidden bg-surface">
                    {product.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cdnImage(product.image.url, 415)}
                        alt={product.image.altText ?? product.title}
                        width={415}
                        height={519}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <h2 className="text-secondary mt-3">{product.title}</h2>
                  {product.collectionLabel && (
                    <p className="text-tertiary text-muted">{product.collectionLabel}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
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
