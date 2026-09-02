"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { PROJECT_CATEGORIES } from "@/lib/shopify/entities";
import { cn } from "@/lib/utils/cn";

const VIEWS = ["l", "m"] as const;

/**
 * Category chips and the L / M density toggle, both held in the URL so a
 * filtered view is shareable and the back button works — the brief's
 * requirement for this page specifically.
 */
export function ProjectControls({ counts }: { counts: Record<string, number> }) {
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withOptions({ shallow: false, history: "push" }),
  );
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEWS).withOptions({ shallow: false, history: "push" }).withDefault("m"),
  );

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <li>
          <button
            type="button"
            onClick={() => setCategory(null)}
            aria-pressed={!category}
            className={cn("text-secondary sb-underline lowercase", !category && "font-medium")}
          >
            all <span className="text-muted tabular-nums">{total}</span>
          </button>
        </li>
        {PROJECT_CATEGORIES.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              disabled={!counts[item]}
              className={cn(
                "text-secondary sb-underline lowercase disabled:opacity-40",
                category === item && "font-medium",
              )}
            >
              {item.toLowerCase()}{" "}
              <span className="text-muted tabular-nums">{counts[item] ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-4 border-t border-border pt-4">
        <span className="text-secondary">view:</span>
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-pressed={view === option}
            aria-label={option === "l" ? "Large, one per row" : "Medium, three per row"}
            className={cn(
              "text-secondary sb-underline uppercase",
              view === option ? "font-medium" : "opacity-60",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
