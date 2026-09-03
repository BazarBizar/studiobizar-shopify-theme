import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * 415×519 media (4:5) with the "new" flag inset top-left, then a bold title
 * and collection label with a `+` mark trailing it. No price and no
 * availability — by design.
 *
 * The `+` is decorative here rather than its own control: a card-level quick
 * add needs a variant id, which the card query deliberately doesn't fetch
 * (kept small — see `PRODUCT_CARD_METAFIELDS`), so it goes to the same
 * product page the rest of the card does.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardType;
  priority?: boolean;
}) {
  return (
    <article>
      <Link href={`/shop/${product.handle}`} className="group block">
        <div className="relative aspect-card overflow-hidden bg-foreground/5">
          {product.image ? (
            <Image
              src={cdnImage(product.image.url, 830)}
              alt={product.image.altText ?? product.title}
              fill
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
            />
          ) : null}

          {product.isNew && (
            <span className="text-tertiary absolute top-[0.875rem] left-[0.875rem] lowercase">
              new
            </span>
          )}
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-secondary font-medium">{product.title}</h3>
            {product.collectionLabel && (
              <p className="text-tertiary mt-1 text-muted">{product.collectionLabel}</p>
            )}
          </div>

          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center border border-foreground/20"
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </span>
        </div>
      </Link>
    </article>
  );
}
