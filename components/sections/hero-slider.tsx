"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useSyncExternalStore } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";
import { cn } from "@/lib/utils/cn";

/**
 * The full-bleed hero at the top of the landing page.
 *
 * The number of slides is whatever `hero_slides` holds — one renders as a still
 * image with no controls, several render as a loop. Nothing is hard-coded to
 * three.
 *
 * Portrait on mobile: the 393px frames put the hero at 393×590 edge to edge,
 * which is 2:3, not the 16:10 the desktop frame crops to.
 */
export function HeroSlider({ slides }: { slides: CaptionedImage[] }) {
  const usable = slides.filter((slide) => slide.image);
  const multiple = usable.length > 1;

  const [emblaRef, embla] = useEmblaCarousel({
    loop: multiple,
    align: "start",
  });

  // Embla is an external store; reading it this way avoids mirroring its state
  // into React from an effect.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!embla) return () => {};
      embla.on("select", onChange).on("reInit", onChange);
      return () => {
        embla.off("select", onChange).off("reInit", onChange);
      };
    },
    [embla],
  );

  const selected = useSyncExternalStore(
    subscribe,
    () => embla?.selectedScrollSnap() ?? 0,
    () => 0,
  );

  if (usable.length === 0) return null;

  return (
    <section
      data-surface="black"
      className="relative isolate"
      aria-label="Featured interiors"
      aria-roledescription={multiple ? "carousel" : undefined}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {usable.map((slide, index) => (
            <div
              key={slide.handle}
              className="relative min-w-0 shrink-0 basis-full"
            >
              <div className="relative aspect-[2/3] w-full sm:aspect-[16/10] lg:aspect-[16/7]">
                <Image
                  src={cdnImage(slide.image!.url, 2400)}
                  alt={slide.image!.altText ?? slide.caption ?? ""}
                  fill
                  priority={index === 0}
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {multiple && (
        <>
          <button
            type="button"
            onClick={() => embla?.scrollPrev()}
            aria-label="Previous slide"
            className="absolute top-1/2 left-2.5 z-10 -translate-y-1/2 rounded-full border border-foreground bg-background/85 p-1 text-foreground opacity-70 transition-opacity hover:opacity-80 sm:left-5 sm:p-3"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => embla?.scrollNext()}
            aria-label="Next slide"
            className="absolute top-1/2 right-2.5 z-10 -translate-y-1/2 rounded-full border border-foreground bg-background/85 p-1 text-foreground opacity-70 transition-opacity hover:opacity-80 sm:right-5 sm:p-3"
          >
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}

      {multiple && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3">
          {usable.map((slide, index) => (
            <button
              key={slide.handle}
              type="button"
              onClick={() => embla?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1} of ${usable.length}`}
              aria-current={index === selected}
              className={cn(
                "h-1.5 w-8 bg-foreground transition-opacity",
                index === selected
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
