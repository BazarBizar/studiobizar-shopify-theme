import { ProductCard } from "@/components/product/product-card";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * Product cards on the static 4-up grid — "Designed by …" on a designer's page.
 * Not `components/shop/product-grid.tsx`, which is Shop All's URL-driven,
 * infinitely scrolling grid; this one is just the cards it is given.
 */
export function ProductCardGrid({ products }: { products: ProductCardType[] }) {
  return (
    <ul className="sb-grid-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
