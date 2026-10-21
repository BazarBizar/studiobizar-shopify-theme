"use client";

import * as React from "react";

import { RecordPickerDialog, RecordRows, type RecordItem } from "@/components/admin/record-picker";
import { useProductSearch } from "@/lib/admin/queries";

import { moved } from "./media/media-selection";

/**
 * Products or collections for a field — in the panel's forms
 * (`product_reference`, `collection_reference` and their lists) and in the page
 * builder's product and collection fields. Chosen by name and picture from the
 * shop, never by typing an id; the shared `RecordPickerDialog` does the choosing.
 *
 * Products are searched on the server, across the whole catalogue; collections are
 * few, so the caller hands the full list over (`collectionOptions`).
 */

export type CatalogueItem = RecordItem;

export { Thumb } from "@/components/admin/record-picker";

export function CataloguePicker({
  kind,
  multiple,
  value,
  current,
  collectionOptions,
  label,
  disabled,
  max,
  onChange,
}: {
  kind: "product" | "collection";
  multiple: boolean;
  value: string[];
  current: CatalogueItem[];
  collectionOptions: CatalogueItem[];
  label: string;
  disabled?: boolean;
  /** Most items a list may hold. */
  max?: number;
  /** The ids in order, and the records themselves for callers that store more than the id. */
  onChange: (ids: string[], items: CatalogueItem[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [known, setKnown] = React.useState<Record<string, CatalogueItem>>(() =>
    Object.fromEntries([...collectionOptions, ...current].map((item) => [item.id, item])),
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const products = useProductSearch(debounced, kind === "product" && open);
  const options: CatalogueItem[] =
    kind === "collection"
      ? collectionOptions
      : (products.data ?? []).map((product) => ({
          id: product.id,
          label: product.title,
          thumbnail: product.thumbnail,
          handle: product.handle,
        }));

  const noun = kind;
  const emit = (ids: string[], extra: CatalogueItem[] = []) => {
    const all = { ...known, ...Object.fromEntries(extra.map((item) => [item.id, item])) };
    if (extra.length) setKnown(all);
    onChange(ids, ids.map((id) => all[id]).filter((item): item is CatalogueItem => Boolean(item)));
  };

  return (
    <>
      <RecordRows
        items={value.map((id) => known[id] ?? null)}
        noun={noun}
        multiple={multiple}
        disabled={disabled}
        max={multiple ? max : undefined}
        onMove={(index, delta) => emit(moved(value, index, delta))}
        onRemove={(index) => emit(value.filter((_, at) => at !== index))}
        onAdd={() => setOpen(true)}
      />
      <RecordPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={label.toLowerCase()}
        noun={`${noun}s`}
        items={options}
        loading={kind === "product" ? products.isLoading : false}
        error={kind === "product" ? (products.error?.message ?? null) : null}
        onRetry={() => void products.refetch()}
        search={kind === "product" ? { value: search, onChange: setSearch, searching: products.isFetching } : undefined}
        multiple={multiple}
        selectedIds={value}
        limit={multiple && max !== undefined ? max - value.length : undefined}
        onConfirm={(picked) =>
          emit(multiple ? [...value, ...picked.map((item) => item.id)] : [picked[0]!.id], picked)
        }
      />
    </>
  );
}
