"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

const Lightbox = dynamic(() => import("@/components/ui/lightbox").then((m) => m.Lightbox), {
  ssr: false,
});

/**
 * The three-up row of square thumbnails under the product description, with a
 * trailing `+` tile — `DESK - Shop Detail.pdf`. All four open the same
 * lightbox over `custom.in_context_images`.
 */
export function InContextGallery({ images, title }: { images: CaptionedImage[]; title: string }) {
  const [index, setIndex] = useState(-1);
  const usable = images.filter((item) => item.image);
  if (usable.length === 0) return null;

  const visible = usable.slice(0, 3);

  return (
    <>
      <ul className="grid grid-cols-4 gap-3">
        {visible.map((item, i) => (
          <li key={item.handle}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Open in-context photos, image ${i + 1} of ${usable.length}`}
              className="relative block aspect-square w-full overflow-hidden bg-foreground/5 transition-opacity hover:opacity-85"
            >
              <Image
                src={cdnImage(item.image!.url, 320)}
                alt={item.image!.altText ?? item.caption ?? title}
                fill
                className="object-cover"
                sizes="120px"
              />
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setIndex(visible.length > 0 ? 0 : -1)}
            aria-label="View all in-context photos"
            className="flex aspect-square w-full items-center justify-center border border-foreground/20 bg-foreground/5 transition-colors hover:bg-foreground/10"
          >
            <Plus className="size-5" strokeWidth={1.5} aria-hidden />
          </button>
        </li>
      </ul>

      <Lightbox images={usable} index={index} onClose={() => setIndex(-1)} title={title} />
    </>
  );
}
