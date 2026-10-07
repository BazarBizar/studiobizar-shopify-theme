import { cn } from "@/lib/utils/cn";

import { HEADING, SectionHeader } from "./shared";

export type Stat = { id: string; value: string; label: string; body: string };

const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Key figures in large type. Up to four sit in one row; more wrap in fours. */
export function Stats({
  title,
  intro,
  headingAlign,
  items,
  size,
  align,
  lines,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  items: Stat[];
  size: "h1" | "display";
  align: "left" | "center";
  lines: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      <dl className={cn("grid grid-cols-2 gap-y-10", COLUMNS[Math.min(items.length, 4)], items.length > 4 && "lg:grid-cols-4")}>
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex flex-col px-4 first:pl-0 sm:px-8",
              align === "center" && "items-center px-4 text-center first:pl-4",
              lines && "border-border border-l first:border-l-0 max-sm:[&:nth-child(odd)]:border-l-0 max-sm:[&:nth-child(odd)]:pl-0",
            )}
          >
            <dt className="sr-only">{item.label || item.value}</dt>
            <dd className={cn(HEADING[size], "tabular-nums")}>{item.value}</dd>
            {item.label.trim() && <dd className="text-secondary mt-2 uppercase">{item.label}</dd>}
            {item.body.trim() && <dd className="text-secondary text-muted mt-3 max-w-[22rem] whitespace-pre-line">{item.body}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
