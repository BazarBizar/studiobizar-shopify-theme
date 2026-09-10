import type { FilterFn, Row, RowData } from "@tanstack/react-table";

/**
 * THE COLUMN CONTRACT. This file is the reason the toolbar is generic.
 *
 * `toolbar.tsx` never learns about a resource. It reads `column.meta` and decides
 * for itself which controls to render. Adding a filter to a screen therefore means
 * changing DATA — a `facetable` flag, a `kind` — not changing the toolbar. If you
 * find yourself writing `if (resource === "products")` in the toolbar, the system
 * has been abandoned.
 */

/**
 * The field's shape, which drives both the cell renderer and the filter control.
 * Derived from the Shopify field type by `kindForFieldType` below.
 */
export type ValueKind =
  | "text"
  | "longtext"
  | "json"
  | "number"
  | "boolean"
  | "date"
  | "url"
  | "reference"
  | "list"
  | "media"
  | "color";

export type DataTableColumnMeta = {
  kind: ValueKind;
  /** Header text, reused by the column visibility menu. */
  label: string;
  /** Offer a multi-select over this column's distinct values. */
  facetable?: boolean;
  /** Right-align and use tabular figures. Decided once, for header AND body. */
  numeric?: boolean;
  /**
   * CSS width. Without it a short column stretches and its value ends up stranded
   * far from the header that names it.
   */
  width?: string;
};

declare module "@tanstack/react-table" {
  /**
   * Both disables are structural, not laziness. Module augmentation can only be done
   * with `interface`, and this interface's entire purpose is to widen TanStack's
   * `ColumnMeta` to `DataTableColumnMeta` — so it declares no members of its own, and
   * its two generics must match the original signature even though neither is used.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta {}

  interface FilterFns {
    faceted: FilterFn<never>;
    dateRange: FilterFn<never>;
  }
}

/**
 * Sentinel for "this row has no value here". Without it, a row whose field is empty
 * becomes permanently invisible the moment any facet filter is active — it matches
 * no option, so it is silently excluded rather than being something you can ask for.
 *
 * The leading space keeps it out of the way of any real value when sorting.
 */
export const BLANK = " blank";

export const BLANK_LABEL = "— none —";

/**
 * Written as a generic FUNCTION rather than typed as `FilterFn<unknown>`: a generic
 * function stays assignable to `FilterFn<TData>` for any row type, while a concrete
 * `FilterFn<unknown>` does not.
 */
export function facetedFilter<TData extends RowData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  const selected = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  if (selected.length === 0) return true;

  const raw = row.getValue(columnId);

  // A list field matches when ANY of its values is selected, so an entry tagged
  // "Oak" and "Walnut" shows up under both filters.
  if (Array.isArray(raw)) {
    if (raw.length === 0) return selected.includes(BLANK);
    return raw.some((value) => selected.includes(String(value)));
  }

  const value = raw === null || raw === undefined || raw === "" ? BLANK : String(raw);
  return selected.includes(value);
}

export function dateRangeFilter<TData extends RowData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  const range = filterValue as { from?: Date | string; to?: Date | string } | undefined;
  if (!range?.from && !range?.to) return true;

  const raw = row.getValue(columnId);
  if (!raw) return false;

  const value = new Date(String(raw)).getTime();
  if (Number.isNaN(value)) return false;

  if (range.from && value < new Date(range.from).getTime()) return false;
  if (range.to && value > new Date(range.to).getTime()) return false;

  return true;
}

export const filterFns = { faceted: facetedFilter, dateRange: dateRangeFilter };

/* -------------------------------------------------------------------------- *
 * Shopify field type -> ValueKind
 * -------------------------------------------------------------------------- */

/**
 * The single place the panel translates Shopify's field vocabulary into the table's.
 * Anything unrecognised becomes `text`, which is always renderable — a new Shopify
 * field type must never blank out a column.
 */
export function kindForFieldType(type: string): ValueKind {
  if (type.endsWith("file_reference")) return "media";
  if (type.endsWith("_reference")) return "reference";
  if (type.startsWith("list.")) return "list";

  switch (type) {
    case "boolean":
      return "boolean";
    case "number_integer":
    case "number_decimal":
    case "rating":
      return "number";
    case "date":
    case "date_time":
      return "date";
    case "url":
      return "url";
    case "color":
      return "color";
    case "json":
      return "json";
    case "rich_text_field":
    case "multi_line_text_field":
      return "longtext";
    default:
      return "text";
  }
}

/**
 * Which columns are worth offering as a filter, decided from the rows that are
 * actually loaded.
 *
 * The ordering of these rules matters, and rule 5 is the one that earns its keep: a
 * column where nearly every row is unique is a search box, not a filter. Offering a
 * filter with one option per row only adds a click.
 */
export function detectFacetKeys({
  columns,
  rowCount,
  distinctCounts,
  explicit,
  hasChoices,
}: {
  columns: { key: string; kind: ValueKind }[];
  rowCount: number;
  distinctCounts: Record<string, number>;
  /** Keys the module named. These always win. */
  explicit: string[];
  /** Keys whose Shopify definition has a `choices` validation. */
  hasChoices: (key: string) => boolean;
}): string[] {
  const named = new Set(explicit);

  return columns
    .filter(({ key, kind }) => {
      // 1. Explicit wins, whatever the shape.
      if (named.has(key)) return true;

      // 3. Never facet these: a filter per distinct number or URL is noise, and
      //    bulky fields have no short label to put in a list.
      if (kind === "date" || kind === "number" || kind === "url") return false;
      if (kind === "longtext" || kind === "json" || kind === "media" || kind === "color") {
        return false;
      }

      // 4. Always facet a closed set or a reference.
      if (kind === "boolean" || kind === "reference" || hasChoices(key)) return true;

      // 5. Text and lists only when the values actually cluster.
      const distinct = distinctCounts[key] ?? 0;
      if (distinct <= 1 || distinct > 30) return false;
      return distinct <= rowCount * 0.6;
    })
    .map(({ key }) => key);
}
