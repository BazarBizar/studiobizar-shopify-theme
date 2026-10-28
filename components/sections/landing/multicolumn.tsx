import Link from "next/link";

import { SectionIcon } from "@/components/sections/section-icon";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Buttons, Picture, Prose, SectionHeader, type LandingLink, type Ratio } from "./shared";

export type Column = {
  id: string;
  image: ShopifyImage | null;
  icon: string;
  title: string;
  html: string;
  link: LandingLink | null;
};

const DESKTOP = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
  "5": "sm:grid-cols-3 lg:grid-cols-5",
} as const;

/**
 * Columns side by side. On phones they stack, pair up, or become a swipeable
 * row (`scroll`) — a native scroll-snap row, so it needs no script.
 */
export function Multicolumn({
  title,
  intro,
  headingAlign,
  columns,
  button,
  media,
  ratio,
  columnsDesktop,
  columnsMobile,
  align,
  style,
  placeholder,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  columns: Column[];
  button: LandingLink | null;
  media: "image" | "icon" | "none";
  ratio: Ratio;
  columnsDesktop: keyof typeof DESKTOP;
  columnsMobile: "1" | "2" | "scroll";
  align: "left" | "center";
  style: "plain" | "cards" | "lines";
  placeholder?: boolean;
}) {
  if (columns.length === 0) return null;
  const scroll = columnsMobile === "scroll";

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      <ul
        className={cn(
          "grid gap-x-[var(--sb-grid-gap)] gap-y-12",
          columnsMobile === "2" ? "grid-cols-2" : "grid-cols-1",
          scroll &&
            "max-sm:-mx-[var(--sb-gutter)] max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-[var(--sb-grid-gap)] max-sm:overflow-x-auto max-sm:px-[var(--sb-gutter)]",
          DESKTOP[columnsDesktop],
          style === "lines" && "sm:gap-x-0",
          style === "cards" && "gap-y-[var(--sb-grid-gap)]",
        )}
      >
        {columns.map((column, index) => (
          <li
            key={column.id}
            className={cn(
              "flex flex-col",
              align === "center" ? "items-center text-center" : "items-start text-left",
              scroll && "max-sm:w-[78%] max-sm:shrink-0 max-sm:snap-start",
              style === "cards" && "bg-foreground/[0.04] p-6 sm:p-8",
              style === "lines" && index > 0 && "border-border sm:border-l",
              style === "lines" && "sm:px-8 sm:first:pl-0",
            )}
          >
            {/* A column's own image always shows — Media only decides what fills a column
                without one: an icon, or (in the preview) an empty frame. */}
            {(column.image || (media === "image" && placeholder)) && (
              <Picture
                image={column.image}
                ratio={ratio}
                placeholder={placeholder}
                sizes="(max-width: 749px) 80vw, 30vw"
                className="mb-6"
              />
            )}
            {!column.image && media === "icon" && column.icon !== "none" && <SectionIcon name={column.icon} className="mb-5 size-9" />}
            {column.title.trim() && <h3 className="text-h3">{column.title}</h3>}
            <Prose html={column.html} size="secondary" className="mt-3" />
            {column.link?.href && column.link.label && (
              <Link href={column.link.href} className="sb-underline text-button mt-5 uppercase">
                {column.link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Buttons primary={button} primaryStyle="outline" align={headingAlign} className="mt-12" />
    </div>
  );
}
