"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The inquiry cart. Deliberately NOT the Shopify Cart API — this storefront has
 * no checkout, so the list lives in localStorage until it is submitted as an
 * inquiry.
 */

export type InquiryItem = {
  variantId: string;
  productHandle: string;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  qty: number;
  image: string | null;
};

type InquiryCart = {
  items: InquiryItem[];
  /** False until the persisted state has been read, to keep SSR markup stable. */
  hydrated: boolean;
  add: (item: Omit<InquiryItem, "qty">, qty?: number) => void;
  updateQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setHydrated: () => void;
};

export const MAX_QTY = 999;

export const useInquiryCart = create<InquiryCart>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,

      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, qty: Math.min(i.qty + qty, MAX_QTY) }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty: Math.min(qty, MAX_QTY) }] };
        }),

      updateQty: (variantId, qty) =>
        set((state) => ({
          items:
            qty < 1
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId ? { ...i, qty: Math.min(qty, MAX_QTY) } : i,
                ),
        })),

      remove: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      clear: () => set({ items: [] }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "sb-inquiry-cart",
      version: 1,
      // `hydrated` is derived per session, so it must never be persisted.
      partialize: (state) => ({ items: state.items }) as unknown as InquiryCart,
      // Guards the badge and the review list: the server cannot know what is in
      // localStorage, so both render a neutral state until this fires. It must
      // go through `set` — mutating the draft here would update the value
      // without notifying a single subscriber.
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const selectTotalQuantity = (state: InquiryCart) =>
  state.items.reduce((total, item) => total + item.qty, 0);

export const selectTotalProducts = (state: InquiryCart) => state.items.length;
