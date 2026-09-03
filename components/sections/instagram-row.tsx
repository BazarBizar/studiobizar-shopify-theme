import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";
import type { InstagramPost } from "@/lib/instagram/behold";

const PROFILE_URL = "https://www.instagram.com/studiobizarantwerp";

/**
 * The six-up Instagram row.
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
  // Six images beside the text column — a full row at `sm:grid-cols-6` below,
  // widened from the four-across measured layout.
  const tiles = live
    ? posts.slice(0, 6)
    : fallback.filter((item) => item.image).slice(0, 6);

  if (tiles.length === 0) return null;

  return (
    <section
      data-surface="light"
      className="bg-background py-16 text-foreground"
    >
      <Container className="grid items-start gap-8 lg:grid-cols-[20rem_1fr] lg:gap-10">
        <div className="flex flex-col items-start">
          <h2 className="text-h2">Instagram</h2>
          <ButtonLink
            href={PROFILE_URL}
            external
            variant="text"
            className="mt-6"
          >
            join our community
          </ButtonLink>
        </div>

        <ul className="grid grid-cols-2 gap-grid-gap sm:grid-cols-6">
          {tiles.map((tile) => {
            const isPost = "permalink" in tile;
            const src = isPost ? tile.imageUrl : cdnImage(tile.image!.url, 700);
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
                  sizes="(max-width: 749px) 50vw, 15vw"
                />
              </div>
            );

            return (
              <li key={isPost ? tile.id : tile.handle}>
                {isPost ? (
                  <a
                    href={tile.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={
                      tile.caption
                        ? `Instagram: ${tile.caption}`
                        : "View on Instagram"
                    }
                  >
                    {media}
                  </a>
                ) : (
                  media
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
