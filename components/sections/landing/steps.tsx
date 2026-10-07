import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Picture, Prose, SectionHeader } from "./shared";

export type Step = { id: string; image: ShopifyImage | null; title: string; html: string };

const ROW: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** A process, numbered. In a row, or as a timeline running down a rule. */
export function Steps({
  title,
  intro,
  headingAlign,
  items,
  layout,
  numbered,
  showImages,
  placeholder,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  items: Step[];
  layout: "row" | "timeline";
  numbered: boolean;
  showImages: boolean;
  placeholder?: boolean;
}) {
  if (items.length === 0) return null;
  const number = (index: number) => String(index + 1).padStart(2, "0");

  if (layout === "timeline") {
    return (
      <div className="sb-container py-section">
        <SectionHeader title={title} intro={intro} align={headingAlign} />
        <ol className={cn("border-border max-w-[56rem] border-l", headingAlign === "center" && "mx-auto")}>
          {items.map((item, index) => (
            <li key={item.id} className="relative grid gap-6 pb-14 pl-8 last:pb-0 sm:grid-cols-[1fr_16rem] sm:pl-14">
              <span aria-hidden className="bg-foreground absolute top-2 -left-[5px] size-[9px] rounded-full" />
              <div>
                {numbered && <p className="text-tertiary text-muted mb-2 tabular-nums">{number(index)}</p>}
                <h3 className="text-h3">{item.title}</h3>
                <Prose html={item.html} size="secondary" className="mt-3" />
              </div>
              {showImages && (item.image || placeholder) && (
                <Picture image={item.image} ratio="landscape" placeholder={placeholder} sizes="(max-width: 749px) 90vw, 16rem" />
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      <ol className={cn("grid gap-x-[var(--sb-grid-gap)] gap-y-12", ROW[Math.min(items.length, 4)], items.length > 4 && "lg:grid-cols-4")}>
        {items.map((item, index) => (
          <li key={item.id} className="border-foreground flex flex-col border-t pt-5">
            {showImages && (item.image || placeholder) && (
              <Picture image={item.image} ratio="landscape" placeholder={placeholder} sizes="(max-width: 749px) 90vw, 25vw" className="mb-6" />
            )}
            {numbered && <p className="text-h2 mb-4 tabular-nums">{number(index)}</p>}
            <h3 className="text-h3">{item.title}</h3>
            <Prose html={item.html} size="secondary" className="mt-3" />
          </li>
        ))}
      </ol>
    </div>
  );
}
