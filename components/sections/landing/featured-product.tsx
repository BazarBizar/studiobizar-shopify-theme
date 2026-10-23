import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Eyebrow, ImagePlaceholder, Picture, Prose } from "./shared";

/**
 * One product given a band of its own: its photographs on one side, its story
 * and a link on the other. No price — the storefront shows none anywhere
 * (`yarn check:price`); the product page is where an enquiry starts.
 */
export function FeaturedProduct({
  href,
  images,
  eyebrow,
  title,
  html,
  buttonLabel,
  buttonStyle,
  imageSide,
  placeholder,
}: {
  href: string | null;
  images: ShopifyImage[];
  eyebrow: string;
  title: string;
  html: string;
  buttonLabel: string;
  buttonStyle: ButtonVariant;
  imageSide: "left" | "right";
  placeholder?: boolean;
}) {
  if (!href && !placeholder) return null;
  const [first, ...more] = images;

  return (
    <div className="sb-container py-section">
      <div className={cn("grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-20", imageSide === "right" && "lg:[&>*:first-child]:order-2")}>
        {/* One photograph alone; two side by side; three as one large over two. */}
        <div className={cn("grid gap-[var(--sb-grid-gap)]", more.length > 0 && "grid-cols-2")}>
          {first ? (
            <Picture
              image={first}
              ratio="portrait"
              sizes={more.length === 1 ? "(max-width: 1023px) 50vw, 25vw" : "(max-width: 1023px) 100vw, 50vw"}
              className={cn(more.length > 1 && "col-span-2")}
            />
          ) : (
            <div className="relative aspect-[4/5]">
              <ImagePlaceholder />
            </div>
          )}
          {more.map((image) => (
            <Picture key={image.url} image={image} ratio={more.length === 1 ? "portrait" : "square"} sizes="(max-width: 1023px) 50vw, 25vw" />
          ))}
        </div>

        <div className="max-w-[34rem]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-h1">{title || "Choose a product"}</h2>
          <Prose html={html} className="mt-6" />
          {href && buttonLabel.trim() && (
            <ButtonLink href={href} variant={buttonStyle} className="mt-8">
              {buttonLabel}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
