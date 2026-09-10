"use client";

import { CheckIcon, FileIcon, ImageIcon, Loader2Icon, PlayIcon, SearchIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

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
import { uploadFileRequest, useFiles, type PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * Choose an existing Shopify file, or upload a new one.
 *
 * The panel keeps no media library of its own — a second source of truth for images is
 * a second thing to keep in sync. Uploads go through the panel's own API, never
 * straight to Shopify; see `lib/admin/media.ts`.
 */

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,application/pdf";
export const VIDEO_ACCEPT = "video/mp4,video/quicktime";

function Tile({
  file,
  selected,
  onSelect,
}: {
  file: PickerFile;
  selected: boolean;
  onSelect: () => void;
}) {
  const isVideo = file.kind === "Video";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative overflow-hidden rounded-md border text-left transition-colors",
        selected ? "border-primary ring-primary ring-2" : "hover:border-foreground/20",
      )}
    >
      <span className="bg-muted flex aspect-square items-center justify-center">
        {file.thumbnail ? (
          <Image
            src={file.thumbnail}
            alt={file.alt ?? ""}
            width={160}
            height={160}
            unoptimized
            className="size-full object-cover"
          />
        ) : isVideo ? (
          <PlayIcon className="text-muted-foreground size-5" />
        ) : (
          <FileIcon className="text-muted-foreground size-5" />
        )}
      </span>

      {selected ? (
        <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full">
          <CheckIcon className="size-3" />
        </span>
      ) : null}

      {/* Shopify may still be transcoding; saying so beats an empty square. */}
      {file.status && file.status !== "READY" ? (
        <span className="bg-background/80 text-muted-foreground absolute bottom-6 left-1 rounded px-1 text-[10px]">
          {file.status.toLowerCase()}
        </span>
      ) : null}

      <span className="text-muted-foreground block truncate px-1.5 py-1 text-[11px]">
        {file.alt || file.kind}
      </span>
    </button>
  );
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  kind = "image",
  title = "media",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: PickerFile) => void;
  selectedId?: string | null;
  kind?: "image" | "video" | "any";
  title?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  /**
   * The sentinel is STATE, not a plain ref. The observer effect has to re-run when the
   * sentinel mounts, and assigning a ref does not trigger a render — so with a ref the
   * observer would attach to nothing on first paint.
   */
  const [sentinel, setSentinel] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFiles({ kind, search: debounced, enabled: open });

  const files = React.useMemo(() => data?.pages.flatMap((page) => page.files) ?? [], [data]);

  /**
   * Infinite scroll rather than a button. The effect depends on the fetch state too, so
   * it runs again after each page settles: a first page that does not fill the viewport
   * would otherwise leave the sentinel visible but unobserved, and the list would stop
   * one page in.
   */
  React.useEffect(() => {
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // A new search is a different list; the old scroll offset means nothing in it.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debounced]);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { file: created, processing } = await uploadFileRequest(file);

      toast.success("Uploaded", {
        description: processing
          ? "Added to Shopify Files — the preview appears once processing finishes."
          : "Added to Shopify Files.",
      });

      onSelect(created);
      onOpenChange(false);
    } catch (caught) {
      toast.error("Upload failed", {
        description: caught instanceof Error ? caught.message : "Shopify did not accept the file.",
      });
    } finally {
      setUploading(false);
    }
  }

  const accept = kind === "video" ? VIDEO_ACCEPT : kind === "image" ? IMAGE_ACCEPT : undefined;

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

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={onUpload}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-3.5" />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>

        {error ? (
          <ErrorState error={error.message} onRetry={() => refetch()} title="Could not load files" />
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Array.from({ length: 15 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {files.map((file) => (
                <Tile
                  key={file.id}
                  file={file}
                  selected={file.id === selectedId}
                  onSelect={() => {
                    onSelect(file);
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          )}

          {!isLoading && files.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No files match that search.
            </p>
          ) : null}

          <div ref={setSentinel} className="h-px" />

          {isFetchingNextPage ? (
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
              <Loader2Icon className="size-3.5 animate-spin" />
              Loading more…
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ImageIcon };
