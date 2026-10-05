"use client";

import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import type { PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

import { FallbackIcon, formatBytes, formatDuration, formatOf, kindLabel, sized } from "./media-utils";

/**
 * The media library's detail popup: one file large, its details beside it, and the rest
 * of THE CURRENT PAGE a swipe, a click or an arrow key away.
 *
 * Read-only on purpose. Alt text is edited in the list and the medium grid, where the
 * keyboard can walk down fifty files; a second editor here would be a second copy of
 * the same state to keep in step. What the popup shows is the saved value, including an
 * edit made a moment ago in the list — see `altOverrides`.
 *
 * SMOOTH SLIDING comes from the image being there BEFORE the slide moves in:
 *  - every slide within two of the current one is rendered, so the next image has
 *    been downloading since the previous swipe;
 *  - a slide once rendered STAYS rendered, so sliding back never re-mounts and
 *    re-decodes an image that was already on screen;
 *  - an image fades in when it has decoded, instead of popping in half-painted;
 *  - `Slide` is memoised, so changing the selection re-renders only the slides whose
 *    props changed, not all fifty, while Embla is animating.
 * Slides further away stay empty: fifty full-size images mounted at once, most of them
 * never looked at, is the page weight the list thumbnails were resized to avoid.
 */

/** How far either side of the current slide is rendered ahead of time. */
const PRELOAD = 2;

function around(index: number, count: number): Set<number> {
  const set = new Set<number>();
  for (let i = Math.max(0, index - PRELOAD); i <= Math.min(count - 1, index + PRELOAD); i++) {
    set.add(i);
  }
  return set;
}

/** `index` value meaning "the last file" — for arriving from the page after. */
export const VIEWER_LAST = -1;

/**
 * ACROSS PAGES. The carousel holds one page of fifty, but the ends are not walls: when
 * there is a page beyond, an extra slide sits past the last file (and before the first).
 * Reaching it — by swipe, button or arrow key alike — asks the library for that page,
 * and the viewer re-opens on its first file (or, going back, its last). One mechanism
 * for all three inputs, instead of a button that pages and a swipe that cannot.
 */
export function MediaViewer({
  files,
  index,
  onClose,
  altOverrides,
  page,
  pageKey,
  hasPrevPage,
  hasNextPage,
  onPrevPage,
  onNextPage,
}: {
  files: PickerFile[];
  /** The file to open on, `VIEWER_LAST` for the last one, or null when closed. */
  index: number | null;
  onClose: () => void;
  /** Alt text saved since the page loaded, by file id — the list's copy is not refetched. */
  altOverrides: Record<string, string>;
  /** Zero-based page number, for the counter. */
  page: number;
  /** Changes whenever `files` is a different page — remounts the carousel on it. */
  pageKey: string;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  /** Resolve false when the page could not be shown, so the viewer can step back. */
  onPrevPage: () => Promise<boolean>;
  onNextPage: () => Promise<boolean>;
}) {
  const start = index === VIEWER_LAST ? files.length - 1 : index;
  const open = start !== null && start >= 0 && start < files.length;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      {/* Nearly the whole viewport: the point of opening a file is to see it large. */}
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
        {/* Keyed by page, so arriving on another page starts a fresh carousel on it. */}
        {open ? (
          <ViewerBody
            key={pageKey}
            files={files}
            startFile={start}
            altOverrides={altOverrides}
            page={page}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type SlideItem =
  | { kind: "file"; file: PickerFile; fileIndex: number }
  | { kind: "prev" }
  | { kind: "next" };

function ViewerBody({
  files,
  startFile,
  altOverrides,
  page,
  hasPrevPage,
  hasNextPage,
  onPrevPage,
  onNextPage,
}: {
  files: PickerFile[];
  startFile: number;
  altOverrides: Record<string, string>;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPrevPage: () => Promise<boolean>;
  onNextPage: () => Promise<boolean>;
}) {
  const slides = React.useMemo<SlideItem[]>(
    () => [
      ...(hasPrevPage ? [{ kind: "prev" } as const] : []),
      ...files.map((file, fileIndex) => ({ kind: "file" as const, file, fileIndex })),
      ...(hasNextPage ? [{ kind: "next" } as const] : []),
    ],
    [files, hasPrevPage, hasNextPage],
  );

  const startIndex = startFile + (hasPrevPage ? 1 : 0);

  // A slightly longer glide than Embla's default 25, which reads as a jump at this size.
  const [emblaRef, embla] = useEmblaCarousel({ startIndex, loop: false, duration: 32 });
  const [selected, setSelected] = React.useState(startIndex);
  const [rendered, setRendered] = React.useState(() => around(startIndex, slides.length));

  /** One page request at a time — a fast double swipe must not skip a page. */
  const paging = React.useRef(false);

  React.useEffect(() => {
    if (!embla) return;

    const onSelect = () => {
      const position = embla.selectedScrollSnap();
      setSelected(position);
      setRendered((current) => {
        const wanted = around(position, slides.length);
        if ([...wanted].every((i) => current.has(i))) return current;
        return new Set([...current, ...wanted]);
      });

      const slide = slides[position];
      if (!slide || slide.kind === "file" || paging.current) return;

      paging.current = true;
      const forward = slide.kind === "next";
      // The nearest real file, to step back to if the page cannot be shown.
      const fallback = forward ? position - 1 : position + 1;

      void (forward ? onNextPage() : onPrevPage()).then((ok) => {
        // On success this component is replaced by one keyed to the new page.
        if (ok) return;
        paging.current = false;
        toast.error(`Could not load the ${forward ? "next" : "previous"} page`);
        embla.scrollTo(fallback, true);
      });
    };

    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, slides, onNextPage, onPrevPage]);

  // On a paging slide, the details stay on the file beside it.
  const current = slides[selected];
  const fileIndex =
    current?.kind === "file" ? current.fileIndex : current?.kind === "next" ? files.length - 1 : 0;
  const file = files[fileIndex] ?? files[0]!;
  const alt = altOverrides[file.id] ?? file.alt ?? "";

  /**
   * Buttons and arrow keys JUMP — the new file replaces the old one at once. Only a
   * swipe or drag slides, because there the movement follows the hand; after a click
   * it is just a delay between asking for the next file and seeing it.
   */
  const previous = () => embla?.scrollPrev(true);
  const next = () => embla?.scrollNext(true);

  function onKeyDown(event: React.KeyboardEvent) {
    // A focused video uses the arrows to seek; leave them to it.
    if (event.target instanceof HTMLVideoElement) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  }

  const pageNumber = page + 1;
  const atFirstFile = current?.kind === "file" && current.fileIndex === 0;
  const atLastFile = current?.kind === "file" && current.fileIndex === files.length - 1;

  return (
    <div
      className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-1"
      onKeyDown={onKeyDown}
    >
      <DialogTitle className="sr-only">{file.filename ?? kindLabel(file.kind)}</DialogTitle>
      <DialogDescription className="sr-only">
        File {fileIndex + 1} of {files.length} on page {pageNumber}. Use the arrow keys to move
        between files; past the last one, the next page opens.
      </DialogDescription>

      <div className="bg-muted relative min-h-0 min-w-0">
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full touch-pan-y will-change-transform">
            {slides.map((slide, position) => (
              <div
                key={slide.kind === "file" ? slide.file.id : slide.kind}
                className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-4 [backface-visibility:hidden] md:p-8"
                role="group"
                aria-roledescription="slide"
                aria-label={
                  slide.kind === "file"
                    ? `${slide.fileIndex + 1} of ${files.length}`
                    : `Page ${slide.kind === "next" ? pageNumber + 1 : pageNumber - 1}`
                }
              >
                {slide.kind !== "file" ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
                    <Loader2Icon className="size-6 animate-spin" />
                    Loading page {slide.kind === "next" ? pageNumber + 1 : pageNumber - 1}…
                  </div>
                ) : rendered.has(position) ? (
                  <Slide
                    file={slide.file}
                    active={position === selected}
                    alt={altOverrides[slide.file.id] ?? slide.file.alt ?? ""}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full shadow transition-none active:not-aria-[haspopup]:translate-y-[-50%]"
          aria-label={atFirstFile ? "Previous page" : "Previous file"}
          onClick={previous}
          disabled={selected === 0}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full shadow transition-none active:not-aria-[haspopup]:translate-y-[-50%]"
          aria-label={atLastFile ? "Next page" : "Next file"}
          onClick={next}
          disabled={selected === slides.length - 1}
        >
          <ChevronRightIcon />
        </Button>

        <span className="bg-background/85 absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap tabular-nums">
          {fileIndex + 1} / {files.length} · Page {pageNumber}
        </span>
      </div>

      <Details file={file} alt={alt} />
    </div>
  );
}

const Slide = React.memo(function Slide({
  file,
  active,
  alt,
}: {
  file: PickerFile;
  active: boolean;
  alt: string;
}) {
  const ready = file.status === "READY";
  const [loaded, setLoaded] = React.useState(false);

  // Only the visible video is a <video>: a neighbour kept as a player would keep
  // playing, or buffering, while it is off screen.
  if (file.kind === "Video" && ready && file.url && active) {
    return (
      <video
        key={file.id}
        src={file.url}
        poster={file.thumbnail ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="max-h-full max-w-full rounded-md"
      />
    );
  }

  if (file.thumbnail && ready) {
    return (
      <Image
        // Wide enough for a large screen at 2x without asking the CDN for the original.
        src={sized(file.thumbnail, 2400)}
        alt={alt}
        width={file.width ?? 1600}
        height={file.height ?? 1600}
        unoptimized
        draggable={false}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-auto max-h-full w-auto max-w-full rounded-md object-contain transition-opacity duration-300 select-none",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    );
  }

  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
      <FallbackIcon kind={file.kind} className="size-10" />
      {ready ? "No preview for this file" : "Still processing — no preview yet"}
    </div>
  );
});

function Details({ file, alt }: { file: PickerFile; alt: string }) {
  const format = formatOf(file);

  const rows: [string, string | null][] = [
    ["Type", kindLabel(file.kind)],
    ["Format", format],
    ["Size", file.size != null ? formatBytes(file.size) : null],
    ["Resolution", file.width && file.height ? `${file.width} × ${file.height} px` : null],
    ["Duration", file.duration != null ? formatDuration(file.duration) : null],
    [
      "Uploaded",
      file.createdAt
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(file.createdAt),
          )
        : null,
    ],
  ];

  async function copyUrl() {
    if (!file.url) return;
    try {
      await navigator.clipboard.writeText(file.url);
      toast.success("URL copied");
    } catch {
      toast.error("Could not copy", { description: "The browser refused clipboard access." });
    }
  }

  return (
    <aside className="flex max-h-[38dvh] min-w-0 flex-col gap-4 overflow-y-auto border-t p-4 md:max-h-none md:border-t-0 md:border-l md:p-5">
      {/* Right padding keeps a long name clear of the dialog's close button. */}
      <div className="space-y-1.5 pr-8">
        <p className="text-sm font-medium break-all">{file.filename ?? kindLabel(file.kind)}</p>
        <div className="flex flex-wrap gap-1">
          {format ? <Badge variant="secondary">{format}</Badge> : null}
          {file.status && file.status !== "READY" ? (
            <Badge variant="outline">{file.status.toLowerCase()}</Badge>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
        {rows
          .filter((row): row is [string, string] => Boolean(row[1]))
          .map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </React.Fragment>
          ))}
      </dl>

      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">Alt text</p>
        <p className={cn("text-sm", !alt && "text-muted-foreground italic")}>
          {alt || "No alt text"}
        </p>
        <p className="text-muted-foreground text-[11px]">
          Edited in the list or the medium grid.
        </p>
      </div>

      {file.url ? (
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              Open original
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyUrl()}>
            <CopyIcon />
            Copy URL
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
