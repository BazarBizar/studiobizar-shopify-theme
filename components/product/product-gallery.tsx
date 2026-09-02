"use client";

import Image from "next/image";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * Thumbnail rail on the far left, 691×864 (4:5) main image beside it — the
 * arrangement measured off the PDF. Collapses to a horizontal rail on mobile.
 */
export function ProductGallery({ images, title }: { images: ShopifyImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  if (!current) {
    return <div className="aspect-card w-full bg-foreground/5" />;
  }

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-6">
      {images.length > 1 && (
        <ul className="flex shrink-0 gap-3 overflow-x-auto lg:w-[3.8rem] lg:flex-col lg:overflow-visible">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`View image ${index + 1} of ${images.length}`}
                aria-current={index === active}
                className={cn(
                  "relative block aspect-[61/49] w-[3.8rem] overflow-hidden bg-foreground/5 transition-opacity",
                  index === active ? "opacity-100" : "opacity-55 hover:opacity-85",
                )}
              >
                <Image
                  src={cdnImage(image.url, 240)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="61px"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative aspect-card w-full overflow-hidden bg-foreground/5">
        <Image
          key={current.url}
          src={cdnImage(current.url, 1400)}
          alt={current.altText ?? title}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1023px) 100vw, 45vw"
        />
      </div>
    </div>
  );
}
