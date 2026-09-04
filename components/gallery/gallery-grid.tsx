"use client";

import Image from "next/image";
import Masonry from "react-masonry-css";
import dynamic from "next/dynamic";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

const Lightbox = dynamic(() => import("@/components/ui/lightbox").then((m) => m.Lightbox), {
  ssr: false,
});

/**
 * Masonry, so images keep their own proportions instead of being cropped to a
 * common ratio — the gallery is the one place the photography is the subject.
 * Every tile opens the shared viewer at its own index.
 */
export function GalleryGrid({ images }: { images: CaptionedImage[] }) {
  const [index, setIndex] = useState(-1);
  const usable = images.filter((item) => item.image);

  if (usable.length === 0) {
    return <p className="text-body py-16 text-muted">No images published yet.</p>;
  }

  return (
    <>
      <Masonry
        breakpointCols={{ default: 3, 1023: 2, 749: 1 }}
        className="sb-masonry"
        columnClassName="sb-masonry-column"
      >
        {usable.map((item, position) => (
          <figure key={item.handle}>
            <button
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Open image ${position + 1} of ${usable.length}${item.caption ? `: ${item.caption}` : ""}`}
              className="group block w-full overflow-hidden bg-foreground/10"
            >
              <Image
                src={cdnImage(item.image!.url)}
                alt={item.image!.altText ?? item.caption ?? ""}
                width={item.image!.width ?? 1100}
                height={item.image!.height ?? 1400}
                className="h-auto w-full transition-transform duration-500 ease-out-soft group-hover:scale-[1.02]"
                sizes="(max-width: 749px) 100vw, (max-width: 1023px) 50vw, 33vw"
              />
            </button>

            {item.caption && (
              <figcaption className="text-tertiary mt-2 text-muted">{item.caption}</figcaption>
            )}
          </figure>
        ))}
      </Masonry>

      <Lightbox images={usable} index={index} onClose={() => setIndex(-1)} />
    </>
  );
}
