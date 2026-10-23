import { CollectionCard } from "@/components/collection/collection-card";
import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import type { CarouselView } from "@/lib/page-builder/carousel-view";
import type { CollectionCard as CollectionCardType } from "@/lib/shopify/types";

/**
 * The landing page's "Signature Collections": a carousel of collection cards on
 * its own earth band, then `view all` centred beneath it on whatever ground the
 * page has — as measured.
 */
export function CollectionCarousel({
  title,
  collections,
  viewAllHref,
  viewAllLabel = "view all",
  view,
}: {
  title: string;
  collections: CollectionCardType[];
  viewAllHref?: string;
  viewAllLabel?: string;
  /** The builder's carousel settings; absent: the row as designed. */
  view?: CarouselView;
}) {
  if (collections.length === 0) return null;

  return (
    <>
      <section data-surface="light" className="sb-band bg-background py-16 text-foreground">
        <Container>
          <h2 className="text-h2 mb-8">{title}</h2>
          <Carousel ariaLabel={title} perView={view?.perView} step={view?.step}>
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </Carousel>
        </Container>
      </section>

      {viewAllHref && (
        <Container className="flex justify-center py-14">
          <ButtonLink href={viewAllHref}>{viewAllLabel}</ButtonLink>
        </Container>
      )}
    </>
  );
}
