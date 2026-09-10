"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ColumnHeader } from "@/components/admin/data-table/column-header";
import type { ValueKind } from "@/components/admin/data-table/filters";
import { AppLink } from "@/components/admin/app-link";
import { toPlainText } from "@/lib/admin/field-values";

import { CellValue, type CellData } from "./cell-value";

/**
 * Column definitions for a metaobject list, built from the resolved definition rather
 * than written per type. The screen supplies the field list; this turns it into
 * TanStack columns with the `meta` the toolbar reads.
 */

export type EntryRow = {
  id: string;
  /** Numeric part of the gid, for the row's edit link. */
  param: string;
  handle: string;
  displayName: string | null;
  updatedAt: string;
  cells: Record<string, CellData>;
};

export type FieldColumn = {
  key: string;
  label: string;
  kind: ValueKind;
  facetable: boolean;
  visible: boolean;
  width?: string;
};

export function buildColumns({
  fields,
  type,
  readOnly,
  sortable,
  reorderable,
}: {
  fields: FieldColumn[];
  type: string;
  readOnly: boolean;
  /** False in server mode, where sorting the loaded page would mislead. */
  sortable: boolean;
  /** Adds the grip column. Its CELL is rendered by SortableRow, which owns the
   *  dnd-kit listeners; declaring it here is what keeps the header aligned with the
   *  body instead of the grip shifting every column one place left. */
  reorderable: boolean;
}): ColumnDef<EntryRow>[] {
  const fieldColumns: ColumnDef<EntryRow>[] = fields.map((field) => ({
    id: field.key,
    /**
     * The accessor returns a SORTABLE, FILTERABLE projection rather than the raw
     * stored string: a list yields its labels so the faceted filter can match any of
     * them, a date yields its ISO string so lexical sort is chronological.
     */
    accessorFn: (row) => {
      const cell = row.cells[field.key];
      if (!cell) return "";

      if (field.kind === "list" || field.kind === "reference") return cell.labels;
      if (field.kind === "number") return cell.value === null ? null : Number(cell.value);
      if (field.kind === "longtext" || field.kind === "json") {
        return toPlainText(field.kind === "json" ? "json" : "rich_text_field", cell.value);
      }
      return cell.value ?? "";
    },
    enableSorting: sortable && field.kind !== "media" && field.kind !== "list",
    filterFn: "faceted",
    meta: {
      kind: field.kind,
      label: field.label,
      facetable: field.facetable,
      numeric: field.kind === "number",
      width: field.width,
    },
    header: ({ column }) => (
      <ColumnHeader column={column} title={field.label} numeric={field.kind === "number"} />
    ),
    cell: ({ row }) => <CellValue cell={row.original.cells[field.key]} />,
  }));

  const gripColumn: ColumnDef<EntryRow>[] = reorderable
    ? [
        {
          id: "drag",
          enableSorting: false,
          enableHiding: false,
          enableGlobalFilter: false,
          meta: { kind: "text", label: "Reorder", width: "2.25rem" },
          header: () => <span className="sr-only">Reorder</span>,
          cell: () => null,
        },
      ]
    : [];

  return [
    ...gripColumn,
    ...fieldColumns,
    {
      id: "updatedAt",
      accessorFn: (row) => row.updatedAt,
      enableSorting: sortable,
      enableHiding: true,
      filterFn: "dateRange",
      meta: { kind: "date", label: "Updated", width: "9rem" },
      header: ({ column }) => <ColumnHeader column={column} title="Updated" />,
      cell: ({ row }) => (
        <CellValue cell={{ kind: "date", value: row.original.updatedAt, labels: [], thumbnail: null }} />
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      // Kept out of the column menu: hiding the only way into a record is not a view
      // preference, it is a broken screen.
      enableHiding: false,
      meta: { kind: "text", label: "Actions", width: "5rem" },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <AppLink
          href={`/admin/${type}/${row.original.param}`}
          className="text-sm underline underline-offset-2"
        >
          {readOnly ? "View" : "Edit"}
        </AppLink>
      ),
    },
  ];
}
