import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopControls } from "@/components/shop/shop-controls";
import { Container } from "@/components/ui/container";
import {
  DEFAULT_SORT,
  PRODUCTS_PER_PAGE,
  countCollectionProducts,
  countProducts,
  getCollectionProducts,
  getListedCollections,
  getPage,
  getProducts,
} from "@/lib/shopify";
import { categoryQuery, findCategory } from "@/lib/shopify/categories";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse the Studio Bizar catalogue — furniture, lighting, textiles and objects, designed for life and inspired by the world.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const params = await searchParams;
  const sort = typeof params.sort === "string" ? params.sort : undefined;

  // `view` decides which row of chips filters the grid, so only that view's
  // param counts — a stale ?category= left in a "by collection" URL is ignored.
  const byCollection = params.view === "collection";
  // Awaited ahead of the rest because it validates ?collection=: an unknown
  // handle falls back to "all", as an unknown ?category= does. Cached, so cheap.
  const collections = await getListedCollections().catch(() => []);
  const collectionHandle = byCollection
    ? collections.find((item) => item.handle === params.collection)?.handle
    : undefined;
  const categorySlug =
    !byCollection && typeof params.category === "string" ? params.category : undefined;
  const category = findCategory(categorySlug);
  const query = categoryQuery(category);

  // The design shows an intro under the title. Its source is a Shopify page
  // with handle "shop", which does not exist yet — until it does, the block is
  // simply absent rather than filled with placeholder copy.
  //
  // The count only exists under a filter: it is feedback for a chip click, and
  // Storefront search caps its total at 1,000, below the full catalogue. A
  // failed count hides the number rather than the page.
  const [firstPage, intro, total] = await Promise.all([
    collectionHandle
      ? getCollectionProducts({ handle: collectionHandle, first: PRODUCTS_PER_PAGE, sort })
      : getProducts({ first: PRODUCTS_PER_PAGE, sort, query }),
    getPage("shop").catch(() => null),
    (collectionHandle
      ? countCollectionProducts(collectionHandle)
      : query
        ? countProducts(query)
        : Promise.resolve(null)
    ).catch(() => null),
  ]);

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">Products</h1>
          {intro?.bodySummary && <p className="text-body mt-6">{intro.bodySummary}</p>}
        </header>

        <div className="mt-12">
          <ShopControls
            total={total ?? undefined}
            collections={collections.map(({ handle, title }) => ({ handle, title }))}
          />
        </div>

        <div className="mt-10">
          <ProductGrid
            key={`${collectionHandle ?? categorySlug ?? "all"}-${sort ?? DEFAULT_SORT}`}
            initial={firstPage}
            category={categorySlug}
            collection={collectionHandle}
            sort={sort}
          />
        </div>
      </Container>
    </PageShell>
  );
}
