"use client";

import { SearchIcon, XIcon } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

import { DateRangeFilter } from "./date-range-filter";
import { FacetedFilter } from "./faceted-filter";
import { ViewOptions } from "./view-options";

/**
 * The toolbar, assembled ENTIRELY from `column.meta`.
 *
 * There is not one resource name in this file and there must never be one. A filter
 * appears because a column declared `meta.facetable`, and the control is chosen from
 * `meta.kind`. Adding a filter to a screen is a change to the column definition, not
 * to this component.
 */
export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  dateColumnId,
  dateRange,
  onDateRangeChange,
  actions,
}: {
  table: Table<TData>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** The column the date filter applies to, if the resource has one. */
  dateColumnId?: string;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  /** Export, "New …" — supplied by the screen, right of the column menu. */
  actions?: React.ReactNode;
}) {
  const facetColumns = table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.facetable && column.getCanFilter());

  const hasColumnFilters = table.getState().columnFilters.length > 0;
  const hasDateRange = Boolean(dateRange?.from);
  const canReset = search.length > 0 || hasColumnFilters || hasDateRange;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 ps-8"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      {facetColumns.map((column) => (
        <FacetedFilter
          key={column.id}
          column={column}
          title={column.columnDef.meta?.label ?? column.id}
        />
      ))}

      {dateColumnId && onDateRangeChange ? (
        <DateRangeFilter
          title={table.getColumn(dateColumnId)?.columnDef.meta?.label ?? "Updated"}
          value={dateRange}
          onChange={onDateRangeChange}
        />
      ) : null}

      {/* Only shown when there is something to reset, and it clears all three kinds
          of filter at once — search, column filters and the date range. */}
      {canReset ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            table.resetColumnFilters();
            onDateRangeChange?.(undefined);
          }}
        >
          <XIcon className="size-3.5" />
          Reset
        </Button>
      ) : null}

      <ViewOptions table={table} />
      {actions}
    </div>
  );
}
