"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Loader2Icon,
} from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

/** Client-side pagination: the whole collection is in memory, so counts are exact. */
export function DataTablePagination<TData>({
  table,
  totalBeforeFilter,
  noun = "rows",
}: {
  table: Table<TData>;
  /** Row count before filtering, so the summary can say what was filtered out. */
  totalBeforeFilter: number;
  noun?: string;
}) {
  const filtered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  const first = filtered === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min(filtered, (pageIndex + 1) * pageSize);
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-muted-foreground text-xs">
        {filtered === 0
          ? `No ${noun}`
          : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(filtered)}`}
        {filtered !== totalBeforeFilter
          ? ` (filtered from ${formatNumber(totalBeforeFilter)})`
          : ""}
      </p>

      <div className="flex items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger size="sm" className="w-18" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-muted-foreground text-xs whitespace-nowrap">
          Page {formatNumber(pageIndex + 1)} of {formatNumber(Math.max(pageCount, 1))}
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="First page"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Previous page"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Next page"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Last page"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Server-paged counterpart.
 *
 * The `+` on the count is not laziness: with cursor paging the real total is unknown
 * until every cursor has been walked, and printing a definite number that is actually
 * "what I have fetched so far" is a lie the operator will act on. When the API can
 * count the same filter, pass `total` and the `+` disappears.
 */
export function LoadMore({
  loaded,
  total,
  approximate = false,
  hasNextPage,
  loading,
  onLoadMore,
  noun = "rows",
}: {
  loaded: number;
  total?: number;
  approximate?: boolean;
  hasNextPage: boolean;
  loading: boolean;
  onLoadMore: () => void;
  noun?: string;
}) {
  return (
    <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-muted-foreground text-xs">
        {total === undefined
          ? `${formatNumber(loaded)}${hasNextPage ? "+" : ""} ${noun}`
          : `Showing ${formatNumber(loaded)} of ${approximate ? "about " : ""}${formatNumber(total)} ${noun}`}
      </p>

      {hasNextPage ? (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
          {loading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Loading…
            </>
          ) : (
            "Load more"
          )}
        </Button>
      ) : null}
    </div>
  );
}
