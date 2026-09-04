"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Pause, Play, Plus, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

// The viewer and its three stylesheets only load once someone opens it.
const Lightbox = dynamic(() => import("@/components/ui/lightbox").then((m) => m.Lightbox), {
  ssr: false,
});

/**
 * The gallery block from `DESK - Projects Detail).pdf`, extended for the
 * reference layout: a lead item with prev/next arrows overlaid on it, the
 * `01 / 04` counter and `VIEW GALLERY +` (opening the full lightbox) below a
 * hairline, then a thumbnail strip for everything except the lead.
 *
 * An entry with a `video` plays it in the lead position with a small custom
 * control bar — play/pause, a scrubbable progress bar, mute — rather than the
 * browser's native controls. `image` still serves as its poster and its
 * thumbnail.
 */
export function ProjectGallery({ images, title }: { images: CaptionedImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const usable = images.filter((item) => item.image);
  const current = usable[index];

  if (usable.length === 0 || !current) return null;

  // A new lead item always starts playing from the top — set alongside the
  // index itself rather than in an effect, so there is no extra render.
  function goTo(next: number) {
    setIndex((next + usable.length) % usable.length);
    setPlaying(true);
    setProgress(0);
  }

  return (
    <>
      <figure className="relative">
        <div className="relative aspect-2/3 w-full overflow-hidden bg-foreground/5 sm:aspect-wide">
          {current.video ? (
            <video
              ref={videoRef}
              key={current.handle}
              src={current.video.url}
              poster={current.image ? cdnImage(current.image.url) : undefined}
              autoPlay
              loop
              muted={muted}
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration) setProgress((video.currentTime / video.duration) * 100);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <Image
              src={cdnImage(current.image!.url)}
              alt={current.image!.altText ?? title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          )}

          {usable.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Previous"
                className="absolute top-1/2 left-5 z-10 -translate-y-1/2 rounded-full border border-foreground bg-background/85 p-3 text-foreground opacity-70 transition-opacity hover:opacity-100"
              >
                <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Next"
                className="absolute top-1/2 right-5 z-10 -translate-y-1/2 rounded-full border border-foreground bg-background/85 p-3 text-foreground opacity-70 transition-opacity hover:opacity-100"
              >
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </>
          )}

          {current.video && (
            <div
              data-surface="black"
              className="absolute inset-x-5 bottom-5 z-10 flex items-center gap-3 text-foreground"
            >
              <button
                type="button"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (video.paused) void video.play();
                  else video.pause();
                }}
                aria-label={playing ? "Pause" : "Play"}
                className="shrink-0 transition-opacity hover:opacity-70"
              >
                {playing ? (
                  <Pause className="size-4" strokeWidth={1.5} aria-hidden />
                ) : (
                  <Play className="size-4" strokeWidth={1.5} aria-hidden />
                )}
              </button>

              <button
                type="button"
                aria-label="Seek"
                onClick={(event) => {
                  const video = videoRef.current;
                  if (!video?.duration) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  video.currentTime = ((event.clientX - rect.left) / rect.width) * video.duration;
                }}
                className="h-1 flex-1 cursor-pointer bg-foreground/30"
              >
                <span className="block h-full bg-foreground" style={{ width: `${progress}%` }} />
              </button>

              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="shrink-0 transition-opacity hover:opacity-70"
              >
                {muted ? (
                  <VolumeX className="size-4" strokeWidth={1.5} aria-hidden />
                ) : (
                  <Volume2 className="size-4" strokeWidth={1.5} aria-hidden />
                )}
              </button>
            </div>
          )}
        </div>

        {current.caption && (
          <figcaption className="text-tertiary mt-3 text-muted">{current.caption}</figcaption>
        )}
      </figure>

      <div className="text-secondary mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(usable.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => setLightboxIndex(index)}
          className="flex items-center gap-2 uppercase tracking-[0.06em] transition-opacity hover:opacity-70"
        >
          View gallery
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {usable.length > 1 && (
        <ul className="mt-4 flex gap-3 overflow-x-auto">
          {usable.map((item, i) =>
            i === index ? null : (
              <li key={item.handle}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`View image ${i + 1} of ${usable.length}`}
                  className="relative block aspect-61/49 w-19 shrink-0 overflow-hidden bg-foreground/5 opacity-70 transition-opacity hover:opacity-100"
                >
                  <Image
                    src={cdnImage(item.image!.url, 240)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="76px"
                  />
                  {item.video && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="size-4 text-white" strokeWidth={1.5} fill="currentColor" aria-hidden />
                    </span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <Lightbox images={usable} index={lightboxIndex} onClose={() => setLightboxIndex(-1)} title={title} />
    </>
  );
}
