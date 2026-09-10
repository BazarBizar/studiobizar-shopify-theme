import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopControls } from "@/components/shop/shop-controls";
import { Container } from "@/components/ui/container";
import { PRODUCTS_PER_PAGE, getPage, getProducts } from "@/lib/shopify";
import { categoryQuery, findCategory } from "@/lib/shopify/categories";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse the Studio Bizar catalogue — furniture, lighting, textiles and objects, designed for life and inspired by the world.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const params = await searchParams;
  const categorySlug = typeof params.category === "string" ? params.category : undefined;
  const sort = typeof params.sort === "string" ? params.sort : undefined;
  const category = findCategory(categorySlug);

  // The design shows an intro under the title. Its source is a Shopify page
  // with handle "shop", which does not exist yet — until it does, the block is
  // simply absent rather than filled with placeholder copy.
  const [firstPage, intro] = await Promise.all([
    getProducts({
      first: PRODUCTS_PER_PAGE,
      sort,
      query: categoryQuery(category),
    }),
    getPage("shop").catch(() => null),
  ]);

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">Products</h1>
          {intro?.bodySummary && <p className="text-body mt-6">{intro.bodySummary}</p>}
        </header>

        <div className="mt-12">
          <ShopControls />
        </div>

        <div className="mt-10">
          <ProductGrid
            key={`${categorySlug ?? "all"}-${sort ?? "relevance"}`}
            initial={firstPage}
            category={categorySlug}
            sort={sort}
          />
        </div>
      </Container>
    </PageShell>
  );
}
