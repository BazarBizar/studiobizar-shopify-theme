import Image from "next/image";
import Link from "next/link";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CollectionCard as CollectionCardType } from "@/lib/shopify/types";

/**
 * A 3:5 image with the collection wordmark laid over it, then the title and the
 * designer byline — the card from `DESK - Collections All.pdf`. The mobile
 * frame runs it full width at 353×235, so the media turns landscape (3:2)
 * below 750px rather than becoming a 588px-tall portrait.
 *
 * The design uses a supplied logo per collection (`custom.hero_logo`). Where
 * none is set the title is typeset instead, which is why the wordmark below can
 * be either an image or text.
 */
export function CollectionCard({
  collection,
}: {
  collection: CollectionCardType;
}) {
  const image = collection.cardImage ?? collection.image;

  // "The Arc Teak Collection" reads as "ARC TEAK" in the design.
  const wordmark = collection.title
    .replace(/^The\s+/i, "")
    .replace(/\s+Collection$/i, "");

  const byline = [collection.designer?.name, collection.designer?.studio]
    .filter(Boolean)
    .join(", ");

  return (
    <article>
      <Link
        href={`/collections/${collection.handle}`}
        className="group block mb-5"
      >
        <div className="relative aspect-3/2 overflow-hidden bg-foreground/5 sm:aspect-3/5">
          {image && (
            <Image
              src={cdnImage(image.url)}
              alt={image.altText ?? collection.title}
              fill
              className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
              sizes="(max-width: 749px) 50vw, 25vw"
            />
          )}

          <div
            className="absolute inset-0 flex items-center justify-center p-6"
            data-surface="dark"
          >
            {collection.logo ? (
              <Image
                src={cdnImage(collection.logo.url)}
                alt=""
                width={300}
                height={100}
                className="h-auto w-3/5 object-contain"
              />
            ) : (
              <span className="text-display text-center leading-none tracking-[0.02em] text-foreground uppercase">
                {wordmark}
              </span>
            )}
          </div>
        </div>

        <h2 className="text-dark-wood mt-3">{collection.title}</h2>
        {byline && <p className="text-tertiary mt-1 text-slate">by {byline}</p>}
      </Link>
    </article>
  );
}
