"use client";

import { Check, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";
import { useInquiryCart } from "@/store/inquiry-cart";

const ASPECT = {
  card: "aspect-square",
  /** The double-width cell in the Collections Detail mosaic — 1:1 doubled. */
  wide: "aspect-[2/1]",
} as const;

/**
 * A square media crop with a tag badge inset top-left — the first of the
 * product's real Shopify tags, e.g. "New" or "Sale" — then a bold title and
 * collection label with a `+` quick-add trailing it. No price and no
 * availability — by design.
 *
 * The second product photo crossfades in on hover, replicating
 * https://mfisher.com/collection/containers (linked from the Figma
 * annotation) — a `.hover` layer stacked over the primary image at
 * `opacity:0`, raised to `1` on hover.
 *
 * The `+` adds the product's first variant straight from the grid, with no
 * trip to the product page — there's no size/colour picker at this density,
 * so it only ever adds one of whatever that default variant is.
 */
export function ProductCard({
  product,
  priority = false,
  aspect = "card",
}: {
  product: ProductCardType;
  priority?: boolean;
  aspect?: keyof typeof ASPECT;
}) {
  const [added, setAdded] = useState(false);
  const add = useInquiryCart((state) => state.add);
  const tag = product.tags[0];

  function quickAdd() {
    if (!product.defaultVariantId) return;
    add({
      variantId: product.defaultVariantId,
      productHandle: product.handle,
      sku: null,
      title: product.title,
      variantTitle: product.defaultVariantTitle,
      image: product.image?.url ?? null,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <article>
      <Link href={`/shop/${product.handle}`} className="group block">
        <div className={cn("relative overflow-hidden bg-foreground/5", ASPECT[aspect])}>
          {product.image ? (
            <Image
              src={cdnImage(product.image.url)}
              alt={product.image.altText ?? product.title}
              fill
              priority={priority}
              className="object-cover"
            />
          ) : null}

          {product.hoverImage && (
            <Image
              src={cdnImage(product.hoverImage.url)}
              alt=""
              fill
              aria-hidden
              className="object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
            />
          )}

          {tag && (
            <span className="text-tertiary absolute top-[0.875rem] left-[0.875rem] uppercase">
              {tag}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <Link href={`/shop/${product.handle}`} className="min-w-0">
          <h3 className="text-secondary truncate font-medium">{product.title}</h3>
          {product.collectionLabel && (
            <p className="text-tertiary mt-1 truncate text-muted">{product.collectionLabel}</p>
          )}
        </Link>

        {product.defaultVariantId && (
          <button
            type="button"
            onClick={quickAdd}
            aria-label={added ? "Added to your inquiry" : `Add ${product.title} to your inquiry`}
            className="flex size-8 shrink-0 items-center justify-center border border-foreground/20 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            {added ? (
              <Check className="size-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            )}
          </button>
        )}
      </div>
    </article>
  );
}
