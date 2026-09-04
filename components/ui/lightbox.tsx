"use client";

import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Video from "yet-another-react-lightbox/plugins/video";
import Base from "yet-another-react-lightbox";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";

import { BRAND } from "@/lib/brand";
import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

/**
 * The viewer specified by `DESK - Gallery.pdf`: one image centred on an
 * off-black ground, a `01 / 04` counter bottom-left and the caption beneath.
 *
 * That PDF is a component spec, not a page — its four frames are the same
 * 1404×944 panel repeated, and its counter is drawn in Figma's annotation
 * purple rather than a real colour. The same viewer serves Projects Detail and
 * the Gallery page, so it lives here rather than beside either one.
 */
export function Lightbox({
  images,
  index,
  onClose,
  title,
}: {
  images: CaptionedImage[];
  /** -1 closes. */
  index: number;
  onClose: () => void;
  title?: string;
}) {
  if (index < 0) return null;

  return (
    <Base
      open
      index={index}
      close={onClose}
      plugins={[Counter, Captions, Video]}
      counter={{ container: { style: { top: "unset", bottom: 0, left: 0 } } }}
      captions={{ descriptionTextAlign: "start", showToggle: false }}
      carousel={{ finite: images.length <= 1 }}
      video={{ autoPlay: true, controls: true }}
      styles={{
        // #1D1D1B, the ground measured in the spec.
        container: { backgroundColor: `${BRAND.offBlack}F5` },
        captionsDescription: { color: BRAND.earth, fontSize: "0.875rem" },
      }}
      slides={images
        .filter((item) => item.image)
        .map((item) => {
          const description = [item.caption, item.credit].filter(Boolean).join(" · ") || undefined;

          if (item.video) {
            return {
              type: "video" as const,
              poster: cdnImage(item.image!.url),
              width: item.video.width ?? undefined,
              height: item.video.height ?? undefined,
              sources: [{ src: item.video.url, type: item.video.mimeType }],
              description,
            };
          }

          return {
            src: cdnImage(item.image!.url),
            alt: item.image!.altText ?? title ?? "",
            description,
          };
        })}
    />
  );
}
