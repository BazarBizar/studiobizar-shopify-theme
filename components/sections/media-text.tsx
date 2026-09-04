import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

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
}) {
  const content = (
    <div className={cn("py-section", PADDING[padding])}>
      <div
        className={cn(
          "grid items-center gap-10 lg:grid-cols-2 lg:gap-20",
          align === "right" && "lg:[&>figure]:order-2",
        )}
      >
        {image && (
          <figure className="relative aspect-[2/3] w-full overflow-hidden bg-foreground/5">
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
          <h2 className="text-h2">{title}</h2>
          {html && (
            <div className="sb-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {link && (
            <ButtonLink href={link.href} variant="outline" className="mt-8">
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
