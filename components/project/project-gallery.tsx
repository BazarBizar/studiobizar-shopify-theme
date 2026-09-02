"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

// The viewer and its three stylesheets only load once someone opens it.
const Lightbox = dynamic(() => import("@/components/ui/lightbox").then((m) => m.Lightbox), {
  ssr: false,
});

/**
 * The gallery block from `DESK - Projects Detail).pdf`: a lead image with the
 * `01 / 04   VIEW GALLERY +` control overlaid bottom-left and bottom-right, in
 * earth on the image.
 */
export function ProjectGallery({ images, title }: { images: CaptionedImage[]; title: string }) {
  const [index, setIndex] = useState(-1);

  const usable = images.filter((item) => item.image);
  if (usable.length === 0) return null;

  const lead = usable[0]!;

  return (
    <>
      <figure className="relative">
        <button
          type="button"
          onClick={() => setIndex(0)}
          aria-label={`Open gallery, ${usable.length} images`}
          className="group relative block w-full overflow-hidden bg-foreground/5"
        >
          <span className="relative block aspect-wide w-full">
            <Image
              src={cdnImage(lead.image!.url, 1800)}
              alt={lead.image!.altText ?? title}
              fill
              className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.02]"
              sizes="100vw"
            />
          </span>

          {/* Measured at x=179 and x=1416 on the 1728 frame, in earth. */}
          <span
            data-surface="black"
            className="text-secondary pointer-events-none absolute inset-x-5 bottom-5 flex items-center justify-between text-foreground"
          >
            <span className="tabular-nums">
              01 / {String(usable.length).padStart(2, "0")}
            </span>
            <span className="flex items-center gap-2 uppercase tracking-[0.06em]">
              View gallery
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            </span>
          </span>
        </button>

        {lead.caption && (
          <figcaption className="text-tertiary mt-3 text-muted">{lead.caption}</figcaption>
        )}
      </figure>

      <Lightbox images={usable} index={index} onClose={() => setIndex(-1)} title={title} />
    </>
  );
}
