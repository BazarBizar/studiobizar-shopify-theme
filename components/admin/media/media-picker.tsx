"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, FileIcon, Loader2Icon, PlayIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { createEntryRequest, useFiles, useMetaobjectOptions, type PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

import { acceptFor, UploadButton, useFileUpload } from "./upload";

/**
 * THE media picker — every place in the panel that chooses an image, a video or a
 * captioned photo opens this, and nothing else (see docs/admin/ui-standard.md).
 *
 * ONE source: Shopify Files — every photo in the store, paged and searched on the
 * server. That holds for fields that store a CAPTIONED IMAGE too (`entryType`:
 * the project gallery, "photos in a room"): the grid is the same, and on Select /
 * Add each chosen photo is turned into its captioned image — the one that already
 * exists for that file, or a new one created for it. Showing only the photos that
 * already had a caption made those pickers look like a different, smaller library.
 *
 * Two modes, one behaviour:
 *  - single: click selects, **Select** confirms, double-click does both;
 *  - multiple: click toggles, **Add N** confirms. Items already in use are marked
 *    and cannot be added twice.
 * An upload confirms at once in single mode and joins the selection in multiple.
 *
 * The panel keeps no media library of its own; uploads go through the panel's API,
 * never straight to Shopify — see `lib/admin/media.ts`.
 */

export type MediaPick = {
  id: string;
  label: string;
  thumbnail: string | null;
  /** The Shopify file, when the source is Files. Null for a captioned image. */
  file: PickerFile | null;
};

/** Metaobject types that are a photo with words around it, and the field holding the file. */
export const MEDIA_ENTRY_TYPES: Record<string, { fileField: string }> = {
  captioned_image: { fileField: "image" },
};

const fromFile = (file: PickerFile): MediaPick => ({
  id: file.id,
  label: file.alt?.trim() || file.filename || (file.kind === "Video" ? "Video" : "Image"),
  thumbnail: file.thumbnail,
  file,
});

function Tile({
  item,
  selected,
  inUse,
  processing,
  isVideo,
  onClick,
  onDoubleClick,
}: {
  item: MediaPick;
  selected: boolean;
  inUse: boolean;
  processing: string | null;
  isVideo: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-pressed={selected}
      disabled={inUse}
      title={inUse ? "Already added" : item.label}
      className={cn(
        "relative overflow-hidden rounded-md border text-left transition-colors",
        selected ? "border-primary ring-primary ring-2" : "hover:border-foreground/20",
        inUse && "cursor-default opacity-60",
      )}
    >
      <span className="bg-muted flex aspect-square items-center justify-center">
        {item.thumbnail ? (
          <Image src={item.thumbnail} alt="" width={160} height={160} unoptimized className="size-full object-cover" />
        ) : isVideo ? (
          <PlayIcon className="text-muted-foreground size-5" />
        ) : (
          <FileIcon className="text-muted-foreground size-5" />
        )}
      </span>

      {selected || inUse ? (
        <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full">
          <CheckIcon className="size-3" />
        </span>
      ) : null}

      {/* Shopify may still be transcoding; saying so beats an empty square. */}
      {processing ? (
        <span className="bg-background/80 text-muted-foreground absolute bottom-6 left-1 rounded px-1 text-[10px]">
          {processing}
        </span>
      ) : null}

      <span className="text-muted-foreground block truncate px-1.5 py-1 text-[11px]">
        {inUse ? "Already added" : item.label}
      </span>
    </button>
  );
}

/** Shopify Files: paged on the server, searched on the server. */
function useFileSource(kind: "image" | "video" | "any", search: string, enabled: boolean) {
  const query = useFiles({ kind, search, enabled });
  const items = React.useMemo(() => query.data?.pages.flatMap((page) => page.files).map(fromFile) ?? [], [query.data]);
  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}


export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  title = "image",
  kind = "image",
  entryType,
  multiple = false,
  selectedIds = [],
  limit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What was chosen — one item in single mode. */
  onSelect: (picks: MediaPick[]) => void;
  /** What is being chosen, lower case: "portrait photo", "gallery photos". */
  title?: string;
  kind?: "image" | "video" | "any";
  /** Pick captioned images of this metaobject type instead of Shopify files. */
  entryType?: string;
  multiple?: boolean;
  /** Already chosen on the field: marked selected (single) or in use (multiple). */
  selectedIds?: string[];
  /** How many more may be added (multiple) — a section's room left. */
  limit?: number;
}) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [chosen, setChosen] = React.useState<MediaPick[]>([]);
  const [working, setWorking] = React.useState(false);
  const queryClient = useQueryClient();

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // State, not a ref: the observer effect must re-run when the sentinel mounts.
  const [sentinel, setSentinel] = React.useState<HTMLDivElement | null>(null);

  // A fresh selection each time the dialog opens.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChosen([]);
  }

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const source = useFileSource(entryType ? "image" : kind, debounced, open);
  const { hasMore, loadingMore, loadMore } = source;

  // For a captioned-image field: which entry wraps which file, both ways.
  const entries = useMetaobjectOptions({ type: entryType ?? null, enabled: open && Boolean(entryType) });
  const { entryByFile, fileByEntry } = React.useMemo(() => {
    const byFile = new Map<string, { id: string; label: string }>();
    const byEntry = new Map<string, string>();
    for (const entry of entries.data?.entries ?? []) {
      if (!entry.fileId) continue;
      byEntry.set(entry.id, entry.fileId);
      if (!byFile.has(entry.fileId)) byFile.set(entry.fileId, { id: entry.id, label: entry.label });
    }
    return { entryByFile: byFile, fileByEntry: byEntry };
  }, [entries.data]);

  /** What the field already holds, as FILE ids — the grid's own ids. */
  const selectedFiles = entryType
    ? selectedIds.flatMap((id) => {
        const file = fileByEntry.get(id);
        return file ? [file] : [];
      })
    : selectedIds;

  // Infinite scroll; re-armed after every page so a short first page still loads the next.
  React.useEffect(() => {
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed[0]?.isIntersecting) loadMore();
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasMore, loadingMore, loadMore]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debounced]);

  const confirm = async (picks: MediaPick[]) => {
    if (picks.length === 0) return;
    if (!entryType) {
      onSelect(picks);
      onOpenChange(false);
      return;
    }

    // Each photo → its captioned image: reuse the one that exists, or create it.
    setWorking(true);
    try {
      const field = MEDIA_ENTRY_TYPES[entryType]?.fileField ?? "image";
      const resolved: MediaPick[] = [];
      for (const pick of picks) {
        const existing = entryByFile.get(pick.id);
        if (existing) {
          resolved.push({ id: existing.id, label: existing.label, thumbnail: pick.thumbnail, file: null });
        } else {
          const created = await createEntryRequest({ type: entryType, fields: [{ key: field, value: pick.id }] });
          resolved.push({ id: created.id, label: pick.label, thumbnail: pick.thumbnail, file: null });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "metaobjects", entryType] });
      onSelect(resolved);
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not add the photos", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    } finally {
      setWorking(false);
    }
  };

  const toggle = (item: MediaPick) => {
    if (!multiple) {
      setChosen([item]);
      return;
    }
    setChosen((current) =>
      current.some((pick) => pick.id === item.id)
        ? current.filter((pick) => pick.id !== item.id)
        : limit !== undefined && current.length >= limit
          ? current
          : [...current, item],
    );
  };

  const { uploading, upload } = useFileUpload(async (file) => {
    const pick = fromFile(file);
    await queryClient.invalidateQueries({ queryKey: ["admin", "files"] });
    if (multiple) setChosen((current) => [...current, pick]);
    else await confirm([pick]);
  });

  const inUse = new Set(multiple ? selectedFiles : []);
  const isSelected = (id: string) =>
    chosen.some((pick) => pick.id === id) || (!multiple && chosen.length === 0 && selectedFiles.includes(id));
  // A photo that already has a caption is shown by it — the words the site prints.
  const labelled = (item: MediaPick): MediaPick => {
    const entry = entryType ? entryByFile.get(item.id) : undefined;
    return entry?.label ? { ...item, label: entry.label } : item;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose {title}</DialogTitle>
          <DialogDescription>
            Choose an existing file from Shopify, or upload a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="h-8 ps-8"
            />
          </div>
          <UploadButton accept={acceptFor(entryType ? "image" : kind)} uploading={uploading} onFile={(file) => void upload(file)} />
        </div>

        {source.error ? (
          <ErrorState error={source.error.message} onRetry={() => void source.refetch()} title="Could not load the files" />
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {source.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Array.from({ length: 15 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : source.items.length === 0 && !source.error ? (
            <EmptyState
              title={debounced ? "Nothing matches that search" : "Nothing here yet"}
              description={debounced ? "Try another word, or upload the file." : "Upload the first one with the Upload button."}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {source.items.map((item) => (
                <Tile
                  key={item.id}
                  item={labelled(item)}
                  selected={isSelected(item.id)}
                  inUse={inUse.has(item.id)}
                  isVideo={item.file?.kind === "Video"}
                  processing={item.file?.status && item.file.status !== "READY" ? item.file.status.toLowerCase() : null}
                  onClick={() => toggle(item)}
                  onDoubleClick={() => (multiple || working ? undefined : void confirm([item]))}
                />
              ))}
            </div>
          )}

          <div ref={setSentinel} className="h-px" />

          {loadingMore ? (
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
              <Loader2Icon className="size-3.5 animate-spin" />
              Loading more…
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {multiple
              ? chosen.length
                ? `${chosen.length} selected${limit !== undefined && chosen.length >= limit ? " — that is all the room there is" : ""}`
                : "Click to select one or more."
              : chosen.length
                ? `Selected: ${chosen[0]!.label}`
                : "Click to select. Double-click to choose at once."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={working} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={chosen.length === 0 || uploading || working} onClick={() => void confirm(chosen)}>
              {working ? <Loader2Icon className="animate-spin" /> : null}
              {working ? "Adding…" : multiple ? (chosen.length > 1 ? `Add ${chosen.length}` : "Add") : "Select"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
