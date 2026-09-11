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
import * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { ColumnHeader } from "@/components/admin/data-table/column-header";
import { DataTable } from "@/components/admin/data-table/data-table";
import { filterFns } from "@/components/admin/data-table/filters";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/admin/data-table/pagination";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { Badge } from "@/components/admin/ui/badge";
import { useStoredJson } from "@/hooks/use-stored-preference";
import { formatDate } from "@/lib/admin/field-values";

/**
 * Customers. Fixed columns, like every standard Shopify resource.
 *
 * There is no Company column and no inherited-status flag: company accounts are a Shopify
 * Plus feature and this store is on Basic, so no customer here can belong to one. Adding
 * a column that can only ever be empty would be inventing a relationship the store cannot
 * express.
 */

export type CustomerRowData = {
  id: string;
  param: string;
  name: string;
  email: string | null;
  state: string;
  stateLabel: string;
  tags: string[];
  orders: number;
  spent: { amount: string; currencyCode: string } | null;
  location: string | null;
  createdAt: string;
};

function money(value: { amount: string; currencyCode: string } | null) {
  if (!value) return "—";
  const amount = Number(value.amount);
  if (Number.isNaN(amount)) return `${value.amount} ${value.currencyCode}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: value.currencyCode }).format(amount);
}

export function CustomersTable({ rows }: { rows: CustomerRowData[] }) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);

  const [columnVisibility, setColumnVisibility] = useStoredJson<VisibilityState>(
    "sb-admin.columns.customers",
    {},
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const columns = React.useMemo<ColumnDef<CustomerRowData>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name} ${row.email ?? ""}`,
        meta: { kind: "text", label: "Name" },
        header: ({ column }) => <ColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <span className="min-w-0">
            <AppLink
              href={`/admin/customers/${row.original.param}`}
              className="block truncate text-sm font-medium underline-offset-2 hover:underline"
            >
              {row.original.name}
            </AppLink>
            <span className="text-muted-foreground block truncate text-xs">
              {row.original.email ?? "no email"}
            </span>
          </span>
        ),
      },
      {
        id: "stateLabel",
        accessorFn: (row) => row.stateLabel,
        filterFn: "faceted",
        meta: { kind: "text", label: "Status", facetable: true, width: "8rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant={row.original.state === "ENABLED" ? "default" : "secondary"}>
            {row.original.stateLabel}
          </Badge>
        ),
      },
      {
        id: "location",
        accessorFn: (row) => row.location ?? "",
        filterFn: "faceted",
        meta: { kind: "text", label: "Location", facetable: true, width: "10rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Location" />,
        cell: ({ row }) =>
          row.original.location ? (
            <span className="text-sm">{row.original.location}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "orders",
        accessorFn: (row) => row.orders,
        meta: { kind: "number", label: "Orders", numeric: true, width: "6rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Orders" numeric />,
        cell: ({ row }) => row.original.orders,
      },
      {
        id: "spent",
        accessorFn: (row) => Number(row.spent?.amount ?? 0),
        meta: { kind: "number", label: "Spent", numeric: true, width: "8rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Spent" numeric />,
        cell: ({ row }) => money(row.original.spent),
      },
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAt,
        filterFn: "dateRange",
        meta: { kind: "date", label: "Created", width: "10rem" },
        header: ({ column }) => <ColumnHeader column={column} title="Created" />,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.createdAt, false)}</span>
        ),
      },
      {
        /* No delete here. Products, collections and customers are created and removed in
           Shopify; the only destructive mutation this panel carries is for the content
           types it authors itself. See the note in lib/admin/operations.ts. */
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        meta: { kind: "text", label: "Actions", width: "4rem" },
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            href={`/admin/customers/${row.original.param}`}
            label={row.original.name}
          />
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    filterFns,
    state: { sorting, columnFilters, columnVisibility, globalFilter: debounced },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    onGlobalFilterChange: setDebounced,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
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
  }, [debounced, columnFilters, table]);

  const filtered = Boolean(debounced) || columnFilters.length > 0;

  return (
    <div className="space-y-3">
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customers"
      />

      <DataTable
        table={table}
        filtered={filtered}
        emptyTitle={filtered ? "No matches" : "No customers yet"}
        emptyHint="Customers appear here once someone creates an account on the storefront."
      />

      <DataTablePagination table={table} totalBeforeFilter={rows.length} noun="customers" />
    </div>
  );
}
