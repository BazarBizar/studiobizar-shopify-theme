import { CollectionCard } from "@/components/collection/collection-card";
import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
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
}: {
  title: string;
  collections: CollectionCardType[];
  viewAllHref?: string;
}) {
  if (collections.length === 0) return null;

  return (
    <>
      <section data-surface="light" className="bg-background py-16 text-foreground">
        <Container>
          <h2 className="text-h2 mb-8">{title}</h2>
          <Carousel ariaLabel={title}>
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </Carousel>
        </Container>
      </section>

      {viewAllHref && (
        <Container className="flex justify-center py-14">
          <ButtonLink href={viewAllHref}>view all</ButtonLink>
        </Container>
      )}
    </>
  );
}
