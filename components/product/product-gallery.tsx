"use client";

import Image from "next/image";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * Thumbnail rail on the far left, main image beside it — the arrangement
 * measured off the PDF. Collapses to a horizontal rail on mobile.
 *
 * Neither the main image nor the thumbnails crop to a fixed ratio — product
 * photography varies shot to shot, and a crop would cut pieces off some of
 * it. The thumbnails share one width and let height follow each photo's own
 * proportions; the main image is unconstrained in both dimensions.
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
                  "block w-[3.8rem] shrink-0 overflow-hidden bg-foreground/5 transition-opacity",
                  index === active ? "opacity-100" : "opacity-55 hover:opacity-85",
                )}
              >
                {image.width && image.height ? (
                  // Same fixed width for every thumbnail, but each keeps its
                  // own photo's real proportions rather than a shared crop —
                  // a portrait shot sits taller in the rail than a landscape one.
                  <Image
                    src={cdnImage(image.url, 240)}
                    alt=""
                    width={image.width}
                    height={image.height}
                    className="h-auto w-full"
                    sizes="61px"
                  />
                ) : (
                  <div className="relative aspect-61/49 w-full">
                    <Image src={cdnImage(image.url, 240)} alt="" fill className="object-cover" sizes="61px" />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="w-full overflow-hidden bg-foreground/5">
        {current.width && current.height ? (
          // The photo's own proportions, not a crop to a fixed ratio — a
          // portrait shot and a landscape shot are simply different heights.
          <Image
            key={current.url}
            src={cdnImage(current.url)}
            alt={current.altText ?? title}
            width={current.width}
            height={current.height}
            priority
            className="h-auto w-full"
            sizes="(max-width: 1023px) 100vw, 45vw"
          />
        ) : (
          // Shopify didn't report dimensions for this file — fall back to a
          // filled box rather than rendering at no size at all.
          <div className="relative aspect-card w-full">
            <Image
              key={current.url}
              src={cdnImage(current.url)}
              alt={current.altText ?? title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1023px) 100vw, 45vw"
            />
          </div>
        )}
      </div>
    </div>
  );
}
