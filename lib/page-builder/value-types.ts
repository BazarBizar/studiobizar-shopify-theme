/**
 * Value shapes with no validation library behind them — for modules the storefront's
 * client components import (`design-style.ts`). `value-schemas.ts` adds the zod
 * schemas and re-exports these.
 */

/**
 * A snapshot of a Shopify file, taken when it was picked. Rendering from the
 * snapshot costs no query; the gid is kept so the panel can re-resolve it.
 */
export type ImageRef = {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  /**
   * The part of the photograph to show, in the ORIGINAL's pixels — cut by the Shopify
   * CDN (`crop=region`), so the visitor downloads only that part and every component
   * sees a photograph of that size and shape. Absent: the whole photograph.
   * Next only: the theme's image picker has no crop.
   */
  crop?: ImageCrop;
};

export type ImageCrop = { x: number; y: number; width: number; height: number };

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
