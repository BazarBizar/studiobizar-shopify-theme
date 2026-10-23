"use client";

import * as React from "react";

import { useResolvedFiles, type PickerFile } from "@/lib/admin/queries";

import { MediaPicker } from "./media-picker";
import { MediaRows, MediaSlot, moved, type MediaPreview } from "./media-selection";

/**
 * `file_reference` and `list.file_reference` fields on the panel's forms.
 *
 * The STORED VALUE is a Shopify gid, but it is shown as its media and chosen with
 * the shared `MediaPicker`, never typed. The id itself is not shown: to the people
 * who edit content it is noise, and a hand-edited one is how a field ends up
 * pointing at nothing.
 */

export function previewOf(file: PickerFile | undefined): MediaPreview | null {
  if (!file) return null;
  return {
    thumbnail: file.thumbnail,
    label: file.alt?.trim() || file.filename || file.url?.split("/").pop()?.split("?")[0] || "",
    kind: file.kind === "Video" ? "video" : file.kind === "GenericFile" ? "file" : "image",
  };
}

const nounFor = (kind: "image" | "video" | "any", plural = false) =>
  kind === "video" ? (plural ? "videos" : "video") : kind === "any" ? (plural ? "files" : "file") : plural ? "images" : "image";

export function MediaField({
  value,
  onChange,
  kind = "image",
  label,
  disabled,
}: {
  value: string;
  onChange: (gid: string) => void;
  kind?: "image" | "video" | "any";
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ids = React.useMemo(() => (value ? [value] : []), [value]);
  const { data, isLoading } = useResolvedFiles(ids);
  const file = data?.files[0];
  // A gid that resolves to nothing is a real problem worth showing — a deleted file.
  const invalid = Boolean(value) && !isLoading && !file;

  return (
    <>
      <MediaSlot
        preview={previewOf(file)}
        loading={isLoading && Boolean(value)}
        invalid={invalid}
        noun={nounFor(kind)}
        disabled={disabled}
        onChoose={() => setOpen(true)}
        onRemove={() => onChange("")}
      />
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        title={label.toLowerCase()}
        selectedIds={ids}
        onSelect={([pick]) => pick && onChange(pick.id)}
      />
    </>
  );
}

/** Several files, in an order that matters. */
export function MediaListField({
  value,
  onChange,
  kind = "image",
  label,
  disabled,
}: {
  value: string[];
  onChange: (gids: string[]) => void;
  kind?: "image" | "video" | "any";
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  // One request for the whole list, not one per row.
  const { data, isLoading } = useResolvedFiles(value);
  const byId = React.useMemo(() => new Map((data?.files ?? []).map((file) => [file.id, file])), [data]);

  return (
    <>
      <MediaRows
        noun={nounFor(kind, true)}
        disabled={disabled}
        rows={value.map((gid, index) => ({
          key: `${gid}-${index}`,
          preview: previewOf(byId.get(gid)),
          loading: isLoading,
          invalid: !isLoading && !byId.has(gid),
        }))}
        onMove={(index, delta) => onChange(moved(value, index, delta))}
        onRemove={(index) => onChange(value.filter((_, position) => position !== index))}
        onAdd={() => setOpen(true)}
      />
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        title={label.toLowerCase()}
        multiple
        selectedIds={value}
        onSelect={(picks) => onChange([...value, ...picks.map((pick) => pick.id)])}
      />
    </>
  );
}
