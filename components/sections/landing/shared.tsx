import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * What the landing sections share. Every value here is a class the design system
 * already has — the type scale, the surfaces, the one button — so a section built
 * from these cannot drift from the rest of the site.
 */

export type HeadingSize = "h2" | "h1" | "display";

export const HEADING: Record<HeadingSize, string> = {
  h2: "text-h2",
  h1: "text-h1",
  display: "text-display leading-[1.05]",
};

export type Align = "left" | "center" | "right";

export const TEXT_ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** For a flex column: where its children sit across. */
export const ITEMS_ALIGN: Record<Align, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
};

/** For a flex row of buttons. */
export const JUSTIFY: Record<Align, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/** The same three on phones only (below 750px) — for copy placed differently there. */
export const TEXT_ALIGN_MOBILE: Record<Align, string> = {
  left: "max-sm:text-left",
  center: "max-sm:text-center",
  right: "max-sm:text-right",
};
export const ITEMS_ALIGN_MOBILE: Record<Align, string> = {
  left: "max-sm:items-start",
  center: "max-sm:items-center",
  right: "max-sm:items-end",
};
export const JUSTIFY_MOBILE: Record<Align, string> = {
  left: "max-sm:justify-start",
  center: "max-sm:justify-center",
  right: "max-sm:justify-end",
};

export type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const VERTICAL = { top: "justify-start", middle: "justify-center", bottom: "justify-end" } as const;
const HORIZONTAL = { left: "items-start", center: "items-center", right: "items-end" } as const;

/** A 3 × 3 position → the flex classes that put a column there. */
export function positionClasses(position: Position): string {
  const [vertical, horizontal] = position.split("-") as [keyof typeof VERTICAL, keyof typeof HORIZONTAL];
  return cn(VERTICAL[vertical] ?? VERTICAL.middle, HORIZONTAL[horizontal] ?? HORIZONTAL.center);
}

const VERTICAL_MOBILE = { top: "max-sm:justify-start", middle: "max-sm:justify-center", bottom: "max-sm:justify-end" } as const;
const HORIZONTAL_MOBILE = { left: "max-sm:items-start", center: "max-sm:items-center", right: "max-sm:items-end" } as const;

/** `positionClasses` for phones only — where a slide puts its copy differently there. */
export function mobilePositionClasses(position: Position): string {
  const [vertical, horizontal] = position.split("-") as [keyof typeof VERTICAL_MOBILE, keyof typeof HORIZONTAL_MOBILE];
  return cn(VERTICAL_MOBILE[vertical] ?? VERTICAL_MOBILE.middle, HORIZONTAL_MOBILE[horizontal] ?? HORIZONTAL_MOBILE.center);
}

/** The column the copy aligns with, from where it sits. */
export function alignFromPosition(position: Position): Align {
  return (position.split("-")[1] as Align | undefined) ?? "center";
}

export type LandingLink = { href: string; label: string };

const isExternal = (href: string) => /^https?:\/\//i.test(href);

export function Buttons({
  primary,
  primaryStyle = "solid",
  secondary,
  secondaryStyle = "outline",
  align = "left",
  mobileAlign,
  className,
}: {
  primary?: LandingLink | null;
  primaryStyle?: ButtonVariant;
  secondary?: LandingLink | null;
  secondaryStyle?: ButtonVariant;
  align?: Align;
  /** Where the row sits on phones, when that differs. */
  mobileAlign?: Align;
  className?: string;
}) {
  const links = [
    primary?.href && primary.label ? { ...primary, variant: primaryStyle } : null,
    secondary?.href && secondary.label ? { ...secondary, variant: secondaryStyle } : null,
  ].filter((item): item is LandingLink & { variant: ButtonVariant } => item !== null);
  if (links.length === 0) return null;

  return (
    <div data-sb-buttons="" className={cn("flex flex-wrap gap-3", JUSTIFY[align], mobileAlign && JUSTIFY_MOBILE[mobileAlign], className)}>
      {links.map((item) => (
        <ButtonLink key={`${item.href}-${item.label}`} href={item.href} variant={item.variant} external={isExternal(item.href)}>
          {item.label}
        </ButtonLink>
      ))}
    </div>
  );
}

/** The small uppercase line above a heading. */
export function Eyebrow({ children, className }: { children?: string; className?: string }) {
  if (!children?.trim()) return null;
  return <p className={cn("text-tertiary mb-3 uppercase tracking-[0.08em] opacity-80", className)}>{children}</p>;
}

/** A section's own heading and intro, above its content. */
export function SectionHeader({
  title,
  intro,
  align = "left",
  className,
}: {
  title?: string;
  intro?: string;
  align?: "left" | "center";
  className?: string;
}) {
  if (!title?.trim() && !intro?.trim()) return null;
  return (
    <header className={cn("mb-10 sm:mb-14", align === "center" && "mx-auto max-w-[46rem] text-center", className)}>
      {title?.trim() && <h2 className="text-h2">{title}</h2>}
      {intro?.trim() && (
        <p className={cn("text-body text-muted mt-4 max-w-[46rem] whitespace-pre-line", align === "center" && "mx-auto")}>
          {intro}
        </p>
      )}
    </header>
  );
}

export type Ratio = "portrait" | "square" | "landscape" | "adapt";

export const RATIO: Record<Exclude<Ratio, "adapt">, string> = {
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  landscape: "aspect-[4/3]",
};

/**
 * A Shopify image in a box of a given shape. `adapt` takes the photograph's own
 * proportions. With no image, `placeholder` draws a neutral box — the builder's
 * preview passes it so an unfilled section shows its shape; the live site never
 * does, and an image-less tile simply has no picture.
 */
export function Picture({
  image,
  ratio = "portrait",
  sizes,
  className,
  imageClassName,
  placeholder = false,
  priority = false,
}: {
  image: ShopifyImage | null | undefined;
  ratio?: Ratio;
  sizes: string;
  className?: string;
  imageClassName?: string;
  placeholder?: boolean;
  priority?: boolean;
}) {
  if (!image && !placeholder) return null;
  const adapt = ratio === "adapt" && image?.width && image.height;

  return (
    <div
      className={cn("bg-foreground/5 relative w-full overflow-hidden", !adapt && RATIO[ratio === "adapt" ? "landscape" : ratio], className)}
      style={adapt ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
    >
      {image ? (
        <Image
          src={cdnImage(image.url)}
          alt={image.altText ?? ""}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <ImagePlaceholder />
      )}
    </div>
  );
}

export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-foreground/10 text-foreground/40 absolute inset-0 flex items-center justify-center", className)}
    >
      <ImageIcon className="size-10" strokeWidth={1} />
    </div>
  );
}

/** Rich text from the builder, already rendered and escaped by `richTextToHtml`. */
export function Prose({ html, className, size = "body" }: { html?: string; className?: string; size?: "body" | "secondary" }) {
  if (!html) return null;
  return (
    <div
      className={cn("sb-prose", className)}
      // `sb-prose` sets the body size itself; the smaller one has to win over it.
      style={size === "secondary" ? { fontSize: "var(--fs-secondary)" } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** A darkening layer over a photograph, 0–80%. */
/**
 * Darkens a photograph so the copy on it reads. Off-black by default; a slide may
 * choose its own colour and go a little further (`max`).
 */
export function Overlay({ percent, color, max = 80 }: { percent: number; color?: string | null; max?: number }) {
  if (percent <= 0) return null;
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0", !color && "bg-off-black")}
      style={{ opacity: Math.min(percent, max) / 100, ...(color ? { backgroundColor: color } : {}) }}
    />
  );
}

/** Light copy → the off-black surface's tokens; dark copy → earth's. Paints nothing by itself. */
export const toneSurface = (tone: "light" | "dark") => (tone === "light" ? "black" : "light");
