"use client";

import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";

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

type CollectionChip = { handle: string; title: string };

/**
 * "The Duna Collection" → "duna". The chip row already sits under
 * "view: by collection", so the article and the word "collection" are noise —
 * and twelve of them in a row is a lot of noise. A title that doesn't follow the
 * pattern is shown whole, lowercased like the category chips.
 */
const chipLabel = (title: string) =>
  title
    .replace(/^the\s+/i, "")
    .replace(/\s+collection$/i, "")
    .toLowerCase();

/**
 * The chips, sort, the by type / by collection view and the S / M / L density —
 * all held in the URL so a filtered shop is shareable and the back button works.
 *
 * `view` picks which row of chips filters the grid: product-type categories, or
 * collections. The grid, sort and paging stay the same either way.
 */
export function ShopControls({
  total,
  collections,
}: {
  /** Products under the active chip; absent when unfiltered or uncountable. */
  total?: number;
  collections: CollectionChip[];
}) {
  // One hook for the three, so switching view clears the other view's filter in
  // the same URL update — never a stale ?category= under "by collection".
  const [filters, setFilters] = useQueryStates(
    {
      view: parseAsStringLiteral(VIEWS).withDefault("type"),
      category: parseAsString,
      collection: parseAsString,
    },
    { shallow: false, history: "push" },
  );
  const { view } = filters;
  // A value no chip owns (a stale or mistyped link) reads as "all", which is
  // also what the server rendered for it.
  const category = CATEGORIES.some((item) => item.slug === filters.category)
    ? filters.category
    : null;
  const collection = collections.some((item) => item.handle === filters.collection)
    ? filters.collection
    : null;
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString
      .withOptions({ shallow: false, history: "push" })
      .withDefault(DEFAULT_SORT),
  );
  // Shallow: the grid re-lays out on the client, no server round trip.
  const [size, setSize] = useQueryState(
    "size",
    sizeParser.withOptions({ history: "push" }),
  );

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {view === "collection" ? (
          <>
            <Chip active={!collection} onClick={() => setFilters({ collection: null })}>
              all
            </Chip>
            {collections.map((item) => (
              <Chip
                key={item.handle}
                active={collection === item.handle}
                onClick={() => setFilters({ collection: item.handle })}
              >
                {chipLabel(item.title)}
              </Chip>
            ))}
          </>
        ) : (
          <>
            <Chip active={!category} onClick={() => setFilters({ category: null })}>
              all
            </Chip>
            {CATEGORIES.map((item) => (
              <Chip
                key={item.slug}
                active={category === item.slug}
                onClick={() => setFilters({ category: item.slug })}
              >
                {item.label}
              </Chip>
            ))}
          </>
        )}
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
                onClick={() => setFilters({ view: option, category: null, collection: null })}
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn("text-secondary sb-underline", active && "font-medium")}
      >
        {children}
      </button>
    </li>
  );
}
