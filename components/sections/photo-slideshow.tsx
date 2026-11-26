"use client";

import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { BANNER_HEIGHT, BANNER_HEIGHT_MOBILE } from "./landing/image-banner";

/**
 * PHOTO SLIDESHOW — the page builder's `hero`: full-width photos and videos, no text.
 *
 * Left as designed it is the landing page's hero exactly: tall on phones, wide on
 * screens, round arrows at the sides, bars at the foot, moved by hand. Its settings
 * add the height (four sizes or full screen, on phones apart, or an exact one), whether
 * the photos fill the space or show whole, playing by itself, the way slides change,
 * the controls, and video slides: a video from Media plays muted in a loop like a
 * moving photo; YouTube and Vimeo play the same way, without their controls.
 *
 * Slides are stacked and the active one shown, so no carousel library is needed. As
 * the WAI-ARIA carousel pattern asks: each slide a group "n of m", a pause button
 * whenever it plays by itself, nothing moving by itself for visitors who ask for less
 * motion, and focus inside it holds it still.
 */

export type SlideshowVideo = { kind: "file"; url: string } | { kind: "youtube" | "vimeo"; id: string };

export type PhotoSlide = {
  id: string;
  image: ShopifyImage | null;
  /** A crop for phones; the photo when absent. */
  mobileImage?: ShopifyImage | null;
  video?: SlideshowVideo | null;
  /** What a video slide shows until it plays — and instead of it, with reduced motion. */
  poster?: ShopifyImage | null;
  /** The whole slide opens this page. */
  href?: string | null;
};

type Height = "designed" | "small" | "medium" | "large" | "screen";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const DESKTOP: Record<Height, string> = {
  designed: "aspect-[2/3] sm:aspect-[16/10] lg:aspect-[16/7]",
  small: BANNER_HEIGHT.small,
  medium: BANNER_HEIGHT.medium,
  large: BANNER_HEIGHT.large,
  screen: BANNER_HEIGHT.screen,
};
/** On phones, when it differs: each undoes what the desktop height set. */
const MOBILE: Record<Height, string> = {
  designed: "max-sm:aspect-[2/3] max-sm:h-auto max-sm:min-h-0",
  small: cn(BANNER_HEIGHT_MOBILE.small, "max-sm:aspect-auto max-sm:h-auto"),
  medium: cn(BANNER_HEIGHT_MOBILE.medium, "max-sm:aspect-auto max-sm:h-auto"),
  large: cn(BANNER_HEIGHT_MOBILE.large, "max-sm:aspect-auto max-sm:h-auto"),
  screen: cn(BANNER_HEIGHT_MOBILE.screen, "max-sm:aspect-auto max-sm:h-auto"),
};
const SPEED = { slow: 1200, normal: 700, fast: 400 } as const;

export function PhotoSlideshow({
  slides,
  height = "designed",
  heightMobile = "same",
  fit = "cover",
  autoplay = false,
  interval = 6,
  pauseOnHover = true,
  transition = "slide",
  speed = "normal",
  loop = true,
  controls = "both",
  controlsTone = "light",
  videoSound = false,
}: {
  slides: PhotoSlide[];
  height?: Height;
  heightMobile?: Height | "same";
  fit?: "cover" | "contain";
  autoplay?: boolean;
  interval?: number;
  pauseOnHover?: boolean;
  transition?: "slide" | "fade" | "zoom";
  speed?: keyof typeof SPEED;
  loop?: boolean;
  controls?: "both" | "arrows" | "dots" | "none";
  controlsTone?: "light" | "dark";
  videoSound?: boolean;
}) {
  const usable = slides.filter((slide) => slide.image || slide.video);
  const count = usable.length;
  const multiple = count > 1;

  const [index, setIndex] = React.useState(0);
  // Only whether the visitor pressed pause is kept: "Play by itself" itself is read each
  // draw, so switching it in the editor takes effect at once.
  const [paused, setPaused] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  // Slides shown once stay mounted, so a video does not start over each time.
  const [seen, setSeen] = React.useState<ReadonlySet<number>>(() => new Set([0]));
  const reduced = React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => true);
  const playing = autoplay && !paused && !reduced && multiple;
  const held = focused || (pauseOnHover && hovered);
  const atEnd = !loop && index === count - 1;

  const go = React.useCallback(
    (next: number) => {
      const target = loop ? (next + count) % count : Math.min(Math.max(next, 0), count - 1);
      setIndex(target);
      setSeen((before) => (before.has(target) ? before : new Set(before).add(target)));
    },
    [count, loop],
  );

  React.useEffect(() => {
    if (!playing || held || atEnd) return;
    const timer = window.setTimeout(() => go(index + 1), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, held, atEnd, index, interval, go]);

  // A swipe on a phone moves one slide.
  const start = React.useRef<number | null>(null);

  if (count === 0) return null;

  const duration = reduced ? 300 : SPEED[speed];
  const sliding = transition === "slide" && !reduced;
  const showArrows = multiple && (controls === "both" || controls === "arrows");
  const showBars = multiple && (controls === "both" || controls === "dots");
  const activeVideo = usable[index]?.video;

  const arrow =
    "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-foreground bg-background/85 p-1 text-foreground opacity-70 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-0 sm:p-3";

  return (
    <section
      data-surface="black"
      className="relative isolate"
      aria-label="Featured interiors"
      aria-roledescription={multiple ? "carousel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      onPointerDown={(event) => (start.current = event.clientX)}
      onPointerUp={(event) => {
        if (start.current === null || !multiple) return;
        const moved = event.clientX - start.current;
        start.current = null;
        if (Math.abs(moved) > 48) go(index + (moved < 0 ? 1 : -1));
      }}
    >
      <div
        // An exact height (the editor's "Or set an exact height", design.minHeight) sizes this
        // box, and its fixed shape gives way where one applies (styles/sb-design.css).
        data-sb-fill-height=""
        data-sb-fill-aspect=""
        className={cn(
          "relative w-full overflow-hidden",
          DESKTOP[height],
          heightMobile !== "same" && MOBILE[heightMobile],
        )}
      >
        {usable.map((slide, position) => {
          const active = position === index;
          return (
            <div
              key={slide.id}
              role={multiple ? "group" : undefined}
              aria-roledescription={multiple ? "slide" : undefined}
              aria-label={multiple ? `${position + 1} of ${count}` : undefined}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "absolute inset-0 ease-in-out",
                sliding ? "transition-transform" : "transition-opacity",
                !sliding && (active ? "opacity-100" : "opacity-0"),
              )}
              style={{
                transitionDuration: `${duration}ms`,
                ...(sliding ? { transform: `translateX(${(position - index) * 100}%)` } : {}),
              }}
            >
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden [container-type:size]",
                  transition === "zoom" && "transition-transform ease-out motion-reduce:transform-none motion-reduce:transition-none",
                  transition === "zoom" && (active ? "scale-[1.08]" : "scale-100"),
                )}
                style={transition === "zoom" && active ? { transitionDuration: `${interval + 1}s` } : undefined}
              >
                <SlideMedia
                  slide={slide}
                  fit={fit}
                  active={active}
                  mounted={seen.has(position)}
                  priority={position === 0}
                  reduced={reduced}
                  muted={muted}
                />
              </div>
              {slide.href ? (
                <a
                  href={slide.href}
                  className="absolute inset-0 z-[1]"
                  aria-label={slide.image?.altText || slide.poster?.altText || "Open"}
                  tabIndex={active ? undefined : -1}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div data-surface={controlsTone === "dark" ? "light" : undefined}>
        {showArrows && (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={!loop && index === 0} aria-label="Previous slide" className={cn(arrow, "left-2.5 sm:left-5")}>
              <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={atEnd} aria-label="Next slide" className={cn(arrow, "right-2.5 sm:right-5")}>
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          </>
        )}

        {showBars && (
          <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-3">
            {usable.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(position)}
                aria-label={`Go to slide ${position + 1} of ${count}`}
                aria-current={position === index}
                className={cn("h-1.5 w-8 bg-foreground transition-opacity", position === index ? "opacity-100" : "opacity-40 hover:opacity-70")}
              />
            ))}
          </div>
        )}

        {((autoplay && !reduced && multiple) || (videoSound && activeVideo?.kind === "file")) && (
          <div className="absolute right-2.5 bottom-4 z-10 flex items-center gap-1 sm:right-5">
            {videoSound && activeVideo?.kind === "file" && (
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
                className="flex size-9 items-center justify-center rounded-full bg-background/70 text-foreground opacity-80 hover:opacity-100"
              >
                {muted ? <VolumeX className="size-4" strokeWidth={1.5} /> : <Volume2 className="size-4" strokeWidth={1.5} />}
              </button>
            )}
            {autoplay && !reduced && multiple && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? "Play the slideshow" : "Pause the slideshow"}
                className="flex size-9 items-center justify-center rounded-full bg-background/70 text-foreground opacity-80 hover:opacity-100"
              >
                {paused ? <Play className="size-4" strokeWidth={1.5} /> : <Pause className="size-4" strokeWidth={1.5} />}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SlideMedia({
  slide,
  fit,
  active,
  mounted,
  priority,
  reduced,
  muted,
}: {
  slide: PhotoSlide;
  fit: "cover" | "contain";
  active: boolean;
  mounted: boolean;
  priority: boolean;
  reduced: boolean;
  muted: boolean;
}) {
  const object = fit === "contain" ? "object-contain" : "object-cover";
  const still = (image: ShopifyImage, mobile?: ShopifyImage | null) => (
    <>
      <Image
        src={cdnImage(image.url)}
        alt={image.altText ?? ""}
        fill
        priority={priority}
        sizes="100vw"
        className={cn(object, mobile && "max-sm:hidden")}
      />
      {mobile && <Image src={cdnImage(mobile.url)} alt={mobile.altText ?? image.altText ?? ""} fill priority={priority} sizes="100vw" className={cn(object, "sm:hidden")} />}
    </>
  );

  if (!slide.video) return slide.image ? still(slide.image, slide.mobileImage) : null;
  // Less motion: the photo it has, else nothing moving at all.
  if (reduced && slide.poster) return still(slide.poster);
  if (slide.video.kind === "file") return <FileVideo url={slide.video.url} poster={slide.poster} fit={fit} active={active} muted={muted} reduced={reduced} />;

  // YouTube / Vimeo as a moving photo: no controls, muted, looping — loaded once shown.
  const { kind, id } = slide.video;
  const src =
    kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1`
      : `https://player.vimeo.com/video/${id}?background=1&autoplay=1&loop=1&muted=1&dnt=1`;
  return (
    <>
      {slide.poster ? still(slide.poster) : null}
      {mounted && !reduced ? (
        <iframe
          src={src}
          title={slide.poster?.altText || "Video"}
          allow="autoplay; fullscreen; picture-in-picture"
          tabIndex={-1}
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0",
            // Cover: the 16:9 frame grows past the box on its short side, as object-fit would.
            fit === "contain" ? "h-full w-full" : "h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)]",
          )}
        />
      ) : null}
    </>
  );
}

function FileVideo({
  url,
  poster,
  fit,
  active,
  muted,
  reduced,
}: {
  url: string;
  poster?: ShopifyImage | null;
  fit: "cover" | "contain";
  active: boolean;
  muted: boolean;
  reduced: boolean;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  // Only the slide on screen plays; with reduced motion, none does by itself.
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (active && !reduced) void element.play().catch(() => {});
    else element.pause();
  }, [active, reduced]);
  React.useEffect(() => {
    if (ref.current) ref.current.muted = muted || !active;
  }, [muted, active]);
  return (
    <video
      ref={ref}
      src={url}
      poster={poster ? cdnImage(poster.url) : undefined}
      muted
      loop
      playsInline
      preload={active ? "auto" : "metadata"}
      aria-hidden
      className={cn("absolute inset-0 h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
    />
  );
}
