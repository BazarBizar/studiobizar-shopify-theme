import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";
import type { InstagramPost } from "@/lib/instagram/behold";

const PROFILE_URL = "https://www.instagram.com/studiobizarantwerp";

/**
 * A heading, a five-up carousel of square tiles with arrows over the first
 * and last, and a bordered "join our community" link below — same band shape
 * as `ProductRail`.
 *
 * Prefers the live Behold feed; falls back to the page's `gallery` metafield
 * when `BEHOLD_FEED_ID` is unset or the feed is unreachable, so the section
 * never collapses. Live tiles link to the post, fallback tiles do not.
 */
export function InstagramRow({
  posts,
  fallback,
}: {
  posts: InstagramPost[];
  fallback: CaptionedImage[];
}) {
  const live = posts.length > 0;
  const tiles = live ? posts : fallback.filter((item) => item.image);

  if (tiles.length === 0) return null;

  return (
    <section data-surface="light" className="bg-background py-16 text-foreground">
      <Container>
        <h2 className="text-h2 mb-8">Instagram</h2>

        <Carousel
          ariaLabel="Instagram"
          slideClassName="w-[45%] sm:w-[30%] lg:w-[calc(20%-0.5rem)]"
        >
          {tiles.map((tile) => {
            const isPost = "permalink" in tile;
            const src = isPost ? tile.imageUrl : cdnImage(tile.image!.url);
            const alt = isPost
              ? (tile.caption ?? "Studio Bizar on Instagram")
              : (tile.image!.altText ?? tile.caption ?? "");

            const media = (
              <div className="relative aspect-square overflow-hidden bg-foreground/10">
                <Image
                  src={src}
                  alt={alt}
                  fill
                  // Behold serves Instagram CDN URLs, which are already sized.
                  unoptimized={isPost}
                  className="object-cover transition-transform duration-500 ease-out-soft hover:scale-[1.03]"
                  sizes="(max-width: 749px) 45vw, 20vw"
                />
              </div>
            );

            return isPost ? (
              <a
                key={tile.id}
                href={tile.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tile.caption ? `Instagram: ${tile.caption}` : "View on Instagram"}
              >
                {media}
              </a>
            ) : (
              <div key={tile.handle}>{media}</div>
            );
          })}
        </Carousel>

        <ButtonLink href={PROFILE_URL} external variant="outline" className="mt-8">
          join our community
        </ButtonLink>
      </Container>
    </section>
  );
}
