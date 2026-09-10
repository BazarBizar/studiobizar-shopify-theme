"use client";

import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { ColumnHeader } from "@/components/admin/data-table/column-header";
import { DataTable } from "@/components/admin/data-table/data-table";
import { filterFns } from "@/components/admin/data-table/filters";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/admin/data-table/pagination";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { Badge } from "@/components/admin/ui/badge";
import { useStoredJson } from "@/hooks/use-stored-preference";
import { formatDate } from "@/lib/admin/field-values";

/**
 * The collections table.
 *
 * FIXED COLUMNS, unlike the metaobject tables. A collection is a standard Shopify
 * resource with a stable GraphQL shape — there is nothing to discover at runtime, so the
 * columns are written out. What is still discovered is the CONTENT of the filters, which
 * belongs to the filter, not to the column.
 *
 * Client strategy: dozens of rows, not thousands, so sorting and faceted filtering in
 * the browser are correct over the complete set.
 */

export type CollectionRowData = {
  id: string;
  param: string;
  title: string;
  handle: string;
  updatedAt: string;
  sortOrderLabel: string;
  productsCount: number;
  image: { url: string; altText: string | null } | null;
  /** "Smart" when the collection has a rule set, "Manual" otherwise. */
  kind: string;
};

export function CollectionsTable({ rows }: { rows: CollectionRowData[] }) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const [columnVisibility, setColumnVisibility] = useStoredJson<VisibilityState>(
    "sb-admin.columns.collections",
    {},
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const columns = React.useMemo<ColumnDef<CollectionRowData>[]>(
    () => [
      {
        id: "title",
        accessorFn: (row) => row.title,
        meta: { kind: "text", label: "Collection" },
        header: ({ column }) => <ColumnHeader column={column} title="Collection" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {row.original.image ? (
                <Image
                  src={row.original.image.url}
                  alt={row.original.image.altText ?? ""}
                  width={36}
                  height={36}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="text-muted-foreground size-3.5" />
              )}
            </span>

            <span className="min-w-0">
              <AppLink
                href={`/admin/collections/${row.original.param}`}
                className="block truncate text-sm font-medium underline-offset-2 hover:underline"
              >
                {row.original.title}
              </AppLink>
              <span className="text-muted-foreground block truncate font-mono text-xs">
                {row.original.handle}
              </span>
            </span>
          </div>
        ),
      },
      {
        id: "kind",
        accessorFn: (row) => row.kind,
        filterFn: "faceted",
        // The one facet here: whether the collection picks its own products.
        meta: { kind: "text", label: "Type", facetable: true, width: "7rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Type" />,
        cell: ({ row }) =>
          row.original.kind === "Smart" ? (
            <Badge variant="secondary">Smart</Badge>
          ) : (
            <Badge variant="outline">Manual</Badge>
          ),
      },
      {
        id: "sortOrderLabel",
        accessorFn: (row) => row.sortOrderLabel,
        filterFn: "faceted",
        meta: { kind: "text", label: "Sort order", facetable: true, width: "11rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Sort order" />,
        // A sentence, never the raw enum — see `sortOrderLabel` in lib/admin/collections.ts.
        cell: ({ row }) => <span className="text-sm">{row.original.sortOrderLabel}</span>,
      },
      {
        id: "productsCount",
        accessorFn: (row) => row.productsCount,
        meta: { kind: "number", label: "Products", numeric: true, width: "7rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Products" numeric />,
        cell: ({ row }) => row.original.productsCount,
      },
      {
        id: "updatedAt",
        accessorFn: (row) => row.updatedAt,
        filterFn: "dateRange",
        meta: { kind: "date", label: "Updated", width: "10rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Updated" />,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.updatedAt, true)}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    filterFns,
    state: { sorting, columnFilters, columnVisibility, globalFilter: debouncedSearch },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    onGlobalFilterChange: setDebouncedSearch,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
    // See the note in the metaobject table: TanStack's auto-reset lands on a microtask
    // that can run before mount under React 19's development double render.
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  React.useEffect(() => {
    table.setPageIndex(0);
  }, [debouncedSearch, columnFilters, table]);

  const filtered = Boolean(debouncedSearch) || columnFilters.length > 0;

  return (
    <div className="space-y-3">
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search collections"
      />

      <DataTable
        table={table}
        filtered={filtered}
        emptyTitle={filtered ? "No matches" : "No collections"}
        emptyHint="This store has no collections yet."
      />

      <DataTablePagination table={table} totalBeforeFilter={rows.length} noun="collections" />
    </div>
  );
}
