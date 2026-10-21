"use client";

import * as React from "react";

import { MediaPicker, MEDIA_ENTRY_TYPES } from "@/components/admin/media/media-picker";
import { MediaRows, MediaSlot, moved } from "@/components/admin/media/media-selection";
import { RecordPickerDialog, RecordRows, type RecordItem } from "@/components/admin/record-picker";
import { useMetaobjectOptions } from "@/lib/admin/queries";

/**
 * Picks metaobject entries for a `metaobject_reference` or
 * `list.metaobject_reference` field.
 *
 * A reference to a PHOTO type (`captioned_image` — the project gallery, a product's
 * "photos in a room") is media to the person choosing it, so it gets the media
 * experience: `MediaRows` / `MediaSlot` and the grid `MediaPicker`, with upload.
 * Any other type (designers, projects) is a record: `RecordRows` and the shared
 * record dialog.
 *
 * `targetType` is resolved on the SERVER from the field's `metaobject_definition_id`
 * validation, because that validation carries a definition gid and only the definition
 * list can turn it into a type.
 */

type Props = {
  /** Chosen ids, in order. A single-reference field passes at most one. */
  value: string[];
  current: RecordItem[];
  onChange: (ids: string[]) => void;
  targetType: string | null;
  multiple: boolean;
  disabled?: boolean;
  label: string;
};

export function ReferencePicker({ value, current, onChange, targetType, multiple, disabled, label }: Props) {
  const [open, setOpen] = React.useState(false);
  // Labels for ids chosen in this session; the server only resolved what was stored.
  const [known, setKnown] = React.useState<Record<string, RecordItem>>(() =>
    Object.fromEntries(current.map((item) => [item.id, item])),
  );
  const remember = (items: RecordItem[]) =>
    setKnown((previous) => ({ ...previous, ...Object.fromEntries(items.map((item) => [item.id, item])) }));

  const media = targetType !== null && targetType in MEDIA_ENTRY_TYPES;
  const options = useMetaobjectOptions({ type: targetType, enabled: open && !media });

  if (!targetType) {
    return <p className="text-muted-foreground rounded-md border px-3 py-2 text-sm">This can’t be changed from the admin.</p>;
  }

  const add = (items: RecordItem[]) => {
    remember(items);
    onChange(multiple ? [...value, ...items.map((item) => item.id)] : [items[0]!.id]);
  };

  if (media) {
    const preview = (id: string) => {
      const item = known[id];
      return item ? { thumbnail: item.thumbnail, label: item.label, kind: "image" as const } : null;
    };
    const picker = (
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        entryType={targetType}
        title={label.toLowerCase()}
        multiple={multiple}
        selectedIds={value}
        onSelect={(picks) => add(picks.map((pick) => ({ id: pick.id, label: pick.label, thumbnail: pick.thumbnail })))}
      />
    );

    return multiple ? (
      <>
        <MediaRows
          noun="photos"
          disabled={disabled}
          rows={value.map((id, index) => ({ key: `${id}-${index}`, preview: preview(id), invalid: !known[id] }))}
          onMove={(index, delta) => onChange(moved(value, index, delta))}
          onRemove={(index) => onChange(value.filter((_, at) => at !== index))}
          onAdd={() => setOpen(true)}
        />
        {picker}
      </>
    ) : (
      <>
        <MediaSlot
          preview={value[0] ? preview(value[0]) : null}
          invalid={Boolean(value[0]) && !known[value[0]!]}
          noun="photo"
          disabled={disabled}
          onChoose={() => setOpen(true)}
          onRemove={() => onChange([])}
        />
        {picker}
      </>
    );
  }

  return (
    <>
      <RecordRows
        items={value.map((id) => known[id] ?? null)}
        noun={label.toLowerCase().replace(/s$/, "")}
        multiple={multiple}
        disabled={disabled}
        onMove={(index, delta) => onChange(moved(value, index, delta))}
        onRemove={(index) => onChange(value.filter((_, at) => at !== index))}
        onAdd={() => setOpen(true)}
      />
      <RecordPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={label.toLowerCase()}
        noun={label.toLowerCase()}
        items={(options.data?.entries ?? []).map((entry) => ({ id: entry.id, label: entry.label, thumbnail: entry.thumbnail }))}
        loading={options.isLoading}
        error={options.error?.message ?? null}
        onRetry={() => void options.refetch()}
        multiple={multiple}
        selectedIds={value}
        onConfirm={add}
      />
    </>
  );
}
