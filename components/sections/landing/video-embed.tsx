"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import type { VideoRef } from "@/lib/page-builder/fields";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { SectionHeader } from "./shared";

const RATIO = { "16:9": "aspect-video", "4:3": "aspect-[4/3]", "21:9": "aspect-[21/9]", "9:16": "aspect-[9/16] max-h-[85svh]" } as const;
const WIDTH = { narrow: "max-w-[44rem]", medium: "max-w-[64rem]", full: "max-w-none" } as const;

/**
 * The embed address is built from provider and id only (`parseVideoUrl`), never
 * from what was typed. YouTube's privacy-enhanced host sets no cookie until play.
 */
function embedSrc(video: VideoRef): string {
  return video.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1`;
}

/**
 * A video behind a cover. Nothing is requested from YouTube or Vimeo until the
 * visitor presses play — no third-party script, cookie or thumbnail on page
 * load — and the page stays as fast as one without a video.
 */
export function VideoEmbed({
  title,
  intro,
  headingAlign,
  video,
  cover,
  caption,
  ratio,
  width,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  video: VideoRef | null;
  cover: ShopifyImage | null;
  caption: string;
  ratio: keyof typeof RATIO;
  width: keyof typeof WIDTH;
}) {
  const name = title.trim() || caption.trim() || "Video";

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      <VideoPlayer
        video={video}
        cover={cover}
        caption={caption}
        ratio={ratio}
        name={name}
        className={cn("mx-auto", WIDTH[width], ratio === "9:16" && "max-w-[28rem]")}
      />
    </div>
  );
}

/**
 * The player alone — the cover, the play button, then the iframe. The Video section
 * draws it, and so does a Video block in a Custom section.
 */
export function VideoPlayer({
  video,
  cover,
  caption,
  ratio,
  name,
  className,
}: {
  video: VideoRef | null;
  cover: ShopifyImage | null;
  caption: string;
  ratio: keyof typeof RATIO;
  name: string;
  className?: string;
}) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <figure className={className}>
      <div className={cn("bg-off-black relative w-full overflow-hidden", RATIO[ratio])}>
        {playing && video ? (
          <iframe
            src={embedSrc(video)}
            title={name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            disabled={!video}
            aria-label={`Play: ${name}`}
            className="group absolute inset-0 flex items-center justify-center"
          >
            {cover && (
              <Image
                src={cdnImage(cover.url)}
                alt=""
                fill
                sizes="(max-width: 749px) 100vw, 80vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            )}
            <span
              data-surface="light"
              className="bg-background text-foreground relative flex size-16 items-center justify-center rounded-full transition-transform group-hover:scale-105 sm:size-20"
            >
              <Play className="ml-1 size-6 sm:size-7" strokeWidth={1.25} fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      {caption.trim() && <figcaption className="text-tertiary text-muted mt-3">{caption}</figcaption>}
    </figure>
  );
}
