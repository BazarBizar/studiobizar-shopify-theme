import { ProductCard } from "@/components/product/product-card";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";

/**
 * The 10-product mosaic under a collection's title — `DESK - Collections
 * Detail.pdf`: 4-across, then 1:1:2, then 2:1:1. A row only renders once every
 * one of its slots has a product, so a short collection just shows fewer full
 * rows rather than a row with empty cells.
 */
const ROWS: readonly (readonly number[])[] = [
  [1, 1, 1, 1],
  [1, 1, 2],
  [2, 1, 1],
];

export function CollectionHighlightGrid({ products }: { products: ProductCardType[] }) {
  const items = products.slice(0, 10);

  let cursor = 0;
  const rows: { product: ProductCardType; span: number }[][] = [];
  for (const spans of ROWS) {
    if (cursor + spans.length > items.length) break;
    rows.push(spans.map((span) => ({ product: items[cursor++]!, span })));
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-grid-gap">
      {rows.map((row, rowIndex) => (
        <ul key={rowIndex} className="grid grid-cols-4 gap-grid-gap">
          {row.map(({ product, span }) => (
            <li key={product.id} className={span === 2 ? "col-span-4 sm:col-span-2" : "col-span-2 sm:col-span-1"}>
              <ProductCard product={product} aspect={span === 2 ? "wide" : "card"} priority={rowIndex === 0} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
