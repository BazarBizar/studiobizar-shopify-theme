import { ButtonLink } from "@/components/ui/button";

import { ProductCard } from "@/components/product/product-card";
import { Container } from "@/components/ui/container";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * "The Collection" and "Discover More" — a heading, the same 4-up grid as Shop
 * All, and a `view all` link.
 */
export function ProductRail({
  title,
  products,
  viewAllHref,
}: {
  title: string;
  products: ProductCardType[];
  viewAllHref?: string;
}) {
  if (products.length === 0) return null;

  return (
    <Container className="pb-section">
      <h2 className="text-h2 mb-8">{title}</h2>

      <ul className="sb-grid-4">
        {products.slice(0, 4).map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {viewAllHref && (
        <div className="mt-8">
          <ButtonLink href={viewAllHref}>view all</ButtonLink>
        </div>
      )}
    </Container>
  );
}
