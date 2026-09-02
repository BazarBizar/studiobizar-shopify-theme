"use client";

import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { cdnImage } from "@/lib/shopify/transforms";
import { MAX_QTY, selectTotalQuantity, useInquiryCart } from "@/store/inquiry-cart";
import { useUi } from "@/store/ui";

/**
 * Slides in from the header bag. Review and edit only — sending happens on
 * `/inquiry`, where there is room for the contact form.
 */
export function InquiryDrawer() {
  const open = useUi((state) => state.inquiryDrawerOpen);
  const close = useUi((state) => state.closeInquiryDrawer);

  const items = useInquiryCart((state) => state.items);
  const hydrated = useInquiryCart((state) => state.hydrated);
  const updateQty = useInquiryCart((state) => state.updateQty);
  const remove = useInquiryCart((state) => state.remove);
  const totalQuantity = useInquiryCart(selectTotalQuantity);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            type="button"
            aria-label="Close inquiry"
            onClick={close}
            className="absolute inset-0 bg-off-black/40"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Your inquiry"
            data-surface="light"
            className="absolute inset-y-0 right-0 flex w-[min(28rem,92vw)] flex-col bg-background text-foreground"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-center justify-between border-b border-border px-gutter py-5">
              <h2 className="text-h3">
                Your inquiry{hydrated && totalQuantity > 0 ? ` (${totalQuantity})` : ""}
              </h2>
              <button type="button" onClick={close} aria-label="Close inquiry">
                <X className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            </header>

            {!hydrated ? (
              <div className="flex-1 px-gutter py-6" />
            ) : items.length === 0 ? (
              <div className="flex flex-1 flex-col items-start gap-4 px-gutter py-10">
                <p className="text-body text-muted">Your inquiry is empty.</p>
                <Link href="/shop" onClick={close} className="text-button sb-underline">
                  Browse products
                </Link>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto px-gutter">
                {items.map((item) => (
                  <li
                    key={item.variantId}
                    className="grid grid-cols-[4rem_1fr_auto] items-start gap-4 border-b border-border py-4"
                  >
                    <Link
                      href={`/shop/${item.productHandle}`}
                      onClick={close}
                      className="relative aspect-card w-16 overflow-hidden bg-foreground/5"
                    >
                      {item.image && (
                        <Image
                          src={cdnImage(item.image, 160)}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      )}
                    </Link>

                    <div className="min-w-0">
                      <Link
                        href={`/shop/${item.productHandle}`}
                        onClick={close}
                        className="text-secondary sb-underline"
                      >
                        {item.title}
                      </Link>
                      {item.sku && <p className="text-tertiary text-muted">{item.sku}</p>}

                      <div className="mt-2 flex h-8 w-[6rem] items-center justify-between border border-foreground px-2">
                        <button
                          type="button"
                          onClick={() => updateQty(item.variantId, item.qty - 1)}
                          aria-label={`Decrease quantity of ${item.title}`}
                        >
                          <Minus className="size-3" strokeWidth={1.5} aria-hidden />
                        </button>
                        <span className="text-tertiary tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.variantId, item.qty + 1)}
                          disabled={item.qty >= MAX_QTY}
                          aria-label={`Increase quantity of ${item.title}`}
                          className="disabled:opacity-30"
                        >
                          <Plus className="size-3" strokeWidth={1.5} aria-hidden />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(item.variantId)}
                      aria-label={`Remove ${item.title} from your inquiry`}
                      className="transition-opacity hover:opacity-60"
                    >
                      <X className="size-4" strokeWidth={1.5} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {hydrated && items.length > 0 && (
              <footer className="border-t border-border px-gutter py-5">
                <Link
                  href="/inquiry"
                  onClick={close}
                  className="text-button flex h-12 items-center justify-center border border-foreground uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background"
                >
                  Review &amp; send
                </Link>
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
