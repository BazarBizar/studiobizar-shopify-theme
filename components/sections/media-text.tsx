import Image from "next/image";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";

import type { Surface } from "@/components/layout/page-shell";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * `wide` replaces the page's own `sb-container` gutter rather than adding to
 * it — both set `padding-inline`, and stacking two classes for the same
 * property is a cascade-order gamble. Measured at ~200px on the 1728px Shop
 * Detail frame (`DESK - Shop Detail.pdf`, The Idea band).
 */
const PADDING = {
  normal: "sb-container",
  wide: "w-full px-6 sm:px-16 lg:px-[13.1rem]",
} as const;

/** The builder's choices. Each one's first value is the band as it was drawn before them. */
const RATIO = {
  portrait: "aspect-[2/3]",
  square: "aspect-square",
  landscape: "aspect-[4/3]",
} as const;

const COLUMNS = {
  half: "lg:grid-cols-2",
  narrow: "lg:grid-cols-[2fr_3fr]",
  wide: "lg:grid-cols-[3fr_2fr]",
} as const;

const RIGHT_COLUMNS = {
  half: "lg:grid-cols-2",
  narrow: "lg:grid-cols-[3fr_2fr]",
  wide: "lg:grid-cols-[2fr_3fr]",
} as const;

const ITEMS = { center: "items-center", top: "items-start", bottom: "items-end" } as const;

/**
 * A tall image beside a column of copy. Shop Detail alternates it — The Idea
 * has the image left, The Designer has it right — and Our Story and Collections
 * Detail reuse the same block.
 */
export function MediaText({
  title,
  html,
  image,
  align = "left",
  link,
  surface,
  padding = "normal",
  eyebrow,
  buttonVariant = "outline",
  ratio = "portrait",
  imageWidth = "half",
  verticalAlign = "center",
}: {
  title: string;
  html?: string;
  image?: ShopifyImage | null;
  /** Which side the image sits on. */
  align?: "left" | "right";
  link?: { href: string; label: string };
  /** Paints its own ground; omit to inherit the surrounding `data-surface`. */
  surface?: Surface;
  /** `wide` insets further than the page's own gutter — see `The Idea` band. */
  padding?: keyof typeof PADDING;
  /** A small label above the heading. */
  eyebrow?: string;
  buttonVariant?: ButtonVariant;
  /** `adapt` keeps the photograph's own proportions. */
  ratio?: keyof typeof RATIO | "adapt";
  /** The image column's share of the row on desktop. */
  imageWidth?: keyof typeof COLUMNS;
  verticalAlign?: keyof typeof ITEMS;
}) {
  const adapt = ratio === "adapt" && image?.width && image.height;
  const content = (
    <div className={cn("py-section", PADDING[padding])}>
      <div
        className={cn(
          "grid",
          ITEMS[verticalAlign],
          "gap-10",
          (align === "right" ? RIGHT_COLUMNS : COLUMNS)[imageWidth],
          "lg:gap-20",
          align === "right" && "lg:[&>figure]:order-2",
        )}
      >
        {image && (
          <figure
            className={cn("relative", !adapt && RATIO[ratio === "adapt" ? "portrait" : ratio], "w-full overflow-hidden bg-foreground/5")}
            style={adapt ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
          >
            <Image
              src={cdnImage(image.url)}
              alt={image.altText ?? ""}
              fill
              className="object-cover"
              sizes="(max-width: 1023px) 100vw, 45vw"
            />
          </figure>
        )}

        <div className="max-w-[34rem]">
          {eyebrow && <p className="text-tertiary text-muted mb-3 uppercase">{eyebrow}</p>}
          <h2 className="text-h2">{title}</h2>
          {html && (
            <div className="sb-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {link && (
            <ButtonLink href={link.href} variant={buttonVariant} external={/^https?:\/\//i.test(link.href)} className="mt-8">
              {link.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );

  if (!surface) return content;

  return (
    <section data-surface={surface} className="bg-background text-foreground">
      {content}
    </section>
  );
}
