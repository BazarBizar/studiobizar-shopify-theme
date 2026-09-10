"use client";

import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  isListType,
  isTrue,
  paramFromEntryId,
  parseList,
  toPlainText,
  truncate,
} from "@/lib/admin/field-values";

/**
 * TanStack Table v9. The API differs from the v8 most examples show: the hook is
 * `useTable` (not `useReactTable`), features are opted into explicitly through
 * `tableFeatures`, and `ColumnDef` takes the feature set as its first generic.
 * Only sorting and column visibility are enabled here — filtering is done in the
 * `filtered` memo below, because the facet logic has to see the complete set.
 *
 * Declared at module scope, as the library recommends: re-creating it per render
 * would rebuild the table's feature set on every keystroke.
 */
const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type TableEntry = {
  id: string;
  handle: string;
  updatedAt: string;
  displayName: string | null;
  status: string | null;
  /** key -> { value, type, thumbnail }, flattened on the server. */
  cells: Record<string, { value: string | null; type: string; thumbnail: string | null }>;
};

export type TableColumn = { key: string; label: string; type: string; visible: boolean };

export type Facet = { key: string; label: string; options: string[] };

type Props = {
  type: string;
  columns: TableColumn[];
  entries: TableEntry[];
  facets: Facet[];
  searchFields: string[];
  orderField: string | null;
  readOnly: boolean;
  /**
   * "client" means every row is already here, so sorting and filtering in the
   * browser are correct. "server" would mean these controls operate on one page of
   * a larger set — see the `enableSorting` note below.
   */
  load: "client" | "server";
};

/** Thumbnail cell, for a `file_reference` that resolved to an image. */
function Thumb({ url, alt }: { url: string; alt: string }) {
  return (
    <span className="border-admin-border bg-admin-raised block size-9 overflow-hidden rounded border">
      {/* Unoptimised to match the storefront: images come straight off the Shopify
          CDN with its own transform, and next.config.ts bypasses the optimiser. */}
      <Image
        src={url}
        alt={alt}
        width={36}
        height={36}
        unoptimized
        className="size-full object-cover"
      />
    </span>
  );
}

export function EntryTable({
  type,
  columns,
  entries,
  facets,
  searchFields,
  orderField,
  readOnly,
  load,
}: Props) {
  const [search, setSearch] = useState("");
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [sorting, setSorting] = useState<SortingState>(
    // Default to the manual order field when the module names one: that integer is
    // what the storefront sorts by, so the panel should agree out of the box.
    orderField ? [{ id: orderField, desc: false }] : [],
  );
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    Object.fromEntries(columns.map((column) => [column.key, column.visible])),
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const tableColumns = useMemo<ColumnDef<typeof features, TableEntry>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        header: column.label,
        // Sort on plain text, so a date sorts by its ISO string and a list by its
        // length rather than by the JSON that happens to encode it.
        accessorFn: (row: TableEntry) => toPlainText(column.type, row.cells[column.key]?.value),
        enableSorting:
          // In server mode the loaded rows are one page, not the set. A column that
          // sorts them looks authoritative and is wrong, so it is switched off
          // rather than left to mislead.
          load === "client" && column.type !== "rich_text_field" && !isListType(column.type),
        cell: ({ row }) => {
          const cell = row.original.cells[column.key];
          if (!cell) return null;

          if (cell.thumbnail) {
            return <Thumb url={cell.thumbnail} alt={row.original.displayName ?? ""} />;
          }

          if (cell.type === "boolean") {
            return (
              <span className={isTrue(cell.value) ? "text-admin-ok" : "text-admin-faint"}>
                {isTrue(cell.value) ? "Yes" : "No"}
              </span>
            );
          }

          if (isListType(cell.type)) {
            const count = parseList(cell.value).length;
            return count ? (
              <span className="bg-admin-raised text-admin-muted rounded px-1.5 py-0.5 text-[0.6875rem]">
                {count}
              </span>
            ) : (
              <span className="text-admin-faint">—</span>
            );
          }

          const text = toPlainText(cell.type, cell.value);
          if (!text) return <span className="text-admin-faint">—</span>;

          return <span title={text.length > 80 ? text : undefined}>{truncate(text)}</span>;
        },
      })),
    [columns, load],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const activeFacets = Object.entries(facetValues).filter(([, value]) => value !== "");

    if (!needle && activeFacets.length === 0) return entries;

    return entries.filter((entry) => {
      for (const [key, value] of activeFacets) {
        const cell = entry.cells[key];
        if (toPlainText(cell?.type ?? "single_line_text_field", cell?.value) !== value) return false;
      }

      if (!needle) return true;

      // The module's nominated fields, plus the display name so a row is findable
      // by the label it actually shows.
      const haystack = [
        entry.displayName ?? "",
        ...searchFields.map((key) =>
          toPlainText(entry.cells[key]?.type ?? "single_line_text_field", entry.cells[key]?.value),
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [entries, search, facetValues, searchFields]);

  const table = useTable({
    features,
    data: filtered,
    columns: tableColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const hiddenCount = columns.length - table.getVisibleLeafColumns().length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search entries"
          className="border-admin-border bg-admin-panel rounded-admin w-48 border px-2.5 py-1.5 outline-none"
        />

        {facets.map((facet) => (
          <select
            key={facet.key}
            value={facetValues[facet.key] ?? ""}
            aria-label={`Filter by ${facet.label}`}
            onChange={(event) =>
              setFacetValues((current) => ({ ...current, [facet.key]: event.target.value }))
            }
            className="border-admin-border bg-admin-panel rounded-admin border px-2 py-1.5 outline-none"
          >
            <option value="">All {facet.label.toLowerCase()}</option>
            {facet.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnMenu((open) => !open)}
            aria-expanded={showColumnMenu}
            className="border-admin-border bg-admin-panel rounded-admin border px-2.5 py-1.5"
          >
            Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
          </button>

          {showColumnMenu ? (
            <div className="border-admin-border bg-admin-panel rounded-admin absolute z-10 mt-1 max-h-72 w-56 overflow-y-auto border p-2 shadow-lg">
              {/* Every field Shopify has is listed here, including ones the module
                  chose not to show by default. A field is never unavailable. */}
              {table.getAllLeafColumns().map((column) => (
                <label key={column.id} className="flex items-center gap-2 px-1 py-1">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  <span className="truncate">
                    {columns.find((candidate) => candidate.key === column.id)?.label ?? column.id}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <span className="text-admin-muted ml-auto text-xs tabular-nums">
          {filtered.length === entries.length
            ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`
            : `${filtered.length} of ${entries.length}`}
        </span>
      </div>

      <div className="border-admin-border bg-admin-panel rounded-admin overflow-x-auto border">
        <table className="w-full border-collapse text-left">
          <thead className="bg-admin-raised border-admin-border border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const direction = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="text-admin-muted px-3 py-2 text-xs font-medium whitespace-nowrap"
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="hover:text-admin-fg flex items-center gap-1"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-admin-faint">
                            {direction === "asc" ? "↑" : direction === "desc" ? "↓" : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
                <th scope="col" className="w-10 px-3 py-2" />
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-admin-border hover:bg-admin-raised border-b last:border-b-0"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {/* Nested under the list rather than a sibling `/admin/entry/…`:
                      a static sibling segment could one day collide with a real
                      metaobject type of the same name. `new` is safe alongside
                      `[id]` because an id is always digits. */}
                  <Link
                    href={`/admin/${type}/${paramFromEntryId(row.original.id)}`}
                    className="text-admin-focus underline underline-offset-2"
                  >
                    {readOnly ? "View" : "Edit"}
                  </Link>
                </td>
              </tr>
            ))}

            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length + 1}
                  className="text-admin-muted px-3 py-8 text-center"
                >
                  {entries.length === 0 ? "No entries yet." : "Nothing matches those filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
