"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { MAX_QTY, useInquiryCart, type InquiryItem } from "@/store/inquiry-cart";

/**
 * The qty stepper and `enquire` button — a 133×48 and a 372×48 outlined box in
 * the design. There is no price and no stock check; the button only ever adds
 * to the inquiry list.
 */
export function AddToInquiry({ item, moq = 1 }: { item: Omit<InquiryItem, "qty">; moq?: number }) {
  const [qty, setQty] = useState(Math.max(1, moq));
  const [added, setAdded] = useState(false);
  const add = useInquiryCart((state) => state.add);

  function onAdd() {
    add(item, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex h-12 w-[8.3rem] items-center justify-between border border-foreground px-4">
          <button
            type="button"
            onClick={() => setQty((value) => Math.max(moq, value - 1))}
            disabled={qty <= moq}
            aria-label="Decrease quantity"
            className="transition-opacity hover:opacity-60 disabled:opacity-30"
          >
            <Minus className="size-4" strokeWidth={1.5} aria-hidden />
          </button>

          <label htmlFor="qty" className="sr-only">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            min={moq}
            max={MAX_QTY}
            value={qty}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              setQty(Number.isNaN(next) ? moq : Math.min(Math.max(next, moq), MAX_QTY));
            }}
            className="text-button w-12 bg-transparent text-center tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />

          <button
            type="button"
            onClick={() => setQty((value) => Math.min(MAX_QTY, value + 1))}
            disabled={qty >= MAX_QTY}
            aria-label="Increase quantity"
            className="transition-opacity hover:opacity-60 disabled:opacity-30"
          >
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="text-button h-12 min-w-[16rem] flex-1 border border-foreground px-8 uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background"
        >
          enquire
        </button>
      </div>

      <p role="status" aria-live="polite" className="text-tertiary min-h-[1.2em] text-muted">
        {added ? "Added to your inquiry." : moq > 1 ? `Minimum order ${moq} pieces.` : ""}
      </p>
    </div>
  );
}
