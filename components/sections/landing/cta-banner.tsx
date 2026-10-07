import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { BannerCopyBlock, BannerImage, type BannerCopy } from "./image-banner";
import { Buttons, Eyebrow, HEADING, ImagePlaceholder, Overlay, toneSurface } from "./shared";

const WIDTH = { narrow: "max-w-[36rem]", medium: "max-w-[52rem]", full: "max-w-none" } as const;

/**
 * One message and its buttons. `center` and `split` sit on the section's own
 * surface (the universal Background setting); `image` puts them on a photograph.
 */
export function CtaBanner({
  copy,
  layout,
  image,
  tone,
  overlay,
  width,
  placeholder,
}: {
  copy: BannerCopy;
  layout: "center" | "split" | "image";
  image: ShopifyImage | null;
  tone: "light" | "dark";
  overlay: number;
  width: keyof typeof WIDTH;
  placeholder?: boolean;
}) {
  if (layout === "split") {
    return (
      <div className="sb-container py-section">
        <div className="border-border grid gap-8 border-t pt-10 lg:grid-cols-[3fr_2fr] lg:items-end lg:gap-16">
          <div className={WIDTH[width]}>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            {copy.title?.trim() && <h2 className={HEADING[copy.headingSize]}>{copy.title}</h2>}
            {copy.body?.trim() && <p className="text-body text-muted mt-5 whitespace-pre-line">{copy.body}</p>}
          </div>
          <Buttons
            primary={copy.primary}
            primaryStyle={copy.primaryStyle}
            secondary={copy.secondary}
            secondaryStyle={copy.secondaryStyle}
            className="lg:justify-end"
          />
        </div>
      </div>
    );
  }

  if (layout === "image") {
    return (
      <section className="bg-off-black relative isolate overflow-hidden">
        {image ? <BannerImage image={image} /> : placeholder && <ImagePlaceholder />}
        <Overlay percent={image ? overlay : 0} />
        <div data-surface={toneSurface(tone)} className="sb-container py-section-lg text-foreground relative flex justify-center">
          <BannerCopyBlock copy={copy} align="center" className={cn("mx-auto", WIDTH[width])} />
        </div>
      </section>
    );
  }

  return (
    <div className="sb-container py-section flex justify-center">
      <BannerCopyBlock copy={copy} align="center" className={cn("mx-auto", WIDTH[width])} />
    </div>
  );
}
