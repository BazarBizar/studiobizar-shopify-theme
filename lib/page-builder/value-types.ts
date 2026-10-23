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
};

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
