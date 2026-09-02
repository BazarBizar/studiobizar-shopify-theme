"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The row carousel used by Signature Collections, New In and Monthly Selection.
 *
 * Slides are whatever children are passed, so the same component drives a
 * collection card and a product card. Width per slide is set by
 * `slideClassName` rather than a fixed count, so the row stays a scroller on
 * mobile and shows four across on desktop, matching the landing page.
 */
export function Carousel({
  children,
  slideClassName = "w-[78%] sm:w-[46%] lg:w-[calc(25%-0.5rem)]",
  ariaLabel,
  className,
}: {
  children: React.ReactNode[];
  slideClassName?: string;
  ariaLabel: string;
  className?: string;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });

  // Embla is an external store, so it is read through useSyncExternalStore
  // rather than mirrored into state from an effect.
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

  // Before embla initialises — on the server, and on the first client render —
  // a row with more than one slide is assumed scrollable, so the controls are
  // in the HTML rather than appearing only after hydration. Embla corrects both
  // values as soon as it measures.
  const many = children.length > 1;

  const canScrollPrev = useSyncExternalStore(
    subscribe,
    () => embla?.canScrollPrev() ?? false,
    () => false,
  );
  const canScrollNext = useSyncExternalStore(
    subscribe,
    () => embla?.canScrollNext() ?? many,
    () => many,
  );

  // With a single slide the arrows would never do anything.
  const scrollable = many;

  /**
   * Flanking the track rather than sitting under it. They overlay the slides,
   * so they carry a solid ground of their own — a bordered outline alone is
   * unreadable against a photograph.
   */
  const arrow =
    "absolute top-1/2 z-10 -translate-y-1/2 border border-foreground bg-background p-3 " +
    "text-foreground transition-opacity hover:opacity-80 " +
    "disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className={cn("relative", className)}>
      <div ref={emblaRef} className="overflow-hidden" role="region" aria-label={ariaLabel}>
        <div className="flex gap-grid-gap">
          {children.map((child, index) => (
            <div key={index} className={cn("min-w-0 shrink-0", slideClassName)}>
              {child}
            </div>
          ))}
        </div>
      </div>

      {scrollable && (
        <>
          <button
            type="button"
            onClick={() => embla?.scrollPrev()}
            disabled={!canScrollPrev}
            aria-label={`${ariaLabel}: previous`}
            className={cn(arrow, "left-3")}
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => embla?.scrollNext()}
            disabled={!canScrollNext}
            aria-label={`${ariaLabel}: next`}
            className={cn(arrow, "right-3")}
          >
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
