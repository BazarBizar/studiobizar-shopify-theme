"use client";

import {
  CropIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
} from "lucide-react";
import * as React from "react";

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
import { croppedImage } from "@/lib/page-builder/image-crop";
import type { ImageCrop, ImageRef } from "@/lib/page-builder/value-types";
import { cdnImage } from "@/lib/shopify/transforms";
import { cn } from "@/lib/utils/cn";

/**
 * CROP ONE PHOTO — the part of it to show, kept on the image itself (`ImageRef.crop`,
 * in the original's pixels) and cut by the Shopify CDN, so it holds wherever the photo
 * is used and the visitor downloads only that part. Drag the frame to move it, a
 * corner to size it; a shape keeps its proportions, portrait or landscape; or type the
 * size in pixels.
 */

/** A rectangle as fractions of the photo, 0–1 — what the frame is dragged in. */
type Rect = { x: number; y: number; w: number; h: number };
type Shape =
  "free" | "original" | "1:1" | "5:4" | "4:3" | "3:2" | "16:9" | "21:9";
type Turn = "portrait" | "landscape";

const SHAPES: { value: Shape; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "original", label: "As uploaded" },
  { value: "1:1", label: "1:1" },
  { value: "5:4", label: "5:4" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
];

const WHOLE: Rect = { x: 0, y: 0, w: 1, h: 1 };
/** The smallest crop, px of the original on its shorter side. */
const MIN_PX = 40;
/** Below this on its shorter side a photo shown large looks soft. */
const SOFT_PX = 800;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A shape's width ÷ height, in pixels — `null` for Free. */
function ratioOf(
  shape: Shape,
  turn: Turn,
  width: number,
  height: number,
): number | null {
  if (shape === "free") return null;
  if (shape === "original") return width / height;
  const [a, b] = shape.split(":").map(Number) as [number, number];
  if (a === b) return 1;
  return turn === "portrait" ? b / a : a / b;
}

/** The label of a shape as it is turned: 4:3 in portrait is 3:4. */
function labelOf(shape: Shape, turn: Turn): string {
  if (shape === "free" || shape === "original" || shape === "1:1")
    return SHAPES.find((s) => s.value === shape)!.label;
  const [a, b] = shape.split(":");
  return turn === "portrait" ? `${b}:${a}` : shape;
}

/** The largest rectangle of this ratio inside the photo, centred where `around` is. */
function fitRatio(
  ratio: number,
  around: Rect,
  width: number,
  height: number,
): Rect {
  let wPx = width;
  let hPx = width / ratio;
  if (hPx > height) {
    hPx = height;
    wPx = height * ratio;
  }
  const w = wPx / width;
  const h = hPx / height;
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return {
    x: clamp(cx - w / 2, 0, 1 - w),
    y: clamp(cy - h / 2, 0, 1 - h),
    w,
    h,
  };
}

const toRect = (
  crop: ImageCrop | undefined,
  width: number,
  height: number,
): Rect =>
  crop
    ? {
        x: crop.x / width,
        y: crop.y / height,
        w: crop.width / width,
        h: crop.height / height,
      }
    : WHOLE;

function toCrop(rect: Rect, width: number, height: number): ImageCrop {
  const x = clamp(Math.round(rect.x * width), 0, width - 1);
  const y = clamp(Math.round(rect.y * height), 0, height - 1);
  return {
    x,
    y,
    width: clamp(Math.round(rect.w * width), 1, width - x),
    height: clamp(Math.round(rect.h * height), 1, height - y),
  };
}

type Drag = {
  mode: "move" | "nw" | "ne" | "sw" | "se";
  startX: number;
  startY: number;
  rect: Rect;
  box: DOMRect;
};

export function ImageCropDialog({
  image,
  open,
  onOpenChange,
  onApply,
}: {
  image: ImageRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined`: the whole photo again. */
  onApply: (crop: ImageCrop | undefined) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] flex-col gap-4 sm:max-w-4xl">
        {/* Mounted afresh on each opening, so it starts from the photo's own crop. */}
        {open ? (
          <CropEditor
            image={image}
            onApply={onApply}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({
  image,
  onApply,
  onClose,
}: {
  image: ImageRef;
  onApply: (crop: ImageCrop | undefined) => void;
  onClose: () => void;
}) {
  // The original's size. A snapshot without one (rare) is measured from the original itself.
  const [measured, setMeasured] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const width = image.width ?? measured?.width ?? 0;
  const height = image.height ?? measured?.height ?? 0;
  const known = width > 0 && height > 0;
  const src =
    image.width && image.height ? cdnImage(image.url, 1600) : image.url;

  const [rect, setRect] = React.useState<Rect>(() =>
    image.width && image.height
      ? toRect(image.crop, image.width, image.height)
      : WHOLE,
  );
  const [shape, setShape] = React.useState<Shape>("free");
  // The way the photo (or its crop) already stands.
  const [turn, setTurn] = React.useState<Turn>(() => {
    const w = image.crop?.width ?? image.width ?? 0;
    const h = image.crop?.height ?? image.height ?? 0;
    return h >= w ? "portrait" : "landscape";
  });
  const drag = React.useRef<Drag | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);

  const ratio = known ? ratioOf(shape, turn, width, height) : null;
  const crop = known ? toCrop(rect, width, height) : null;
  const min = {
    w: known ? MIN_PX / width : 0.05,
    h: known ? MIN_PX / height : 0.05,
  };

  const choose = (next: Shape, nextTurn = turn) => {
    setShape(next);
    setTurn(nextTurn);
    const r = ratioOf(next, nextTurn, width, height);
    if (r) setRect((current) => fitRatio(r, current, width, height));
  };

  /** The frame or one of its corners (`data-handle`) is grabbed. */
  const start = (event: React.PointerEvent<HTMLElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    const mode = (target.dataset.handle as Drag["mode"] | undefined) ?? "move";
    target.setPointerCapture(event.pointerId);
    drag.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      box,
    };
  };

  const move = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.startX) / d.box.width;
    const dy = (event.clientY - d.startY) / d.box.height;
    const r = d.rect;
    if (d.mode === "move") {
      setRect({
        ...r,
        x: clamp(r.x + dx, 0, 1 - r.w),
        y: clamp(r.y + dy, 0, 1 - r.h),
      });
      return;
    }
    // A corner: the opposite one stays put.
    const left = d.mode === "nw" || d.mode === "sw";
    const top = d.mode === "nw" || d.mode === "ne";
    const ax = left ? r.x + r.w : r.x;
    const ay = top ? r.y + r.h : r.y;
    const px = clamp((left ? r.x : r.x + r.w) + dx, 0, 1);
    const py = clamp((top ? r.y : r.y + r.h) + dy, 0, 1);
    const roomW = left ? ax : 1 - ax;
    const roomH = top ? ay : 1 - ay;
    let w = clamp(Math.abs(px - ax), min.w, roomW);
    let h = clamp(Math.abs(py - ay), min.h, roomH);
    if (ratio) {
      // Follow the pointer on whichever side it pulls further, then fit the room.
      let wPx = Math.max(w * width, h * height * ratio);
      wPx = Math.min(wPx, roomW * width, roomH * height * ratio);
      w = wPx / width;
      h = wPx / ratio / height;
    }
    setRect({ x: left ? ax - w : ax, y: top ? ay - h : ay, w, h });
  };

  const end = () => {
    drag.current = null;
  };

  /** Arrow keys move the frame: 1% a press, 10% with Shift. */
  const nudge = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = by[event.key];
    if (!delta) return;
    event.preventDefault();
    setRect((r) => ({
      ...r,
      x: clamp(r.x + delta[0], 0, 1 - r.w),
      y: clamp(r.y + delta[1], 0, 1 - r.h),
    }));
  };

  /** A size typed in pixels: the frame keeps its top-left corner, moving in only if it must. */
  const typed = (side: "width" | "height", value: string) => {
    if (!known) return;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n <= 0) return;
    setRect((r) => {
      let wPx = side === "width" ? n : r.w * width;
      let hPx = side === "height" ? n : r.h * height;
      if (ratio) {
        if (side === "width") hPx = wPx / ratio;
        else wPx = hPx * ratio;
      }
      // Never past the photo: shrink both, keeping the shape.
      const scale = Math.min(1, width / wPx, height / hPx);
      wPx = Math.max(MIN_PX, wPx * scale);
      hPx = Math.max(MIN_PX, hPx * scale);
      const w = Math.min(1, wPx / width);
      const h = Math.min(1, hPx / height);
      return { x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
    });
  };

  const whole =
    crop !== null &&
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === width &&
    crop.height === height;
  const turnable = shape !== "free" && shape !== "original" && shape !== "1:1";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Crop photo</DialogTitle>
        <DialogDescription>
          Drag the frame to choose the part to show, or a corner to make it
          bigger or smaller. The photo in your media library stays as it is.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Shape"
          className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1"
        >
          {SHAPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={shape === option.value}
              disabled={!known}
              onClick={() => choose(option.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                shape === option.value
                  ? "bg-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {labelOf(option.value, turn)}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Orientation"
          className="bg-muted inline-flex gap-1 rounded-lg p-1"
        >
          {(["portrait", "landscape"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={turn === option}
              disabled={!turnable}
              title={turnable ? undefined : "Choose a shape like 4:3 first"}
              onClick={() => choose(shape, option)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                turn === option && turnable
                  ? "bg-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "portrait" ? (
                <RectangleVerticalIcon className="size-3.5" />
              ) : (
                <RectangleHorizontalIcon className="size-3.5" />
              )}
              {option === "portrait" ? "Portrait" : "Landscape"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-muted/50 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md p-2">
        <div
          ref={frame}
          className="relative inline-block touch-none overflow-hidden select-none"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a working view, sized by the dialog */}
          <img
            src={src}
            alt={image.altText ?? ""}
            draggable={false}
            className="block max-h-[56dvh] w-auto max-w-full"
            onLoad={(event) => {
              if (!image.width || !image.height) {
                setMeasured({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }
            }}
          />
          {known ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={`Crop frame${crop ? `, ${crop.width} by ${crop.height} pixels` : ""}. Arrow keys move it; with Shift, further.`}
              onKeyDown={nudge}
              onPointerDown={start}
              className="focus-visible:ring-ring absolute cursor-move outline-none focus-visible:ring-2"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
                outline: "1px solid rgb(255 255 255 / 0.9)",
              }}
            >
              {/* Thirds, to place the subject. */}
              <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <span
                  key={corner}
                  aria-hidden
                  data-handle={corner}
                  className={cn(
                    // Inside the frame: at the photo's edge, a handle half outside would be cut off.
                    "absolute size-5 rounded-sm border-2 border-white bg-black/40",
                    corner.includes("n") ? "top-0" : "bottom-0",
                    corner.includes("w") ? "left-0" : "right-0",
                    corner === "nw" || corner === "se"
                      ? "cursor-nwse-resize"
                      : "cursor-nesw-resize",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-muted-foreground block text-[11px]">
            Width (px)
          </span>
          <Input
            type="number"
            min={MIN_PX}
            max={width || undefined}
            disabled={!crop}
            className="h-8 w-24 text-xs"
            value={crop?.width ?? ""}
            onChange={(event) => typed("width", event.target.value)}
          />
        </label>
        <span className="text-muted-foreground pb-2 text-xs">×</span>
        <label className="space-y-1">
          <span className="text-muted-foreground block text-[11px]">
            Height (px)
          </span>
          <Input
            type="number"
            min={MIN_PX}
            max={height || undefined}
            disabled={!crop}
            className="h-8 w-24 text-xs"
            value={crop?.height ?? ""}
            onChange={(event) => typed("height", event.target.value)}
          />
        </label>
        <p className="text-muted-foreground pb-2 text-xs">
          {crop ? (
            <>
              {crop.height > crop.width
                ? "Portrait"
                : crop.height < crop.width
                  ? "Landscape"
                  : "Square"}{" "}
              · the original is {width} × {height} px
              {Math.min(crop.width, crop.height) < SOFT_PX ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}
                  · small: may look soft when shown large. Make the frame bigger
                  if you can.
                </span>
              ) : null}
            </>
          ) : (
            "Loading the photo…"
          )}
        </p>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!image.crop}
          onClick={() => {
            onApply(undefined);
            onClose();
          }}
        >
          Use the whole photo
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!crop}
            onClick={() => {
              onApply(crop && !whole ? crop : undefined);
              onClose();
            }}
          >
            <CropIcon className="size-3.5" />
            Apply crop
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/**
 * The Crop button under a chosen photo, with what it shows now: "Cropped · 1600 × 2000 px"
 * or the photo's own size.
 */
export function CropButton({
  image,
  onChange,
}: {
  image: ImageRef;
  onChange: (image: ImageRef) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const shown = croppedImage(image);
  const size =
    shown.width && shown.height ? `${shown.width} × ${shown.height} px` : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <CropIcon className="size-3.5" />
        {image.crop ? "Change crop" : "Crop"}
      </Button>
      {size ? (
        <span className="text-muted-foreground text-[11px]">
          {image.crop ? `Cropped · ${size}` : size}
        </span>
      ) : null}
      <ImageCropDialog
        image={image}
        open={open}
        onOpenChange={setOpen}
        onApply={(crop) => {
          const next = { ...image };
          if (crop) next.crop = crop;
          else delete next.crop;
          onChange(next);
        }}
      />
    </div>
  );
}
