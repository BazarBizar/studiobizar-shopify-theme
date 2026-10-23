import Link from "next/link";

import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Picture, SectionHeader } from "./shared";

export type Tile = { id: string; image: ShopifyImage | null; title: string; href: string };

/**
 * Photographs in an editorial arrangement. With a large image, the first tile
 * takes a full column and the rest share the other; `even` is a plain grid.
 */
export function Collage({
  title,
  intro,
  headingAlign,
  tiles,
  layout,
  captions,
  placeholder,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  tiles: Tile[];
  layout: "large-left" | "large-right" | "even";
  captions: "below" | "overlay";
  placeholder?: boolean;
}) {
  const shown = tiles.filter((tile) => tile.image || placeholder);
  if (shown.length === 0) return null;

  const feature = layout !== "even" && shown.length > 1;
  const [first, ...rest] = shown;

  /**
   * `large` — the feature tile; its 4:5 shape sets the row height. `fill` — a tile
   * beside it, which shares that height with the others on desktop instead of
   * keeping a shape of its own, so both columns end on the same line.
   */
  const tile = (item: Tile, large: boolean, fill = false) => {
    const body = (
      <>
        <Picture
          image={item.image}
          ratio={large ? "portrait" : "landscape"}
          placeholder={placeholder}
          sizes={large ? "(max-width: 749px) 100vw, 50vw" : "(max-width: 749px) 100vw, 25vw"}
          className={cn(
            fill && "sm:aspect-auto sm:min-h-0 sm:flex-1",
            "[&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.03]",
          )}
        />
        {item.title.trim() &&
          (captions === "overlay" ? (
            <span
              data-surface="black"
              className="text-foreground absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-5 pt-16"
            >
              <span className="text-h4 font-medium">{item.title}</span>
            </span>
          ) : (
            <span className="text-secondary mt-3 block">{item.title}</span>
          ))}
      </>
    );
    const className = cn("group relative flex min-w-0 flex-col", fill && "sm:h-full");
    return item.href ? (
      <Link key={item.id} href={item.href} className={className}>
        {body}
      </Link>
    ) : (
      <div key={item.id} className={className}>
        {body}
      </div>
    );
  };

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      {feature ? (
        <div className={cn("grid grid-cols-1 gap-[var(--sb-grid-gap)] sm:grid-cols-2", layout === "large-right" && "sm:[&>*:first-child]:order-2")}>
          {tile(first!, true)}
          <div className={cn("grid min-w-0 grid-cols-1 gap-[var(--sb-grid-gap)] sm:auto-rows-fr", rest.length > 2 && "grid-cols-2")}>
            {rest.map((item) => tile(item, false, true))}
          </div>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-[var(--sb-grid-gap)] sm:grid-cols-2", shown.length >= 3 && "lg:grid-cols-3")}>
          {shown.map((item) => tile(item, false))}
        </div>
      )}
    </div>
  );
}
