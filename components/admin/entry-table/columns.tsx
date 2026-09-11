"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ColumnHeader } from "@/components/admin/data-table/column-header";
import type { ValueKind } from "@/components/admin/data-table/filters";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { AppLink } from "@/components/admin/app-link";
import { toPlainText } from "@/lib/admin/field-values";

import { CellValue, type CellData } from "./cell-value";
import { DeleteEntryAction } from "./delete-entry-action";

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

/**
 * Text for the linked name cell. Falls through the entry's own display name to its
 * handle, so a row whose name field happens to be empty is still a link with something
 * to click rather than a clickable dash.
 */
function entryLabel(row: EntryRow, field: FieldColumn) {
  const value = row.cells[field.key]?.value ?? null;

  const text =
    field.kind === "longtext" || field.kind === "json"
      ? toPlainText(field.kind === "json" ? "json" : "rich_text_field", value)
      : (value ?? "");

  return text.trim() || row.displayName || row.handle || "Untitled";
}

export function buildColumns({
  fields,
  type,
  readOnly,
  linkKey,
  typeLabel,
  deletable,
  sortable,
  reorderable,
}: {
  fields: FieldColumn[];
  type: string;
  readOnly: boolean;
  /**
   * The column that doubles as the row's link into the record — Shopify's
   * `displayNameKey` for this definition. Null leaves every cell plain, and the
   * actions column remains the only way in.
   */
  linkKey: string | null;
  /** Singular noun for this type, for the delete confirmation: "designer", "FAQ item". */
  typeLabel: string;
  /**
   * Whether to offer the trash icon. A courtesy only — `assertDeletable` in the data
   * layer refuses the same types whether or not this is true.
   */
  deletable: boolean;
  /** False in server mode, where sorting the loaded page would mislead. */
  sortable: boolean;
  /** Adds the grip column. Its CELL is rendered by SortableRow, which owns the
   *  dnd-kit listeners; declaring it here is what keeps the header aligned with the
   *  body instead of the grip shifting every column one place left. */
  reorderable: boolean;
}): ColumnDef<EntryRow>[] {
  /**
   * One name per row, computed once and used by BOTH the link cell and the delete
   * confirmation. Sharing it is the point: the dialog must ask about the record using
   * the words the operator just clicked, not a different field's value.
   */
  const linkField = fields.find((field) => field.key === linkKey) ?? null;

  const nameOf = (row: EntryRow) =>
    linkField ? entryLabel(row, linkField) : row.displayName || row.handle || "Untitled";

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
    cell: ({ row }) =>
      /* The name is the obvious thing to click, so it opens the record — the same
         destination the actions column points at, which stays for the rows whose name
         cell is hidden through the column menu. */
      field.key === linkKey ? (
        <AppLink
          href={`/admin/${type}/${row.original.param}`}
          className="block max-w-72 truncate text-sm font-medium underline-offset-2 hover:underline"
          title={nameOf(row.original)}
        >
          {nameOf(row.original)}
        </AppLink>
      ) : (
        <CellValue cell={row.original.cells[field.key]} />
      ),
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
      meta: { kind: "text", label: "Actions", width: deletable ? "5.5rem" : "4rem" },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          href={`/admin/${type}/${row.original.param}`}
          label={nameOf(row.original)}
          readOnly={readOnly}
        >
          {deletable ? (
            <DeleteEntryAction
              entryId={row.original.id}
              name={nameOf(row.original)}
              typeLabel={typeLabel}
            />
          ) : null}
        </RowActions>
      ),
    },
  ];
}
