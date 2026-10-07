import Image from "next/image";

import type { ButtonVariant } from "@/components/ui/button";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import {
  Buttons,
  Eyebrow,
  HEADING,
  ImagePlaceholder,
  ITEMS_ALIGN,
  Overlay,
  positionClasses,
  TEXT_ALIGN,
  toneSurface,
  type Align,
  type HeadingSize,
  type LandingLink,
  type Position,
} from "./shared";

export type BannerHeight = "small" | "medium" | "large" | "screen" | "adapt";

export const BANNER_HEIGHT: Record<Exclude<BannerHeight, "adapt">, string> = {
  small: "min-h-[24rem] sm:min-h-[45svh]",
  medium: "min-h-[30rem] sm:min-h-[65svh]",
  large: "min-h-[36rem] sm:min-h-[85svh]",
  screen: "min-h-svh",
};

export type BannerCopy = {
  eyebrow?: string;
  title?: string;
  body?: string;
  headingSize: HeadingSize;
  primary?: LandingLink | null;
  primaryStyle?: ButtonVariant;
  secondary?: LandingLink | null;
  secondaryStyle?: ButtonVariant;
};

/** The copy block of a banner or a slide: label, heading, text, buttons. */
export function BannerCopyBlock({ copy, align, className }: { copy: BannerCopy; align: Align; className?: string }) {
  return (
    <div className={cn("flex max-w-[46rem] flex-col", ITEMS_ALIGN[align], TEXT_ALIGN[align], className)}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      {copy.title?.trim() && <h2 className={HEADING[copy.headingSize]}>{copy.title}</h2>}
      {copy.body?.trim() && <p className="text-body mt-5 max-w-[38rem] whitespace-pre-line">{copy.body}</p>}
      <Buttons
        primary={copy.primary}
        primaryStyle={copy.primaryStyle}
        secondary={copy.secondary}
        secondaryStyle={copy.secondaryStyle}
        align={align}
        className="mt-8"
      />
    </div>
  );
}

/** A photograph filling its box, with an optional narrower crop for phones. */
export function BannerImage({
  image,
  mobileImage,
  priority,
}: {
  image: ShopifyImage | null;
  mobileImage?: ShopifyImage | null;
  priority?: boolean;
}) {
  if (!image) return null;
  return (
    <>
      <Image
        src={cdnImage(image.url)}
        alt={image.altText ?? ""}
        fill
        priority={priority}
        sizes="100vw"
        className={cn("object-cover", mobileImage && "max-sm:hidden")}
      />
      {mobileImage && (
        <Image
          src={cdnImage(mobileImage.url)}
          alt={mobileImage.altText ?? image.altText ?? ""}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover sm:hidden"
        />
      )}
    </>
  );
}

/**
 * A full-width photograph with copy placed on it. The copy takes the tokens of
 * the off-black or the earth surface (`tone`), so a button on it is the site's
 * own button, inverted correctly — never a colour typed in.
 */
export function ImageBanner({
  image,
  mobileImage,
  copy,
  height,
  position,
  align,
  tone,
  overlay,
  panel,
  placeholder,
  priority,
}: {
  image: ShopifyImage | null;
  mobileImage?: ShopifyImage | null;
  copy: BannerCopy;
  height: BannerHeight;
  position: Position;
  align: Align;
  tone: "light" | "dark";
  overlay: number;
  panel: boolean;
  placeholder?: boolean;
  priority?: boolean;
}) {
  const adapt = height === "adapt" && image?.width && image.height;

  return (
    <section
      className={cn("bg-off-black relative isolate flex overflow-hidden", !adapt && BANNER_HEIGHT[height === "adapt" ? "large" : height])}
      style={adapt ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
    >
      {image ? <BannerImage image={image} mobileImage={mobileImage} priority={priority} /> : placeholder && <ImagePlaceholder />}
      <Overlay percent={image ? overlay : 0} />

      <div
        data-surface={toneSurface(tone)}
        className={cn("sb-container py-section text-foreground relative flex w-full flex-col", adapt && "max-sm:min-h-[30rem]", positionClasses(position))}
      >
        <BannerCopyBlock
          copy={copy}
          align={align}
          className={panel ? "bg-background max-w-[40rem] p-8 sm:p-12" : undefined}
        />
      </div>
    </section>
  );
}
