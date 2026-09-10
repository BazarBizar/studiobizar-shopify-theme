"use client";

import Image from "next/image";
import { useState } from "react";

import { useFiles, type PickerFile } from "@/lib/admin/queries";

import { PickerDialog } from "./picker-dialog";

/**
 * Picks one Shopify file for a `file_reference` field.
 *
 * Reads from Shopify Files — this panel does not maintain a media library of its
 * own, because a second source of truth for images is a second thing to keep in
 * sync. Uploading new files still happens in Shopify; this chooses among what is
 * there.
 */

type Props = {
  value: string | null;
  /** Current target, resolved server-side, so the field shows something on load. */
  current: { thumbnail: string | null; alt: string | null } | null;
  onChange: (id: string | null) => void;
  /** Narrowed from the field's `file_type_options` validation. */
  kind: "image" | "video" | "any";
  disabled?: boolean;
  label: string;
};

function FileTile({
  file,
  selected,
  onSelect,
}: {
  file: PickerFile;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-admin overflow-hidden border text-left ${
        selected ? "border-admin-accent ring-admin-accent ring-2" : "border-admin-border"
      }`}
    >
      <span className="bg-admin-raised block aspect-square">
        {file.thumbnail ? (
          <Image
            src={file.thumbnail}
            alt={file.alt ?? ""}
            width={160}
            height={160}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <span className="text-admin-faint flex size-full items-center justify-center text-[0.625rem]">
            {file.mimeType ?? file.kind}
          </span>
        )}
      </span>
      <span className="text-admin-muted block truncate px-1.5 py-1 text-[0.6875rem]">
        {file.alt || file.kind}
      </span>
    </button>
  );
}

export function MediaPicker({ value, current, onChange, kind, disabled, label }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(current);

  // Only fetched once the dialog opens: a form with six image fields would
  // otherwise fire six file queries on mount, for pickers nobody opened.
  const { data, isLoading, error } = useFiles({ kind, search, enabled: open });

  const chosen = preview ?? current;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="border-admin-border bg-admin-raised block size-16 shrink-0 overflow-hidden rounded border">
          {chosen?.thumbnail ? (
            <Image
              src={chosen.thumbnail}
              alt={chosen.alt ?? ""}
              width={64}
              height={64}
              unoptimized
              className="size-full object-cover"
            />
          ) : (
            <span className="text-admin-faint flex size-full items-center justify-center text-[0.625rem]">
              none
            </span>
          )}
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="border-admin-border rounded-admin hover:bg-admin-raised border px-2.5 py-1.5 disabled:opacity-50"
          >
            {value ? "Replace" : "Choose"} {kind === "video" ? "video" : "image"}
          </button>

          {value && !disabled ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setPreview(null);
              }}
              className="text-admin-danger rounded-admin hover:bg-admin-danger-bg px-2.5 py-1.5"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <PickerDialog open={open} onClose={() => setOpen(false)} title={`Choose ${label}`}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          className="border-admin-border bg-admin-panel rounded-admin mb-3 w-full border px-2.5 py-1.5 outline-none"
        />

        {error ? (
          <p className="bg-admin-danger-bg text-admin-danger rounded-admin px-3 py-2 text-xs">
            {error.message}
          </p>
        ) : null}

        {isLoading ? <p className="text-admin-muted text-xs">Loading files…</p> : null}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(data?.files ?? []).map((file) => (
            <FileTile
              key={file.id}
              file={file}
              selected={file.id === value}
              onSelect={() => {
                onChange(file.id);
                setPreview({ thumbnail: file.thumbnail, alt: file.alt });
                setOpen(false);
              }}
            />
          ))}
        </div>

        {data && data.files.length === 0 && !isLoading ? (
          <p className="text-admin-muted text-xs">
            No files match. Upload in Shopify → Content → Files, then reopen this picker.
          </p>
        ) : null}

        {data?.hasNextPage ? (
          <p className="text-admin-faint mt-3 text-xs">
            Showing the 60 most recent. Use search to narrow.
          </p>
        ) : null}
      </PickerDialog>
    </div>
  );
}
