"use client";

import { flexRender, type Table as TableInstance } from "@tanstack/react-table";

import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { cn } from "@/lib/utils/cn";

/**
 * PURELY PRESENTATIONAL. It receives a table instance and renders it. No state, no
 * fetching, no knowledge of which resource it is showing.
 *
 * That constraint is what lets the same shell serve both load strategies — a
 * client-side table with everything in memory and a server-paged one — without a
 * single branch in here.
 */

export function DataTable<TData>({
  table,
  loading = false,
  filtered = false,
  emptyTitle,
  emptyHint,
  filteredHint = "Try a different search or clear the filters.",
  renderRow,
}: {
  table: TableInstance<TData>;
  loading?: boolean;
  /** Whether a search or filter is active — changes the empty-state wording. */
  filtered?: boolean;
  emptyTitle: string;
  emptyHint: string;
  filteredHint?: string;
  /** Lets a caller wrap each row, e.g. to make it draggable. */
  renderRow?: (row: ReturnType<TableInstance<TData>["getRowModel"]>["rows"][number]) => React.ReactNode;
}) {
  const columnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={header.column.columnDef.meta?.width ? { width: header.column.columnDef.meta.width } : undefined}
                    className={cn(header.column.columnDef.meta?.numeric && "text-right")}
                    /* aria-sort belongs on the element carrying role=columnheader —
                       a <button> does not support it. */
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              /* Six skeleton rows, not a spinner: the page keeps its shape, so the
                 real rows land in place instead of shoving the layout around. */
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {Array.from({ length: Math.max(columnCount, 1) }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} className="py-2.5">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={Math.max(columnCount, 1)} className="h-32 text-center">
                  <p className="text-sm font-medium">{emptyTitle}</p>
                  {/* Two different hints: "clear your filters" is useless advice
                      when there is genuinely nothing in the store. */}
                  <p className="text-muted-foreground text-sm">
                    {filtered ? filteredHint : emptyHint}
                  </p>
                </TableCell>
              </TableRow>
            ) : renderRow ? (
              rows.map((row) => renderRow(row))
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-2.5",
                        cell.column.columnDef.meta?.numeric && "text-right tabular-nums",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
