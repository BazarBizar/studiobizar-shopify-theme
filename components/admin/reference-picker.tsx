"use client";

import Image from "next/image";
import { useState } from "react";

import { useMetaobjectOptions } from "@/lib/admin/queries";

import { PickerDialog } from "./picker-dialog";

/**
 * Picks metaobject entries for a `metaobject_reference` or
 * `list.metaobject_reference` field.
 *
 * `targetType` is resolved on the SERVER from the field's
 * `metaobject_definition_id` validation, because that validation carries a
 * definition gid and only the definition list can turn it into a type. A client
 * that had to resolve it would need the whole definition list shipped to it.
 */

type Selected = { id: string; label: string; thumbnail: string | null };

type Props = {
  /** Chosen ids, in order. A single-reference field passes at most one. */
  value: string[];
  current: Selected[];
  onChange: (ids: string[]) => void;
  targetType: string | null;
  multiple: boolean;
  disabled?: boolean;
  label: string;
};

export function ReferencePicker({
  value,
  current,
  onChange,
  targetType,
  multiple,
  disabled,
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Labels for ids chosen in this session; the server only resolved what was
  // already stored.
  const [known, setKnown] = useState<Record<string, Selected>>(() =>
    Object.fromEntries(current.map((item) => [item.id, item])),
  );

  const { data, isLoading, error } = useMetaobjectOptions({ type: targetType, enabled: open });

  const describe = (id: string): Selected => known[id] ?? { id, label: id, thumbnail: null };

  const needle = search.trim().toLowerCase();
  const options = (data?.entries ?? []).filter((entry) =>
    needle ? entry.label.toLowerCase().includes(needle) : true,
  );

  const toggle = (id: string, entry: Selected) => {
    setKnown((current) => ({ ...current, [id]: entry }));

    if (!multiple) {
      onChange([id]);
      setOpen(false);
      return;
    }

    onChange(value.includes(id) ? value.filter((candidate) => candidate !== id) : [...value, id]);
  };

  /** Manual ordering matters: `project.gallery` renders in the order stored. */
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  if (!targetType) {
    return (
      <p className="bg-admin-warn-bg text-admin-warn rounded-admin px-3 py-2 text-xs">
        This field points at a metaobject definition that is not visible to the panel, so it cannot
        be edited here.
      </p>
    );
  }

  return (
    <div>
      <ul className="mb-2 flex flex-col gap-1">
        {value.map((id, index) => {
          const item = describe(id);

          return (
            <li
              key={`${id}-${index}`}
              className="border-admin-border rounded-admin flex items-center gap-2 border px-2 py-1.5"
            >
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="size-7 shrink-0 rounded object-cover"
                />
              ) : null}

              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {multiple && !disabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="text-admin-muted hover:text-admin-fg px-1 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label="Move down"
                    className="text-admin-muted hover:text-admin-fg px-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </>
              ) : null}

              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                  aria-label={`Remove ${item.label}`}
                  className="text-admin-danger px-1"
                >
                  ×
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!disabled ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-admin-border rounded-admin hover:bg-admin-raised border px-2.5 py-1.5"
        >
          {multiple ? "Add" : value.length ? "Replace" : "Choose"}…
        </button>
      ) : null}

      <PickerDialog open={open} onClose={() => setOpen(false)} title={`Choose ${label}`}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search entries"
          className="border-admin-border bg-admin-panel rounded-admin mb-3 w-full border px-2.5 py-1.5 outline-none"
        />

        {error ? (
          <p className="bg-admin-danger-bg text-admin-danger rounded-admin px-3 py-2 text-xs">
            {error.message}
          </p>
        ) : null}

        {isLoading ? <p className="text-admin-muted text-xs">Loading…</p> : null}

        <ul className="flex flex-col gap-1">
          {options.map((entry) => {
            const chosen = value.includes(entry.id);

            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => toggle(entry.id, entry)}
                  aria-pressed={chosen}
                  className={`rounded-admin flex w-full items-center gap-2 px-2 py-1.5 text-left ${
                    chosen ? "bg-admin-accent text-admin-accent-fg" : "hover:bg-admin-raised"
                  }`}
                >
                  {entry.thumbnail ? (
                    <Image
                      src={entry.thumbnail}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="size-7 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {chosen ? <span aria-hidden="true">✓</span> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {data && options.length === 0 && !isLoading ? (
          <p className="text-admin-muted text-xs">Nothing to choose from yet.</p>
        ) : null}
      </PickerDialog>
    </div>
  );
}
