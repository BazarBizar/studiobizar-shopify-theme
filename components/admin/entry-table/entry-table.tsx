"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DataTable } from "@/components/admin/data-table/data-table";
import { filterFns } from "@/components/admin/data-table/filters";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/admin/data-table/pagination";
import { SortableRow } from "@/components/admin/data-table/sortable-row";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { Button } from "@/components/admin/ui/button";
import { useStoredJson } from "@/hooks/use-stored-preference";

import { buildColumns, type EntryRow, type FieldColumn } from "./columns";

/**
 * Assembles the shared primitives into the metaobject list table.
 *
 * Load strategy is `client` for every metaobject type in this store: the largest is 18
 * entries, so the whole collection is in memory and both the faceted filters and the
 * per-column sorting are correct over the complete set. When a collection can exceed
 * roughly a thousand rows, it moves to the server strategy — and at that point every
 * column must set `enableSorting: false` and the column filters must go, because both
 * would then be operating on one page rather than the set.
 */
export function EntryTable({
  type,
  fields,
  rows,
  readOnly,
  orderField,
  onExport,
  excelHref = null,
}: {
  type: string;
  fields: FieldColumn[];
  rows: EntryRow[];
  readOnly: boolean;
  /** Manual order field, when the definition has one. Enables drag-to-reorder. */
  orderField: string | null;
  onExport: () => Promise<number>;
  /** When set, an .xlsx download is offered beside the CSV export. */
  excelHref?: string | null;
}) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [exporting, setExporting] = React.useState(false);
  const [order, setOrder] = React.useState<string[] | null>(null);

  const [sorting, setSorting] = React.useState<SortingState>(
    // A collection with a manual order field opens in that order, ascending, so the
    // sequence the operator arranged is what they see first.
    orderField ? [{ id: orderField, desc: false }] : [{ id: "updatedAt", desc: true }],
  );

  /** Hidden columns are a per-operator preference, so they persist per type. */
  const [columnVisibility, setColumnVisibility] = useStoredJson<VisibilityState>(
    `sb-admin.columns.${type}`,
    Object.fromEntries(fields.filter((field) => !field.visible).map((field) => [field.key, false])),
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const data = React.useMemo(() => {
    if (!order) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    // Rows the local order does not know about (added since) go last rather than
    // vanishing.
    const known = order.map((id) => byId.get(id)).filter((row): row is EntryRow => Boolean(row));
    const rest = rows.filter((row) => !order.includes(row.id));
    return [...known, ...rest];
  }, [rows, order]);

  const columns = React.useMemo(
    () => buildColumns({ fields, type, readOnly, sortable: true, reorderable: Boolean(orderField) }),
    [fields, type, readOnly, orderField],
  );

  const table = useReactTable({
    data,
    columns,
    filterFns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    onGlobalFilterChange: setDebouncedSearch,
    // Stated rather than left to `auto`, so a list column (whose accessor returns an
    // array) is matched by substring instead of by TanStack guessing a ranked match.
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
    /**
     * Off, with the page reset handled by the effect below. TanStack's auto-reset defers
     * `resetPageIndex` to a microtask, and under React 19's development double render
     * that microtask can run before the component has mounted — which React reports as
     * a state update on an unmounted component. Resetting from an effect puts it on a
     * timeline React controls.
     */
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

  // The date filter is a column filter on `updatedAt`, applied through the same
  // pipeline as every other filter so `Reset` clears all of them together.
  React.useEffect(() => {
    table.getColumn("updatedAt")?.setFilterValue(dateRange?.from ? dateRange : undefined);
  }, [dateRange, table]);

  /**
   * Reordering is only meaningful while the visible order IS the stored order. Sorted
   * by another column, or filtered, a drop would write positions derived from a view
   * that is not the sequence being stored.
   */
  const reorderBlockedBecause = React.useMemo(() => {
    if (!orderField) return null;
    if (search || columnFilters.length > 0) return "Clear the search and filters to reorder";
    const active = sorting[0];
    if (!active || active.id !== orderField || active.desc) {
      return "Sort by the order column, ascending, to reorder";
    }
    return null;
  }, [orderField, search, columnFilters, sorting]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the grip is still a
    // click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pageRows = table.getRowModel().rows;
  const pageIds = pageRows.map((row) => row.original.id);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = data.map((row) => row.id);
    const from = current.indexOf(String(active.id));
    const to = current.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);

    // Persisting the new positions writes one update per moved row, which is Phase 3
    // work; for now the reorder is local and says so.
    toast.info("Order changed locally", {
      description: "Saving a new order to Shopify is not wired up yet.",
    });
  }

  async function runExport() {
    setExporting(true);
    try {
      const count = await onExport();
      toast.success("Exported", { description: `${count} rows written to CSV.` });
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Could not build the file.",
      });
    } finally {
      setExporting(false);
    }
  }

  const filtered = Boolean(debouncedSearch) || columnFilters.length > 0;

  const body = (
    <DataTable
      table={table}
      filtered={filtered}
      emptyTitle={filtered ? "No matches" : "Nothing here yet"}
      emptyHint="Create the first entry to see it listed."
      renderRow={
        orderField
          ? (row) => (
              <SortableRow
                key={row.id}
                row={row}
                id={row.original.id}
                disabledReason={reorderBlockedBecause}
              />
            )
          : undefined
      }
    />
  );

  return (
    <div className="space-y-3">
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search entries"
        dateColumnId="updatedAt"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        actions={
          <>
            {excelHref ? (
              <Button asChild variant="outline" size="sm">
                {/* A plain link, not fetch-then-Blob: the response is a file and the
                    browser already knows how to save one from Content-Disposition. */}
                <a href={excelHref} download>
                  <DownloadIcon className="size-3.5" />
                  <span className="hidden sm:inline">Excel</span>
                </a>
              </Button>
            ) : null}
          <Button variant="outline" size="sm" onClick={runExport} disabled={exporting}>
            {exporting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            <span className="hidden sm:inline">CSV</span>
          </Button>
          </>
        }
      />

      {orderField ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
            {body}
          </SortableContext>
        </DndContext>
      ) : (
        body
      )}

      <DataTablePagination table={table} totalBeforeFilter={rows.length} noun="entries" />
    </div>
  );
}
