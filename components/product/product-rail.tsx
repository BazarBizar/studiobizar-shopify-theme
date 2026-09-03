import { ButtonLink } from "@/components/ui/button";

import { ProductCard } from "@/components/product/product-card";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * "The Collection" and "Discover More" — a heading, a 4-up carousel (with
 * arrows, per the design, rather than a static grid), and a `view all` link.
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

      <Carousel ariaLabel={title}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Carousel>

      {viewAllHref && (
        <div className="mt-8">
          <ButtonLink href={viewAllHref} variant="outline">
            view all
          </ButtonLink>
        </div>
      )}
    </Container>
  );
}
