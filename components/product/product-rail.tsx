import { ButtonLink } from "@/components/ui/button";

import { ProductCard } from "@/components/product/product-card";
import { RowHeading } from "@/components/sections/row-heading";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import type { CarouselView } from "@/lib/page-builder/carousel-view";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * "The Collection" and "Discover More" — a heading, a 4-up carousel (with
 * arrows, per the design, rather than a static grid), and a `view all` link.
 *
 * `viewAllPlacement: "heading"` puts the link at the right of the heading
 * instead of under the row — the landing page's New In and Monthly Selection.
 */
export function ProductRail({
  title,
  products,
  viewAllHref,
  viewAllLabel = "view all",
  viewAllPlacement = "below",
  view,
}: {
  title: string;
  products: ProductCardType[];
  viewAllHref?: string;
  viewAllLabel?: string;
  viewAllPlacement?: "below" | "heading";
  /** The builder's carousel settings; absent: the row as designed. */
  view?: CarouselView;
}) {
  if (products.length === 0) return null;

  if (viewAllPlacement === "heading") {
    return (
      <Container className="pb-section">
        <RowHeading title={title} href={viewAllHref} label={viewAllLabel} />
        <Carousel ariaLabel={title} perView={view?.perView} step={view?.step}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Carousel>
      </Container>
    );
  }

  return (
    <Container className="pb-section">
      <h2 className="text-h2 mb-8">{title}</h2>

      <Carousel ariaLabel={title} perView={view?.perView} step={view?.step}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Carousel>

      {viewAllHref && (
        <div className="mt-8">
          <ButtonLink href={viewAllHref} variant="outline">
            {viewAllLabel}
          </ButtonLink>
        </div>
      )}
    </Container>
  );
}
