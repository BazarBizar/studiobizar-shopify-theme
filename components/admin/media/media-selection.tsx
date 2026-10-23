"use client";

import { ArrowDownIcon, ArrowUpIcon, FileIcon, ImageIcon, Loader2Icon, PlayIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * How CHOSEN media looks on a form — the other half of `MediaPicker`. One slot for
 * a single image, rows for a list; the same sizes, buttons and wording in the
 * panel's forms and in the page builder (see docs/admin/ui-standard.md).
 */

export type MediaPreview = {
  thumbnail: string | null;
  label: string;
  /** "video" shows a play glyph, "file" a document, when there is no thumbnail. */
  kind?: "image" | "video" | "file";
};

export function MediaThumb({
  preview,
  loading = false,
  invalid = false,
  className = "size-24",
}: {
  preview: MediaPreview | null;
  loading?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
        invalid && "border-destructive",
        className,
      )}
    >
      {loading ? (
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
      ) : preview?.thumbnail ? (
        <Image src={preview.thumbnail} alt="" width={160} height={160} unoptimized className="size-full object-cover" />
      ) : preview?.kind === "video" ? (
        <PlayIcon className="text-muted-foreground size-5" />
      ) : preview?.kind === "file" ? (
        <FileIcon className="text-muted-foreground size-5" />
      ) : (
        <ImageIcon className="text-muted-foreground size-5" />
      )}
    </span>
  );
}

const MISSING = "This file no longer exists in the media library. Choose another one.";

/** One chosen file: preview, Choose / Change, Remove, its name, and room for an extra input. */
export function MediaSlot({
  preview,
  loading,
  invalid,
  noun = "image",
  disabled,
  onChoose,
  onRemove,
  children,
}: {
  preview: MediaPreview | null;
  loading?: boolean;
  invalid?: boolean;
  noun?: string;
  disabled?: boolean;
  onChoose: () => void;
  onRemove: () => void;
  /** Below the buttons — the image's description, for instance. */
  children?: React.ReactNode;
}) {
  const chosen = preview !== null || Boolean(loading) || Boolean(invalid);

  return (
    <div className="flex items-start gap-3">
      <MediaThumb preview={preview} loading={loading} invalid={invalid} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onChoose}>
            {chosen ? "Change" : `Choose ${noun}`}
          </Button>
          {chosen && !disabled ? (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
              <XIcon className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
        {invalid ? (
          <p className="text-destructive text-xs" role="alert">
            {MISSING}
          </p>
        ) : preview?.label ? (
          <p className="text-muted-foreground truncate text-xs">{preview.label}</p>
        ) : !chosen ? (
          <p className="text-muted-foreground text-xs">No {noun} chosen yet.</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export type MediaRow = {
  key: string;
  preview: MediaPreview | null;
  loading?: boolean;
  invalid?: boolean;
  /** Inputs that belong to this item — a caption, a description. */
  extra?: React.ReactNode;
};

/** Several chosen files, in order: thumbnail, name, extra inputs, move up / down, remove; then Add. */
export function MediaRows({
  rows,
  noun = "images",
  disabled,
  max,
  onMove,
  onRemove,
  onAdd,
}: {
  rows: MediaRow[];
  /** Plural, lower case: "images", "photos". */
  noun?: string;
  disabled?: boolean;
  max?: number;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const full = max !== undefined && rows.length >= max;

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-start gap-3 rounded-md border p-2">
              <MediaThumb preview={row.preview} loading={row.loading} invalid={row.invalid} className="size-14" />
              <div className="min-w-0 flex-1 space-y-1">
                {row.invalid ? (
                  <p className="text-destructive text-xs" role="alert">
                    {MISSING}
                  </p>
                ) : (
                  <p className="truncate pt-0.5 text-sm">{row.preview?.label || `Item ${index + 1}`}</p>
                )}
                {row.extra}
              </div>
              {!disabled ? (
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Move up"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Move down"
                    title="Move down"
                    disabled={index === rows.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-7"
                    aria-label="Remove"
                    title="Remove"
                    onClick={() => onRemove(index)}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No {noun} chosen yet.</p>
      )}

      {!disabled ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={onAdd}>
            <PlusIcon className="size-3.5" />
            Add {noun}
          </Button>
          {max !== undefined ? (
            <span className="text-muted-foreground text-xs">
              {rows.length} of {max}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Moves one item of a list — the arithmetic every ordered media field shares. */
export function moved<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
