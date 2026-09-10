"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { useResolvedFiles, type PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

import { MediaPicker } from "./media-picker";

/**
 * A `file_reference` field.
 *
 * The STORED VALUE is still a Shopify gid — the string the field has always held — but
 * it is shown as its media and chosen from a picker instead of typed.
 *
 * The raw gid stays visible and editable underneath, on purpose: an id can then still
 * be pasted straight in, which is how you recover from a picker that cannot find
 * something and how you move a value between fields.
 */

function Preview({
  file,
  loading,
  invalid,
  className,
}: {
  file: PickerFile | undefined;
  loading: boolean;
  invalid: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
        invalid && "border-destructive",
        className,
      )}
    >
      {loading ? (
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
      ) : file?.thumbnail ? (
        <Image
          src={file.thumbnail}
          alt={file.alt ?? ""}
          width={96}
          height={96}
          unoptimized
          className="size-full object-cover"
        />
      ) : file?.kind === "Video" ? (
        <PlayIcon className="text-muted-foreground size-5" />
      ) : file ? (
        <FileIcon className="text-muted-foreground size-5" />
      ) : (
        <ImageIcon className="text-muted-foreground size-5" />
      )}
    </span>
  );
}

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
  // A gid that resolves to nothing is a real problem worth showing — a deleted file, or
  // a pasted id from another store.
  const invalid = Boolean(value) && !isLoading && !file;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Preview file={file} loading={isLoading && Boolean(value)} invalid={invalid} />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              {value ? "Replace" : "Choose"}
            </Button>

            {value && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onChange("")}
              >
                <XIcon className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>

          {/* The gid stays editable so an id can be pasted directly. */}
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            disabled={disabled}
            placeholder="gid://shopify/MediaImage/…"
            aria-label={`${label} file id`}
            aria-invalid={invalid}
            className="h-7 font-mono text-xs"
          />

          {invalid ? (
            <p className="text-destructive text-xs" role="alert">
              No file with that id. It may have been deleted in Shopify.
            </p>
          ) : null}
        </div>
      </div>

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        title={label.toLowerCase()}
        selectedId={value || null}
        onSelect={(picked) => onChange(picked.id)}
      />
    </div>
  );
}

/**
 * A `list.file_reference` field: several files, in an order that matters.
 *
 * Reordering is by button rather than drag here. The list lives inside a form that is
 * already inside a dialog in some screens, and a nested drag context in that position
 * fights the dialog's own pointer handling — arrows are unambiguous and keyboard
 * accessible for free.
 */
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
  const byId = React.useMemo(
    () => new Map((data?.files ?? []).map((file) => [file.id, file])),
    [data],
  );

  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((gid, index) => {
            const file = byId.get(gid);
            const invalid = !isLoading && !file;

            return (
              <li key={`${gid}-${index}`} className="flex items-start gap-3 rounded-md border p-2">
                <Preview
                  file={file}
                  loading={isLoading}
                  invalid={invalid}
                  className="size-16"
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={gid}
                    onChange={(event) => {
                      const next = [...value];
                      next[index] = event.target.value.trim();
                      onChange(next);
                    }}
                    disabled={disabled}
                    aria-label={`${label} ${index + 1} file id`}
                    aria-invalid={invalid}
                    className="h-7 font-mono text-xs"
                  />
                  {invalid ? (
                    <p className="text-destructive text-xs" role="alert">
                      No file with that id.
                    </p>
                  ) : null}
                </div>

                {!disabled ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Move ${label} ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Move ${label} ${index + 1} down`}
                      disabled={index === value.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-7"
                      aria-label={`Remove ${label} ${index + 1}`}
                      onClick={() => onChange(value.filter((_, position) => position !== index))}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add
        </Button>
      ) : null}

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        title={label.toLowerCase()}
        onSelect={(picked) => onChange([...value, picked.id])}
      />
    </div>
  );
}
