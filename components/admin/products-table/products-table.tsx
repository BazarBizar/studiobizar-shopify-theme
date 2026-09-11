"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ImageIcon, SearchIcon, XIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { AppLink } from "@/components/admin/app-link";
import { DataTable } from "@/components/admin/data-table/data-table";
import { DateRangeFilter } from "@/components/admin/data-table/date-range-filter";
import { filterFns } from "@/components/admin/data-table/filters";
import { LoadMore } from "@/components/admin/data-table/pagination";
import { OptionFilter } from "@/components/admin/data-table/option-filter";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ViewOptions } from "@/components/admin/data-table/view-options";
import { ErrorState } from "@/components/admin/error-state";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { useStoredJson } from "@/hooks/use-stored-preference";
import { formatDate } from "@/lib/admin/field-values";

/**
 * The catalogue table — the panel's ONLY server-driven table, because this store has
 * 2027 products.
 *
 * EVERY COLUMN HAS `enableSorting: false` AND THERE ARE NO COLUMN FILTERS. That is not an
 * oversight to tidy up later: the rows in memory are the pages someone has scrolled
 * through, so a column that sorted them would present "of the 50 I happen to have" as if
 * it were "of 2027". Sorting is a Select that goes to Shopify; filtering is `OptionFilter`
 * with options describing the whole store.
 */

export type ProductRowData = {
  id: string;
  param: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  updatedAt: string;
  variants: number;
  /** null means untracked — rendered `—`, never `0`. */
  stock: number | null;
  price: { min: { amount: string; currencyCode: string }; max: { amount: string; currencyCode: string } };
  thumbnail: string | null;
};

/** The only place semantic colour appears in a table. */
function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      >
        Active
      </Badge>
    );
  }
  if (status === "DRAFT") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      >
        Draft
      </Badge>
    );
  }
  return <Badge variant="secondary">Archived</Badge>;
}

function formatMoney(amount: string, currency: string) {
  // Money stays a string end to end; this only formats for display.
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

function PriceRange({ price }: { price: ProductRowData["price"] }) {
  const min = formatMoney(price.min.amount, price.min.currencyCode);
  const max = formatMoney(price.max.amount, price.max.currencyCode);
  // One number when the variants agree; a range only when they genuinely differ.
  return <>{min === max ? min : `${min} – ${max}`}</>;
}

const SORT_OPTIONS = [
  { label: "Recently updated", sortKey: "UPDATED_AT", reverse: true },
  { label: "Least recently updated", sortKey: "UPDATED_AT", reverse: false },
  { label: "Newest", sortKey: "CREATED_AT", reverse: true },
  { label: "Oldest", sortKey: "CREATED_AT", reverse: false },
  { label: "Title, A–Z", sortKey: "TITLE", reverse: false },
  { label: "Title, Z–A", sortKey: "TITLE", reverse: true },
  { label: "Vendor, A–Z", sortKey: "VENDOR", reverse: false },
  { label: "Type, A–Z", sortKey: "PRODUCT_TYPE", reverse: false },
  { label: "Stock, low to high", sortKey: "INVENTORY_TOTAL", reverse: false },
  { label: "Stock, high to low", sortKey: "INVENTORY_TOTAL", reverse: true },
] as const;

const STATUS_LABELS = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" };

type Page = {
  products: ProductRowData[];
  hasNextPage: boolean;
  endCursor: string | null;
  total: { count: number; exact: boolean } | null;
};

export function ProductsTable({
  initial,
  vendors,
  productTypes,
}: {
  initial: Page;
  vendors: string[];
  productTypes: string[];
}) {
  const [rows, setRows] = React.useState(initial.products);
  const [cursor, setCursor] = React.useState(initial.endCursor);
  const [more, setMore] = React.useState(initial.hasNextPage);
  const [total, setTotal] = React.useState(initial.total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = React.useState<string[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [sortIndex, setSortIndex] = React.useState(0);

  const [columnVisibility, setColumnVisibility] = useStoredJson<VisibilityState>(
    "sb-admin.columns.products",
    // Variants and tags are useful but not at a glance.
    { variants: false, tags: false },
  );

  // 350 ms for the server table: each keystroke that gets through is a Shopify query.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const filterState = React.useMemo(
    () => ({
      search: debounced || null,
      status: status.length ? status : undefined,
      vendors: vendorFilter.length ? vendorFilter : undefined,
      productTypes: typeFilter.length ? typeFilter : undefined,
      updatedFrom: dateRange?.from ? dateRange.from.toISOString() : null,
      updatedTo: dateRange?.to ? dateRange.to.toISOString() : null,
      sortKey: SORT_OPTIONS[sortIndex].sortKey,
      reverse: SORT_OPTIONS[sortIndex].reverse,
    }),
    [debounced, status, vendorFilter, typeFilter, dateRange, sortIndex],
  );

  const fetchPage = React.useCallback(
    async (after: string | null, append: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/products", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "products",
            first: 50,
            after,
            // The count is only asked for on a fresh filter; paging cannot change it.
            withCount: !append,
            ...filterState,
          }),
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(detail?.message ?? `Request failed (${response.status})`);
        }

        const page = (await response.json()) as Page;

        setRows((current) => (append ? [...current, ...page.products] : page.products));
        setCursor(page.endCursor);
        setMore(page.hasNextPage);
        if (!append) setTotal(page.total);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load products.");
      } finally {
        setLoading(false);
      }
    },
    [filterState],
  );

  // Any filter or sort change starts a new result set from the first page.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void fetchPage(null, false);
  }, [fetchPage]);

  const columns = React.useMemo<ColumnDef<ProductRowData>[]>(
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
              <AppLink
                href={`/admin/products/${row.original.param}`}
                className="block max-w-72 truncate text-sm font-medium underline-offset-2 hover:underline"
              >
                {row.original.title}
              </AppLink>
              <span className="text-muted-foreground block max-w-72 truncate font-mono text-xs">
                {row.original.handle}
              </span>
            </span>
          </div>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        meta: { kind: "text", label: "Status", width: "7rem" },
        header: () => <span className="text-xs font-medium">Status</span>,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "vendor",
        enableSorting: false,
        meta: { kind: "text", label: "Vendor", width: "10rem" },
        header: () => <span className="text-xs font-medium">Vendor</span>,
        cell: ({ row }) => <span className="block truncate text-sm">{row.original.vendor || "—"}</span>,
      },
      {
        id: "productType",
        enableSorting: false,
        meta: { kind: "text", label: "Type", width: "10rem" },
        header: () => <span className="text-xs font-medium">Type</span>,
        cell: ({ row }) => (
          <span className="block truncate text-sm">{row.original.productType || "—"}</span>
        ),
      },
      {
        id: "price",
        enableSorting: false,
        meta: { kind: "number", label: "Price", numeric: true, width: "10rem" },
        header: () => <span className="text-xs font-medium">Price</span>,
        cell: ({ row }) => <PriceRange price={row.original.price} />,
      },
      {
        id: "stock",
        enableSorting: false,
        meta: { kind: "number", label: "Stock", numeric: true, width: "6rem" },
        header: () => <span className="text-xs font-medium">Stock</span>,
        cell: ({ row }) =>
          // `—` for untracked, never `0`. Every product in this catalogue is untracked,
          // so `0` would mark all 2027 as out of stock.
          row.original.stock === null ? (
            <span className="text-muted-foreground">—</span>
          ) : row.original.stock <= 0 ? (
            <span className="text-amber-700 dark:text-amber-400">{row.original.stock}</span>
          ) : (
            row.original.stock
          ),
      },
      {
        id: "variants",
        enableSorting: false,
        meta: { kind: "number", label: "Variants", numeric: true, width: "6rem" },
        header: () => <span className="text-xs font-medium">Variants</span>,
        cell: ({ row }) => row.original.variants,
      },
      {
        id: "tags",
        enableSorting: false,
        meta: { kind: "list", label: "Tags", width: "14rem" },
        header: () => <span className="text-xs font-medium">Tags</span>,
        cell: ({ row }) => {
          const shown = row.original.tags.slice(0, 3);
          const overflow = row.original.tags.length - shown.length;
          if (!row.original.tags.length) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex flex-wrap gap-1">
              {shown.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
              {overflow > 0 ? <Badge variant="outline">+{overflow}</Badge> : null}
            </span>
          );
        },
      },
      {
        id: "updatedAt",
        enableSorting: false,
        meta: { kind: "date", label: "Updated", width: "11rem" },
        header: () => <span className="text-xs font-medium">Updated</span>,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.updatedAt, true)}</span>
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
            href={`/admin/products/${row.original.param}`}
            label={row.original.title}
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
    state: { columnVisibility },
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    // Shopify does all three; TanStack must not also try.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const filtered =
    Boolean(debounced) ||
    status.length > 0 ||
    vendorFilter.length > 0 ||
    typeFilter.length > 0 ||
    Boolean(dateRange?.from);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="h-8 ps-8"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Options come from the API and describe the whole store, not the loaded rows. */}
        <OptionFilter
          title="Status"
          options={["ACTIVE", "DRAFT", "ARCHIVED"]}
          labels={STATUS_LABELS}
          selected={status}
          onChange={setStatus}
        />
        <OptionFilter title="Vendor" options={vendors} selected={vendorFilter} onChange={setVendorFilter} />
        <OptionFilter
          title="Type"
          options={productTypes}
          selected={typeFilter}
          onChange={setTypeFilter}
        />
        <DateRangeFilter title="Updated" value={dateRange} onChange={setDateRange} />

        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatus([]);
              setVendorFilter([]);
              setTypeFilter([]);
              setDateRange(undefined);
            }}
          >
            <XIcon className="size-3.5" />
            Reset
          </Button>
        ) : null}

        <ViewOptions table={table} />

        {/* Sorting is a Select, not a header click — see the note at the top. */}
        <Select value={String(sortIndex)} onValueChange={(value) => setSortIndex(Number(value))}>
          <SelectTrigger size="sm" className="w-44" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option, index) => (
              <SelectItem key={option.label} value={String(index)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => fetchPage(null, false)} title="Could not load products" />
      ) : null}

      <DataTable
        table={table}
        loading={loading && rows.length === 0}
        filtered={filtered}
        emptyTitle={filtered ? "No matches" : "No products"}
        emptyHint="This store has no products yet."
      />

      <LoadMore
        loaded={rows.length}
        total={total?.count}
        approximate={total ? !total.exact : false}
        hasNextPage={more}
        loading={loading}
        onLoadMore={() => fetchPage(cursor, true)}
        noun="products"
      />
    </div>
  );
}
