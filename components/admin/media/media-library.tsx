"use client";

import { CheckIcon, ImageIcon, Loader2Icon, SearchIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Switch } from "@/components/admin/ui/switch";
import {
  setFileAltRequest,
  uploadFileRequest,
  useFiles,
  type PickerFile,
} from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * The media library.
 *
 * It exists for one job the panel could not do at all: CHANGING ALT TEXT ON A
 * FILE THAT ALREADY EXISTS. `setFileAlt` has been in `lib/admin/media.ts` since
 * the picker was written and nothing ever called it — alt text could be supplied
 * at upload and never afterwards, which on five thousand images makes a missing
 * description permanent.
 *
 * A LIST, NOT A GRID. A grid of thumbnails is the right shape for picking one
 * image, which is what `MediaPicker` does. This screen is for working through
 * files and writing descriptions, so the rows are wide, the input is the widest
 * thing in each, and the keyboard can walk straight down them.
 *
 * NO DELETE. `fileDelete` is not in the operation allowlist: Shopify removes a
 * file without checking what references it, so deleting one silently empties
 * every product, metaobject and page metafield pointing at it — with nothing to
 * say which ones. A confirmation dialog cannot make that safe.
 */

function Row({ file }: { file: PickerFile }) {
  /**
   * TWO pieces of state, not one plus an effect.
   *
   * `stored` is what Shopify holds; `alt` is what the operator has typed. Syncing
   * the input from the prop in an effect would be the obvious shape and is wrong:
   * it sets state during an effect, which cascades renders, and it also loses the
   * saved value until the next refetch — `file.alt` still carries the OLD text
   * after a successful save, because nothing refetches the list.
   *
   * Tracking the saved value here keeps `dirty` and the "No alt text" badge
   * honest the moment a save lands, with no round trip.
   */
  const [stored, setStored] = React.useState(file.alt ?? "");
  const [alt, setAlt] = React.useState(file.alt ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const dirty = alt !== stored;

  async function save() {
    if (!dirty || saving) return;

    setSaving(true);
    try {
      await setFileAltRequest({ id: file.id, alt });
      setStored(alt);
      setSaved(true);
      // The tick is an acknowledgement, not a state — it should fade rather than
      // sit there implying the row is different from its neighbours.
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
      setAlt(stored);
    } finally {
      setSaving(false);
    }
  }

  const processing = file.status !== "READY";

  return (
    <li className="flex items-center gap-4 border-b p-3 last:border-b-0">
      <span className="bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        {file.thumbnail && !processing ? (
          <Image
            src={file.thumbnail}
            alt=""
            width={56}
            height={56}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <Label htmlFor={`alt-${file.id}`} className="sr-only">
          Alt text
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={`alt-${file.id}`}
            value={alt}
            placeholder="Describe this image"
            onChange={(event) => setAlt(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") setAlt(stored);
            }}
          />

          {saving ? (
            <Loader2Icon className="text-muted-foreground size-4 shrink-0 animate-spin" />
          ) : saved ? (
            <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <span className="size-4 shrink-0" aria-hidden />
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {!stored && !dirty && (
            <Badge variant="outline" className="text-[11px] font-normal">
              No alt text
            </Badge>
          )}
          {processing && (
            <Badge variant="outline" className="text-[11px] font-normal">
              Processing
            </Badge>
          )}
          <span className="text-muted-foreground text-[11px]">
            {file.kind.toLowerCase()}
            {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
          </span>
        </div>
      </div>
    </li>
  );
}

export function MediaLibrary() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [kind, setKind] = React.useState<"any" | "image" | "video">("any");
  const [onlyMissing, setOnlyMissing] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  /** State, not a ref: assigning a ref does not re-run the observer effect. */
  const [sentinel, setSentinel] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFiles({ kind, search: debounced, enabled: true });

  const files = React.useMemo(() => data?.pages.flatMap((page) => page.files) ?? [], [data]);

  const shown = React.useMemo(
    () => (onlyMissing ? files.filter((file) => !file.alt) : files),
    [files, onlyMissing],
  );

  /**
   * The effect depends on the fetch state too, so it runs again after each page
   * settles: a first page that does not fill the viewport would otherwise leave
   * the sentinel visible but unobserved, and the list would stop one page in.
   */
  React.useEffect(() => {
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { processing } = await uploadFileRequest(file);
      toast.success("Uploaded", {
        description: processing
          ? "Added to Shopify Files — the preview appears once processing finishes."
          : "Added to Shopify Files.",
      });
      await refetch();
    } catch (caught) {
      toast.error("Upload failed", {
        description: caught instanceof Error ? caught.message : "Shopify did not accept the file.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by filename"
            className="pl-8"
            aria-label="Search media"
          />
        </div>

        <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
          <SelectTrigger className="w-40" aria-label="Media type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>

        <Button asChild variant="outline" disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            Upload
            <input type="file" className="sr-only" onChange={onUpload} disabled={uploading} />
          </label>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
        <Label htmlFor="only-missing" className="text-sm font-normal">
          Only files without alt text
        </Label>
        {/*
          Said plainly because it would otherwise be a trap. Shopify's file query
          has no alt filter, so this narrows the rows ALREADY LOADED — it cannot
          ask the store for every image that lacks a description.
        */}
        <span className="text-muted-foreground text-xs">
          Filters the {files.length} rows loaded so far — keep scrolling for more.
        </span>
      </div>

      {error ? (
        <div className="rounded-md border p-6">
          <p className="text-sm">Shopify did not answer.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          {isLoading ? (
            <ul>
              {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className="flex items-center gap-4 border-b p-3 last:border-b-0">
                  <Skeleton className="size-14 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              {onlyMissing
                ? "Every file loaded so far has alt text."
                : "No files match that search."}
            </p>
          ) : (
            <ul>
              {shown.map((file) => (
                <Row key={file.id} file={file} />
              ))}
            </ul>
          )}
        </div>
      )}

      <div ref={setSentinel} className={cn("h-px", !hasNextPage && "hidden")} />
      {isFetchingNextPage && (
        <p className="text-muted-foreground text-center text-xs">Loading more…</p>
      )}
    </div>
  );
}
