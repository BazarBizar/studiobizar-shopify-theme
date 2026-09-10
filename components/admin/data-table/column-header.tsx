"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import type { Column } from "@tanstack/react-table";

import { cn } from "@/lib/utils/cn";

/**
 * A sortable column header: ONE button, one click.
 *
 * No dropdown menu. `getToggleSortingHandler()` already cycles
 * ascending → descending → unsorted, so the third click restores the default order
 * and there is no need for a "clear sort" affordance anywhere.
 *
 * The indicator is ALWAYS rendered — faint when the column is unsorted. An arrow
 * that only appears on hover leaves no sign that the column can be sorted at all,
 * which is the one thing the control needs to communicate at rest.
 *
 * `aria-sort` is set by `data-table.tsx` on the `<th>`, not here: the attribute
 * belongs on the element with role `columnheader`, and a `<button>` does not
 * support it.
 */
export function ColumnHeader<TData, TValue>({
  column,
  title,
  numeric,
}: {
  column: Column<TData, TValue>;
  title: string;
  numeric?: boolean;
}) {
  if (!column.getCanSort()) {
    // A dead button would suggest an interaction that does not exist.
    return <span className="text-xs font-medium">{title}</span>;
  }

  const sorted = column.getIsSorted();

  const description =
    sorted === "asc"
      ? `${title}, sorted ascending`
      : sorted === "desc"
        ? `${title}, sorted descending`
        : `Sort by ${title}`;

  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      title={description}
      className={cn(
        "hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors",
        numeric && "flex-row-reverse",
      )}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3.5 shrink-0" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3.5 shrink-0" />
      ) : (
        <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-40" />
      )}
    </button>
  );
}
