"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { SIZES, sizeParser } from "@/components/shop/product-grid";
import { CATEGORIES } from "@/lib/shopify/categories";
import { DEFAULT_SORT, SORT_OPTIONS } from "@/lib/shopify/constants";
import { cn } from "@/lib/utils/cn";

const VIEWS = ["type", "collection"] as const;

const SIZE_LABELS = {
  s: "Small, eight per row, images only",
  m: "Medium, six per row",
  l: "Large, four per row",
} as const;

/**
 * Category chips, sort, the by type / by collection view and the S / M / L
 * density — all held in the URL so a filtered shop is shareable and the back
 * button works.
 */
export function ShopControls({ total }: { total?: number }) {
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withOptions({ shallow: false, history: "push" }),
  );
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString
      .withOptions({ shallow: false, history: "push" })
      .withDefault(DEFAULT_SORT),
  );
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEWS)
      .withOptions({ shallow: false })
      .withDefault("type"),
  );
  // Shallow: the grid re-lays out on the client, no server round trip.
  const [size, setSize] = useQueryState(
    "size",
    sizeParser.withOptions({ history: "push" }),
  );

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <li>
          <button
            type="button"
            onClick={() => setCategory(null)}
            aria-pressed={!category}
            className={cn(
              "text-secondary sb-underline",
              !category && "font-medium",
            )}
          >
            all
          </button>
        </li>
        {CATEGORIES.map((item) => (
          <li key={item.slug}>
            <button
              type="button"
              onClick={() => setCategory(item.slug)}
              aria-pressed={category === item.slug}
              className={cn(
                "text-secondary sb-underline",
                category === item.slug && "font-medium",
              )}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-secondary">
            sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="text-secondary cursor-pointer border-b border-current bg-transparent pb-0.5 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="text-foreground"
              >
                {option.label}
              </option>
            ))}
          </select>
          {typeof total === "number" && (
            <span className="text-tertiary text-muted">
              {total} {total === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-4">
            <span className="text-secondary">view:</span>
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  "text-secondary sb-underline",
                  view === option && "font-medium",
                )}
              >
                by {option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-secondary">size:</span>
            {SIZES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSize(option)}
                aria-pressed={size === option}
                aria-label={SIZE_LABELS[option]}
                className={cn(
                  "text-secondary sb-underline uppercase",
                  size === option ? "font-medium" : "opacity-60",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
