"use client";

import { ImageIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { useFiles, type PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * Picks one Shopify file for a `file_reference` field.
 *
 * Reads from Shopify Files — the panel keeps no media library of its own, because a
 * second source of truth for images is a second thing to keep in sync. Uploading still
 * happens in Shopify; this chooses among what is there.
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

function Tile({
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
      className={cn(
        "overflow-hidden rounded-md border text-left transition-colors",
        selected ? "border-primary ring-primary ring-2" : "hover:border-foreground/20",
      )}
    >
      <span className="bg-muted block aspect-square">
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
          <span className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
            {file.mimeType ?? file.kind}
          </span>
        )}
      </span>
      <span className="text-muted-foreground block truncate px-1.5 py-1 text-[11px]">
        {file.alt || file.kind}
      </span>
    </button>
  );
}

export function MediaPicker({ value, current, onChange, kind, disabled, label }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [preview, setPreview] = React.useState(current);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Only fetched once the dialog opens: a form with six image fields would otherwise
  // fire six file queries on mount, for pickers nobody opened.
  const { data, isLoading, error, refetch } = useFiles({
    kind,
    search: debounced,
    enabled: open,
  });

  const chosen = preview ?? current;
  const noun = kind === "video" ? "video" : "image";

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border">
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
            <ImageIcon className="text-muted-foreground size-4" />
          )}
        </span>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
            {value ? "Replace" : "Choose"} {noun}
          </Button>

          {value && !disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                onChange(null);
                setPreview(null);
              }}
            >
              <XIcon className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Files come from Shopify. Upload new ones in Shopify → Content → Files.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="h-8 ps-8"
            />
          </div>

          {error ? (
            <ErrorState error={error.message} onRetry={() => refetch()} title="Could not load files" />
          ) : null}

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(data?.files ?? []).map((file) => (
                  <Tile
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
            )}

            {data && data.files.length === 0 && !isLoading ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No files match that search.
              </p>
            ) : null}
          </div>

          {data?.hasNextPage ? (
            <p className="text-muted-foreground text-xs">
              Showing the 60 most recent. Use search to narrow.
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2Icon className="size-3.5 animate-spin" />
              Loading files…
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
