import Image from "next/image";

import { Carousel } from "@/components/ui/carousel";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { SectionHeader } from "./shared";

export type Quote = { id: string; quote: string; author: string; role: string; image: ShopifyImage | null };

const GRID = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3" } as const;
const SLIDE = {
  "2": "w-[86%] sm:w-[calc(50%-0.3125rem)]",
  "3": "w-[86%] sm:w-[46%] lg:w-[calc(33.333%-0.42rem)]",
} as const;

function Figure({ item, marks, large }: { item: Quote; marks: boolean; large?: boolean }) {
  return (
    <figure className={cn("flex h-full flex-col", large ? "items-center text-center" : "bg-foreground/[0.04] p-8")}>
      <blockquote className={cn(large ? "text-h1 max-w-[56rem]" : "text-body", "whitespace-pre-line")}>
        {marks ? `“${item.quote.trim()}”` : item.quote}
      </blockquote>
      {(item.author.trim() || item.role.trim() || item.image) && (
        <figcaption className={cn("flex items-center gap-4", large ? "mt-10 flex-col gap-3" : "mt-auto pt-8")}>
          {item.image && (
            <span className="bg-foreground/5 relative size-12 shrink-0 overflow-hidden rounded-full">
              <Image src={cdnImage(item.image.url)} alt={item.image.altText ?? ""} fill sizes="48px" className="object-cover" />
            </span>
          )}
          <span>
            {item.author.trim() && <span className="text-secondary block font-medium">{item.author}</span>}
            {item.role.trim() && <span className="text-tertiary text-muted block">{item.role}</span>}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** Quotes as a grid, a row to scroll, or one at a time in large type. */
export function Testimonials({
  title,
  intro,
  headingAlign,
  quotes,
  layout,
  columns,
  marks,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  quotes: Quote[];
  layout: "grid" | "carousel" | "single";
  columns: "2" | "3";
  marks: boolean;
}) {
  const shown = quotes.filter((item) => item.quote.trim());
  if (shown.length === 0) return null;

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={layout === "single" ? "center" : headingAlign} />
      {layout === "grid" ? (
        <div className={cn("grid gap-[var(--sb-grid-gap)]", GRID[columns])}>
          {shown.map((item) => (
            <Figure key={item.id} item={item} marks={marks} />
          ))}
        </div>
      ) : layout === "carousel" ? (
        <Carousel ariaLabel={title || "Testimonials"} slideClassName={SLIDE[columns]}>
          {shown.map((item) => (
            <Figure key={item.id} item={item} marks={marks} />
          ))}
        </Carousel>
      ) : shown.length === 1 ? (
        <Figure item={shown[0]!} marks={marks} large />
      ) : (
        <Carousel ariaLabel={title || "Testimonials"} slideClassName="w-full">
          {shown.map((item) => (
            <Figure key={item.id} item={item} marks={marks} large />
          ))}
        </Carousel>
      )}
    </div>
  );
}
