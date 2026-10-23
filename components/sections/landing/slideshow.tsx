"use client";

import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import * as React from "react";

// The zod-free half: no validation code in a visitor's browser.
import { designStyle, type DesignValue } from "@/lib/page-builder/design-style";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { BANNER_HEIGHT, BANNER_HEIGHT_MOBILE, BannerCopyBlock, BannerImage, type BannerCopy, type CopyWidth } from "./image-banner";
import { alignFromPosition, ImagePlaceholder, mobilePositionClasses, Overlay, positionClasses, toneSurface, type Position } from "./shared";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export type Slide = {
  id: string;
  image: ShopifyImage | null;
  /** A crop for phones; the main image when absent. */
  mobileImage?: ShopifyImage | null;
  copy: BannerCopy;
  position: Position;
  /** Where the copy sits on phones, when that differs. */
  positionMobile?: Position | null;
  textWidth?: CopyWidth;
  tone: "light" | "dark";
  /** This slide's own darkening; the slider's when absent. */
  overlay?: { percent: number; color: string | null } | null;
  /** Typography and the like, for this slide only — see `lib/page-builder/design.ts`. */
  design?: DesignValue;
};

/**
 * Full-width slides with copy on each. Slides cross-fade rather than slide —
 * a photograph moving sideways under text is hard to read, and a fade needs no
 * carousel library.
 *
 * Accessible as the WAI-ARIA carousel pattern describes: a labelled region, each
 * slide a group "n of m", a pause control whenever it plays by itself, and no
 * autoplay at all for visitors who ask for reduced motion. Hovering or focusing
 * inside it pauses it too.
 */
export function Slideshow({
  slides,
  height,
  heightMobile,
  overlay,
  autoplay,
  interval,
  controls,
  transition = "fade",
  placeholder,
  priority = false,
}: {
  slides: Slide[];
  height: "small" | "medium" | "large" | "screen";
  /** On phones, when it differs. */
  heightMobile?: "small" | "medium" | "large" | "screen" | null;
  overlay: number;
  autoplay: boolean;
  interval: number;
  controls: "both" | "dots" | "arrows";
  /** How one slide gives way to the next. Reduced motion: always a fade. */
  transition?: "fade" | "slide" | "zoom";
  placeholder?: boolean;
  /** At the top of the page: the first slide loads at once. */
  priority?: boolean;
}) {
  const [index, setIndex] = React.useState(0);
  const [chosen, setPlaying] = React.useState(autoplay);
  const [held, setHeld] = React.useState(false);
  const count = slides.length;
  // Read, not copied into state: the preference can change while the page is open.
  const reduced = React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => true);
  const playing = chosen && !reduced;

  React.useEffect(() => {
    if (!playing || held || count < 2) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % count), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, held, index, count, interval]);

  if (count === 0) return null;
  const go = (next: number) => setIndex((next + count) % count);
  const showArrows = count > 1 && controls !== "dots";
  const showDots = count > 1 && controls !== "arrows";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Slideshow"
      className={cn(
        "bg-off-black relative isolate overflow-hidden",
        BANNER_HEIGHT[height],
        heightMobile && BANNER_HEIGHT_MOBILE[heightMobile],
      )}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      {slides.map((slide, position) => {
        const designed = designStyle(slide.design);
        const active = position === index;
        // Slide: each one stands where its place in the row puts it, and the row moves.
        const sliding = transition === "slide" && !reduced;
        const offset = position - index;
        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${count}`}
            aria-hidden={position !== index}
            inert={position !== index}
            {...designed.attrs}
            style={{ ...(designed.style as React.CSSProperties), ...(sliding ? { transform: `translateX(${offset * 100}%)` } : {}) }}
            className={cn(
              "absolute inset-0 flex ease-in-out",
              sliding ? "transition-transform duration-700" : "transition-opacity duration-700",
              !sliding && (active ? "opacity-100" : "opacity-0"),
              !active && "pointer-events-none",
            )}
          >
            {/* The slow zoom (Ken Burns): the active photograph grows a little over its time on screen. */}
            <div
              className={cn(
                "absolute inset-0 overflow-hidden",
                transition === "zoom" && "transition-transform ease-out motion-reduce:transition-none motion-reduce:transform-none",
                transition === "zoom" && (active ? "scale-[1.08]" : "scale-100"),
              )}
              style={transition === "zoom" && active ? { transitionDuration: `${interval + 1}s` } : undefined}
            >
              {slide.image ? (
                <BannerImage image={slide.image} mobileImage={slide.mobileImage} priority={priority && position === 0} />
              ) : (
                placeholder && <ImagePlaceholder />
              )}
            </div>
            <Overlay
              percent={slide.image ? (slide.overlay?.percent ?? overlay) : 0}
              color={slide.overlay?.color}
              max={slide.overlay ? 90 : 80}
            />
            <div
              data-surface={toneSurface(slide.tone)}
              className={cn(
                "sb-container py-section text-foreground relative flex w-full flex-col pb-20",
                positionClasses(slide.position),
                slide.positionMobile && mobilePositionClasses(slide.positionMobile),
              )}
            >
              <BannerCopyBlock
                copy={slide.copy}
                align={alignFromPosition(slide.position)}
                mobileAlign={slide.positionMobile ? alignFromPosition(slide.positionMobile) : undefined}
                width={slide.textWidth}
              />
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div
          data-surface={toneSurface(slides[index]!.tone)}
          className="sb-container text-foreground absolute inset-x-0 bottom-6 z-10 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            {showDots &&
              slides.map((slide, position) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Show slide ${position + 1}`}
                  aria-current={position === index}
                  onClick={() => go(position)}
                  className={cn(
                    "h-[2px] w-8 bg-current transition-opacity",
                    position === index ? "opacity-100" : "opacity-40 hover:opacity-70",
                  )}
                />
              ))}
          </div>
          <div className="flex items-center gap-1">
            {autoplay && !reduced && (
              <button
                type="button"
                aria-label={playing ? "Pause the slideshow" : "Play the slideshow"}
                onClick={() => setPlaying((value) => !value)}
                className="flex size-9 items-center justify-center opacity-80 hover:opacity-100"
              >
                {playing ? <Pause className="size-4" strokeWidth={1.5} /> : <Play className="size-4" strokeWidth={1.5} />}
              </button>
            )}
            {showArrows && (
              <>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => go(index - 1)}
                  className="flex size-9 items-center justify-center opacity-80 hover:opacity-100"
                >
                  <ArrowLeft className="size-5" strokeWidth={1.25} />
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => go(index + 1)}
                  className="flex size-9 items-center justify-center opacity-80 hover:opacity-100"
                >
                  <ArrowRight className="size-5" strokeWidth={1.25} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
