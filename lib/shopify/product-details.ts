import { z } from "zod";

import "@/lib/zod-config";

/**
 * Which product fields the product page shows, in what order, under what label — edited
 * under Content → Product details (`lib/admin/product-details.ts`).
 *
 *  - ROWS: short facts beside the product, "Material / Finish — Oak".
 *  - PANELS: longer text in fold-out panels under the enquire button.
 *
 * Each names a PRODUCT metafield (`custom.<key>`), filled in per product under Products.
 * Kept as one json metafield on the shop, `custom.product_details`, read by the Next
 * product page AND the Liquid `sb-main-product` — until it is saved once both draw
 * `DEFAULT_PRODUCT_DETAILS`, which is the page as it was built.
 *
 * Shared by the storefront, the admin and the browser: plain data.
 */

export const PRODUCT_DETAILS_KEY = "product_details";
export const PRODUCT_DETAILS_VERSION = 1;
export const DETAIL_LIMITS = { rows: 20, panels: 12, label: 60 } as const;

/** `availability` is drawn with the product's lead time beside it: "Made to order | 12–16 weeks". */
export const AVAILABILITY_KEY = "availability";

export type ProductDetail = { key: string; label: string };
export type ProductDetails = { rows: ProductDetail[]; panels: ProductDetail[] };

export const DEFAULT_PRODUCT_DETAILS: ProductDetails = {
  rows: [
    { key: "material_finish", label: "Material / Finish" },
    { key: "colour", label: "Colour" },
    { key: "upholstery", label: "Upholstery" },
    { key: AVAILABILITY_KEY, label: "Availability" },
  ],
  panels: [
    { key: "technical_specifications", label: "Technical Specifications" },
    { key: "dimensions", label: "Dimensions" },
    { key: "care_maintenance", label: "Care & Maintenance" },
    { key: "shipping_delivery", label: "Shipping & Delivery" },
  ],
};

/** Shopify's metafield key alphabet. */
export const DETAIL_KEY = /^[a-z0-9_]{2,64}$/;

/** The field types each list can show: a row is one line, a panel is formatted text. */
export const ROW_TYPES = ["single_line_text_field", "multi_line_text_field"] as const;
export const PANEL_TYPES = ["rich_text_field", "multi_line_text_field"] as const;

const detail = z.object({
  key: z.string().regex(DETAIL_KEY),
  label: z.string().trim().min(1).max(DETAIL_LIMITS.label),
});

const storedSchema = z.object({
  version: z.literal(PRODUCT_DETAILS_VERSION),
  rows: z.array(detail).max(DETAIL_LIMITS.rows),
  panels: z.array(detail).max(DETAIL_LIMITS.panels),
  savedAt: z.string().nullable().optional(),
  savedBy: z.string().nullable().optional(),
});

export type StoredProductDetails = z.infer<typeof storedSchema>;

export function parseProductDetails(raw: string | null | undefined): StoredProductDetails | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** "Weight (kg)" → "weight_kg"; a key that is already taken gets `_2`, `_3`. */
export function detailKeyFor(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let base = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  if (base.length < 3) base = `${base || "product"}_detail`;
  let key = base;
  for (let n = 2; used.has(key); n += 1) key = `${base}_${n}`;
  return key;
}
