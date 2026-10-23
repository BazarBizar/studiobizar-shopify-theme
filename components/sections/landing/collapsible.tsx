import { Plus } from "lucide-react";

import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Picture, Prose, SectionHeader } from "./shared";

export type CollapsibleRow = { id: string; heading: string; html: string };

/**
 * Rows that open on click. Native `<details>`: keyboard and screen-reader
 * behaviour come from the browser, the content is in the HTML for search
 * engines, and it works before any script has loaded.
 */
export function Collapsible({
  title,
  intro,
  headingAlign,
  rows,
  image,
  imageSide,
  openFirst,
  placeholder,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  rows: CollapsibleRow[];
  image: ShopifyImage | null;
  imageSide: "left" | "right";
  openFirst: boolean;
  placeholder?: boolean;
}) {
  if (rows.length === 0) return null;
  const withImage = Boolean(image);

  const list = (
    <div className="border-border border-t">
      {rows.map((row, index) => (
        <details key={row.id} open={openFirst && index === 0} className="group border-border border-b">
          <summary className="text-h4 flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-medium [&::-webkit-details-marker]:hidden">
            {row.heading}
            <Plus aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-45" strokeWidth={1.5} />
          </summary>
          <Prose html={row.html} size="secondary" className="max-w-[44rem] pb-6" />
        </details>
      ))}
    </div>
  );

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      {withImage || placeholder ? (
        <div className={cn("grid gap-10 lg:grid-cols-2 lg:gap-20", imageSide === "right" && "lg:[&>*:first-child]:order-2")}>
          <Picture image={image} ratio="portrait" placeholder={placeholder} sizes="(max-width: 1023px) 100vw, 45vw" />
          <div className="lg:pt-2">{list}</div>
        </div>
      ) : (
        <div className="max-w-[56rem]">{list}</div>
      )}
    </div>
  );
}
