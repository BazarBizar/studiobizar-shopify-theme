"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  Grid3x3Icon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
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
  type FileKind,
  type FileSort,
  type PickerFile,
} from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

import { describe, FallbackIcon, formatBytes, formatOf, pixels, sized } from "./media-utils";
import { MediaViewer, VIEWER_LAST } from "./media-viewer";

/**
 * The media library.
 *
 * It exists for one job the panel could not do at all: CHANGING ALT TEXT ON A
 * FILE THAT ALREADY EXISTS. `setFileAlt` has been in `lib/admin/media.ts` since
 * the picker was written and nothing ever called it — alt text could be supplied
 * at upload and never afterwards, which on five thousand images makes a missing
 * description permanent.
 *
 * LIST BY DEFAULT, GRIDS ON REQUEST. The list is the shape for working through
 * files and writing descriptions: the rows are wide, the input is the widest thing
 * in each, and the keyboard can walk straight down them. The medium grid is for
 * finding a file by looking at it, and still edits alt text through `useAltEditor`.
 * The small grid is for scanning — at ten across there is no room for an input, so
 * it shows the picture, the format and the size, and nothing to edit.
 *
 * PAGED, NOT INFINITE. Fifty files a page with Previous / Next, because an operator
 * working through five thousand images needs to know where they are and get back
 * there. Shopify pages files by cursor and cannot count them, so the indicator says
 * "Page 3 · files 101–150" and never "of N" — and there is no jumping to page 40,
 * only walking to it. Pages already visited are kept, so Previous costs no request.
 *
 * NO DELETE. `fileDelete` is not in the operation allowlist: Shopify removes a
 * file without checking what references it, so deleting one silently empties
 * every product, metaobject and page metafield pointing at it — with nothing to
 * say which ones. A confirmation dialog cannot make that safe.
 */

/**
 * Resolution is the one sort Shopify cannot do — `FileSortKeys` has no key for it —
 * so it orders the rows ALREADY LOADED, and the screen says so beside the toggle.
 */
type LibrarySort = FileSort | "resolution-desc" | "resolution-asc";

const SORT_LABELS: Record<LibrarySort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  largest: "Largest file",
  smallest: "Smallest file",
  name: "Filename A–Z",
  "resolution-desc": "Highest resolution",
  "resolution-asc": "Lowest resolution",
};

const KIND_LABELS: Record<FileKind, string> = {
  any: "All types",
  image: "Images",
  video: "Videos",
  model3d: "3D models",
  file: "Files",
};

type View = "list" | "grid" | "grid-small";

const VIEWS: { value: View; label: string; Icon: typeof ListIcon }[] = [
  { value: "list", label: "List view", Icon: ListIcon },
  { value: "grid", label: "Medium grid", Icon: LayoutGridIcon },
  { value: "grid-small", label: "Small grid", Icon: Grid3x3Icon },
];

const PAGE_SIZE = 50;

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

function Pagination({
  page,
  count,
  hasNext,
  loading,
  onFirst,
  onPrevious,
  onNext,
}: {
  /** Zero-based. */
  page: number;
  /** Rows on this page, from Shopify — before the alt filter narrows them. */
  count: number;
  hasNext: boolean;
  loading: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + count;

  return (
    <nav aria-label="Media pages" className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground text-xs" aria-live="polite">
        Page {formatNumber(page + 1)}
        {count > 0 ? ` · files ${formatNumber(first)}–${formatNumber(last)}` : ""}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="First page"
          onClick={onFirst}
          disabled={page === 0}
        >
          <ChevronsLeftIcon className="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={page === 0}>
          <ChevronLeftIcon className="size-3.5" />
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext || loading}>
          Next
          {loading ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </nav>
  );
}

const GRID_CLASS: Record<Exclude<View, "list">, string> = {
  grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
  "grid-small": "grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10",
};

/** A button: every thumbnail opens the viewer on its file. */
function Thumbnail({
  file,
  size,
  className,
  onOpen,
}: {
  file: PickerFile;
  size: number;
  className?: string;
  onOpen: () => void;
}) {
  const processing = file.status !== "READY";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${file.filename ?? "file"}`}
      className={cn(
        "bg-muted focus-visible:ring-ring flex shrink-0 cursor-zoom-in items-center justify-center overflow-hidden transition-opacity outline-none hover:opacity-90 focus-visible:ring-2",
        className,
      )}
    >
      {file.thumbnail && !processing ? (
        <Image
          src={sized(file.thumbnail, size * 2)}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          unoptimized
        />
      ) : (
        <FallbackIcon kind={file.kind} className="size-5" />
      )}
    </button>
  );
}

function useAltEditor(file: PickerFile, onSaved: (id: string, alt: string) => void) {
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
      onSaved(file.id, alt);
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

  return { file, alt, setAlt, stored, dirty, saving, saved, save };
}

type AltEditor = ReturnType<typeof useAltEditor>;

function AltInput({ editor, className }: { editor: AltEditor; className?: string }) {
  const { file, alt, setAlt, stored, saving, saved, save } = editor;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={`alt-${file.id}`} className="sr-only">
        Alt text
      </Label>
      <Input
        id={`alt-${file.id}`}
        value={alt}
        placeholder={file.kind === "MediaImage" ? "Describe this image" : "Describe this file"}
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
  );
}

function StatusBadges({ editor }: { editor: AltEditor }) {
  const { file, stored, dirty } = editor;

  return (
    <>
      {!stored && !dirty && (
        <Badge variant="outline" className="text-[11px] font-normal">
          No alt text
        </Badge>
      )}
      {file.status !== "READY" && (
        <Badge variant="outline" className="text-[11px] font-normal">
          Processing
        </Badge>
      )}
    </>
  );
}

type ItemProps = {
  file: PickerFile;
  onOpen: () => void;
  onSaved: (id: string, alt: string) => void;
};

function Row({ file, onOpen, onSaved }: ItemProps) {
  const editor = useAltEditor(file, onSaved);
  const meta = describe(file);

  return (
    <li className="flex items-center gap-4 border-b p-3 last:border-b-0">
      <Thumbnail file={file} size={56} className="size-14 rounded-md border" onOpen={onOpen} />

      <div className="min-w-0 flex-1">
        <AltInput editor={editor} />

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadges editor={editor} />
          {file.filename && (
            <span className="max-w-full truncate text-[11px]" title={file.filename}>
              {file.filename}
            </span>
          )}
          {meta && <span className="text-muted-foreground text-[11px]">{meta}</span>}
        </div>
      </div>
    </li>
  );
}

function Tile({ file, onOpen, onSaved }: ItemProps) {
  const editor = useAltEditor(file, onSaved);
  const meta = describe(file);

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-md border">
      <div className="relative">
        <Thumbnail
          file={file}
          size={240}
          className="aspect-square w-full border-b"
          onOpen={onOpen}
        />
        {formatOf(file) && (
          <Badge
            variant="secondary"
            className="pointer-events-none absolute top-1.5 left-1.5 text-[10px] font-medium"
          >
            {formatOf(file)}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="truncate text-xs font-medium" title={file.filename ?? undefined}>
          {file.filename ?? file.kind}
        </p>
        {meta && <p className="text-muted-foreground truncate text-[11px]">{meta}</p>}
        <div className="flex flex-wrap gap-1 empty:hidden">
          <StatusBadges editor={editor} />
        </div>
        <AltInput editor={editor} className="mt-auto" />
      </div>
    </li>
  );
}

/**
 * Read-only on purpose — see the note at the top. Everything the medium tile spells
 * out is still here, in the tooltip and for a screen reader, just not on the tile.
 */
function SmallTile({ file, onOpen }: Pick<ItemProps, "file" | "onOpen">) {
  const format = formatOf(file);
  const size = file.size != null ? formatBytes(file.size) : null;
  const details = [file.filename, describe(file), file.alt ? `Alt: ${file.alt}` : "No alt text"]
    .filter(Boolean)
    .join("\n");

  return (
    <li className="min-w-0 overflow-hidden rounded-md border" title={details}>
      <div className="relative">
        <Thumbnail file={file} size={120} className="aspect-square w-full" onOpen={onOpen} />
        {format && (
          <span className="bg-background/85 pointer-events-none absolute top-1 left-1 rounded px-1 text-[9px] leading-4 font-medium">
            {format}
          </span>
        )}
      </div>
      <p className="text-muted-foreground truncate border-t px-1.5 py-1 text-[10px]" aria-hidden>
        {size ?? file.filename ?? file.kind}
      </p>
      <span className="sr-only">{details}</span>
    </li>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-md border p-0.5">
      {VIEWS.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="icon-sm"
          variant={view === value ? "secondary" : "ghost"}
          aria-pressed={view === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}

function LoadingState({ view }: { view: View }) {
  if (view === "grid-small") {
    return (
      <ul className={GRID_CLASS["grid-small"]}>
        {Array.from({ length: 20 }).map((_, index) => (
          <li key={index} className="overflow-hidden rounded-md border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-1.5">
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (view === "grid") {
    return (
      <ul className={GRID_CLASS.grid}>
        {Array.from({ length: 10 }).map((_, index) => (
          <li key={index} className="overflow-hidden rounded-md border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="overflow-hidden rounded-md border">
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
  );
}

export function MediaLibrary() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [kind, setKind] = React.useState<FileKind>("any");
  const [sort, setSort] = React.useState<LibrarySort>("newest");
  const [view, setView] = React.useState<View>("list");
  const [onlyMissing, setOnlyMissing] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  /** Index into `shown` of the file open in the viewer. */
  const [viewing, setViewing] = React.useState<number | null>(null);
  /**
   * Alt text saved since the page loaded. The rows keep their own saved value, but the
   * list itself is not refetched after a save, so the viewer reads this first.
   */
  const [altOverrides, setAltOverrides] = React.useState<Record<string, string>>({});
  const onSaved = React.useCallback(
    (id: string, alt: string) => setAltOverrides((current) => ({ ...current, [id]: alt })),
    [],
  );

  const top = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const localSort = sort === "resolution-desc" || sort === "resolution-asc";
  // Resolution has no server key, so Shopify returns newest first and the rows are
  // reordered below.
  const serverSort: FileSort = localSort ? "newest" : sort;

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFiles({ kind, search: debounced, sort: serverSort, enabled: true });

  /**
   * The page index is stored WITH the query it belongs to, and read as 0 once the
   * query has changed. A new search or filter therefore lands on page 1 without an
   * effect resetting it — which would first render the old index against the new
   * results, then set state in an effect to fix it.
   */
  const queryKey = `${kind}|${debounced}|${serverSort}`;
  const [paging, setPaging] = React.useState({ key: queryKey, index: 0 });
  const loadedPages = data?.pages.length ?? 0;
  const page =
    paging.key === queryKey ? Math.min(paging.index, Math.max(loadedPages - 1, 0)) : 0;

  const files = React.useMemo(() => data?.pages[page]?.files ?? [], [data, page]);
  const hasNext = page < loadedPages - 1 || Boolean(hasNextPage);

  /**
   * `viewer` is the file the viewer should show on the new page — null closes it. The
   * viewer pages through here too, so the list behind it is on the same page when it
   * closes.
   */
  function goTo(index: number, viewer: number | null = null) {
    setPaging({ key: queryKey, index });
    setViewing(viewer);
    // Next sits at the bottom of a long page; the operator wants to start reading the
    // new one from the top, where the toolbar and the page indicator are. Not while
    // the viewer is open — the page behind it is locked and out of sight.
    if (viewer === null) top.current?.scrollIntoView({ block: "start" });
  }

  async function next(viewer: number | null = null): Promise<boolean> {
    if (page + 1 < loadedPages) {
      goTo(page + 1, viewer);
      return true;
    }
    if (!hasNextPage) return false;
    const result = await fetchNextPage();
    if (result.isError) return false;
    goTo(page + 1, viewer);
    return true;
  }

  const shown = React.useMemo(() => {
    const filtered = onlyMissing ? files.filter((file) => !file.alt) : files;
    if (!localSort) return filtered;

    const direction = sort === "resolution-desc" ? -1 : 1;
    // Files without dimensions — PDFs, 3D models, anything still processing — go
    // last in both directions rather than counting as zero pixels.
    return [...filtered].sort((a, b) => {
      const pa = pixels(a);
      const pb = pixels(b);
      if (pa == null) return pb == null ? 0 : 1;
      if (pb == null) return -1;
      return (pa - pb) * direction;
    });
  }, [files, onlyMissing, localSort, sort]);

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
      // Newest first is the default order, so the new file is at the top of page 1.
      goTo(0);
    } catch (caught) {
      toast.error("Upload failed", {
        description: caught instanceof Error ? caught.message : "Shopify did not accept the file.",
      });
    } finally {
      setUploading(false);
    }
  }

  /*
    Said plainly because it would otherwise be a trap. Shopify's file query has no
    alt filter and no resolution sort, so both work on the fifty rows OF THIS PAGE —
    they cannot ask the store for every image that lacks a description, or its largest.
  */
  const localOnly =
    onlyMissing && localSort
      ? "Filters and sorts"
      : onlyMissing
        ? "Filters"
        : localSort
          ? "Sorts"
          : null;

  const pagination =
    !error && !isLoading && (page > 0 || hasNext) ? (
      <Pagination
        page={page}
        count={files.length}
        hasNext={hasNext}
        loading={isFetchingNextPage}
        onFirst={() => goTo(0)}
        onPrevious={() => goTo(page - 1)}
        onNext={() => void next()}
      />
    ) : null;

  return (
    <div ref={top} className="scroll-mt-20 space-y-4">
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

        <Select value={kind} onValueChange={(value) => setKind(value as FileKind)}>
          <SelectTrigger className="w-36" aria-label="Media type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as FileKind[]).map((value) => (
              <SelectItem key={value} value={value}>
                {KIND_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as LibrarySort)}>
          <SelectTrigger className="w-44" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as LibrarySort[]).map((value) => (
              <SelectItem key={value} value={value}>
                {SORT_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ViewToggle view={view} onChange={setView} />

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
        {localOnly && (
          <span className="text-muted-foreground text-xs">
            {localOnly} the {files.length} files on this page only.
          </span>
        )}
      </div>

      {pagination}

      {error ? (
        <div className="rounded-md border p-6">
          <p className="text-sm">Shopify did not answer.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <LoadingState view={view} />
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-6 text-sm">
          {onlyMissing
            ? "Every file on this page has alt text."
            : debounced
              ? "No files match that search."
              : kind === "any"
                ? "Shopify Files is empty."
                : `No ${KIND_LABELS[kind].toLowerCase()} in Shopify Files.`}
        </p>
      ) : view === "grid" ? (
        <ul className={GRID_CLASS.grid}>
          {shown.map((file, index) => (
            <Tile key={file.id} file={file} onOpen={() => setViewing(index)} onSaved={onSaved} />
          ))}
        </ul>
      ) : view === "grid-small" ? (
        <ul className={GRID_CLASS["grid-small"]}>
          {shown.map((file, index) => (
            <SmallTile key={file.id} file={file} onOpen={() => setViewing(index)} />
          ))}
        </ul>
      ) : (
        <ul className="overflow-hidden rounded-md border">
          {shown.map((file, index) => (
            <Row key={file.id} file={file} onOpen={() => setViewing(index)} onSaved={onSaved} />
          ))}
        </ul>
      )}

      {pagination}

      {/* The same order as the grid or list behind it, so Next in the viewer is the
          file to the right of, or below, the one that was clicked. */}
      <MediaViewer
        files={shown}
        index={viewing}
        onClose={() => setViewing(null)}
        altOverrides={altOverrides}
        page={page}
        pageKey={`${queryKey}|${page}|${onlyMissing}|${sort}`}
        hasPrevPage={page > 0}
        hasNextPage={hasNext}
        onPrevPage={async () => {
          if (page === 0) return false;
          goTo(page - 1, VIEWER_LAST);
          return true;
        }}
        onNextPage={() => next(0)}
      />
    </div>
  );
}
