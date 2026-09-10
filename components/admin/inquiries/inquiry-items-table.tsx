"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { DataTable } from "@/components/admin/data-table/data-table";
import { filterFns } from "@/components/admin/data-table/filters";
import { DataTablePagination } from "@/components/admin/data-table/pagination";

/**
 * The line items on an inquiry.
 *
 * Built on the SAME table stack as every other list in the panel — TanStack plus
 * `DataTable` plus `DataTablePagination` — rather than a bespoke `<table>`. That is what
 * gives it the same page-size control, the same empty state and the same cell rhythm as
 * the rest of the panel, for free.
 */

export type InquiryItemRow = {
  sku: string | null;
  title: string | null;
  variantTitle: string | null;
  qty: number;
  productHandle: string | null;
  thumbnail: string | null;
};

export function InquiryItemsTable({ items }: { items: InquiryItemRow[] }) {
  const columns = React.useMemo<ColumnDef<InquiryItemRow>[]>(
    () => [
      {
        id: "product",
        enableSorting: false,
        enableHiding: false,
        meta: { kind: "text", label: "Product" },
        header: () => <span className="text-xs font-medium">Product</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {row.original.thumbnail ? (
                <Image
                  src={row.original.thumbnail}
                  alt=""
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
              {/* A link only where there is somewhere to go. An item whose product has
                  since been removed still shows its title, as plain text. */}
              {row.original.productHandle ? (
                <AppLink
                  href={`/admin/products?search=${encodeURIComponent(row.original.title ?? "")}`}
                  className="block max-w-72 truncate text-sm font-medium underline-offset-2 hover:underline"
                >
                  {row.original.title ?? "Untitled"}
                </AppLink>
              ) : (
                <span className="block max-w-72 truncate text-sm font-medium">
                  {row.original.title ?? "Untitled"}
                </span>
              )}
              {row.original.variantTitle ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {row.original.variantTitle}
                </span>
              ) : null}
            </span>
          </div>
        ),
      },
      {
        id: "sku",
        enableSorting: false,
        meta: { kind: "text", label: "SKU", width: "10rem" },
        header: () => <span className="text-xs font-medium">SKU</span>,
        cell: ({ row }) =>
          row.original.sku ? (
            <span className="font-mono text-xs">{row.original.sku}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "qty",
        enableSorting: false,
        meta: { kind: "number", label: "Qty", numeric: true, width: "5rem" },
        header: () => <span className="text-xs font-medium">Qty</span>,
        cell: ({ row }) => row.original.qty,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    filterFns,
    initialState: { pagination: { pageSize: 25 } },
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-3">
      <DataTable
        table={table}
        emptyTitle="No line items"
        emptyHint="This inquiry was submitted without any products."
      />
      {items.length > 25 ? (
        <DataTablePagination table={table} totalBeforeFilter={items.length} noun="items" />
      ) : null}
    </div>
  );
}
