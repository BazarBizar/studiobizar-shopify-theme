"use client";

import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { ButtonLink } from "@/components/ui/button";
import { cdnImage } from "@/lib/shopify/transforms";
import {
  MAX_QTY,
  selectTotalProducts,
  selectTotalQuantity,
  useInquiryCart,
} from "@/store/inquiry-cart";

export function InquiryList() {
  const items = useInquiryCart((state) => state.items);
  const hydrated = useInquiryCart((state) => state.hydrated);
  const updateQty = useInquiryCart((state) => state.updateQty);
  const remove = useInquiryCart((state) => state.remove);
  const clear = useInquiryCart((state) => state.clear);
  const totalProducts = useInquiryCart(selectTotalProducts);
  const totalQuantity = useInquiryCart(selectTotalQuantity);

  // The list lives in localStorage, so it is unknown until after rehydration.
  if (!hydrated) {
    return (
      <ul className="sb-grid-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <li key={index}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border-t border-border py-16">
        <p className="text-body text-muted">Your inquiry is empty.</p>
        <ButtonLink href="/shop" className="mt-4">
          Browse products
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <ul className="border-t border-border">
        {items.map((item) => (
          <li
            key={item.variantId}
            className="grid grid-cols-[5rem_1fr_auto] items-center gap-6 border-b border-border py-5"
          >
            <Link
              href={`/shop/${item.productHandle}`}
              className="relative aspect-card w-20 overflow-hidden bg-foreground/5"
            >
              {item.image && (
                <Image
                  src={cdnImage(item.image, 200)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              )}
            </Link>

            <div className="min-w-0">
              <Link href={`/shop/${item.productHandle}`} className="text-secondary sb-underline">
                {item.title}
              </Link>
              {item.variantTitle && (
                <p className="text-tertiary text-muted">{item.variantTitle}</p>
              )}
              {item.sku && <p className="text-sku text-muted">{item.sku}</p>}
            </div>

            <div className="flex items-center gap-5">
              <div className="flex h-10 w-[7rem] items-center justify-between border border-foreground px-3">
                <button
                  type="button"
                  onClick={() => updateQty(item.variantId, item.qty - 1)}
                  aria-label={`Decrease quantity of ${item.title}`}
                  className="transition-opacity hover:opacity-60"
                >
                  <Minus className="size-3.5" strokeWidth={1.5} aria-hidden />
                </button>
                <span className="text-button tabular-nums">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => updateQty(item.variantId, item.qty + 1)}
                  disabled={item.qty >= MAX_QTY}
                  aria-label={`Increase quantity of ${item.title}`}
                  className="transition-opacity hover:opacity-60 disabled:opacity-30"
                >
                  <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => remove(item.variantId)}
                aria-label={`Remove ${item.title} from your inquiry`}
                className="transition-opacity hover:opacity-60"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
        <dl className="text-secondary flex gap-8">
          <div className="flex gap-2">
            <dt className="text-muted">Total products</dt>
            <dd className="tabular-nums">{totalProducts}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Total quantity</dt>
            <dd className="tabular-nums">{totalQuantity}</dd>
          </div>
        </dl>

        <button type="button" onClick={clear} className="text-button sb-underline text-muted">
          Clear inquiry
        </button>
      </div>
    </div>
  );
}
