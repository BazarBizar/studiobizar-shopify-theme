import { BoxIcon, FileIcon, ImageIcon, PlayIcon } from "lucide-react";

import type { PickerFile } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * Presentation helpers shared by the media library and its viewer, so a file reads the
 * same — same format label, same size — in a row, a tile and the popup.
 */

/** Shopify's `__typename`, in the words the filter uses. */
export function kindLabel(kind: string): string {
  return kind === "MediaImage"
    ? "Image"
    : kind === "Video"
      ? "Video"
      : kind === "Model3d"
        ? "3D model"
        : kind === "GenericFile"
          ? "File"
          : kind;
}

/** What an operator calls a format, not what a MIME registry does. */
const FORMAT_BY_MIME: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/svg+xml": "SVG",
  "video/quicktime": "MOV",
  "model/gltf-binary": "GLB",
  "model/gltf+json": "GLTF",
  "model/vnd.usdz+zip": "USDZ",
  "application/pdf": "PDF",
};

export function formatOf(file: PickerFile): string | null {
  if (file.mimeType) {
    return FORMAT_BY_MIME[file.mimeType] ?? file.mimeType.split("/").pop()!.toUpperCase();
  }
  const extension = file.filename?.match(/\.([a-z0-9]+)$/i)?.[1];
  return extension ? extension.toUpperCase() : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Format · size · resolution · duration — whichever of them Shopify reported. */
export function describe(file: PickerFile): string {
  return [
    formatOf(file),
    file.size != null ? formatBytes(file.size) : null,
    file.width && file.height ? `${file.width}×${file.height}` : null,
    file.duration != null ? formatDuration(file.duration) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function pixels(file: PickerFile): number | null {
  return file.width && file.height ? file.width * file.height : null;
}

/**
 * Shopify's CDN resizes on request. The listing hands back the ORIGINAL — a 4 MB
 * PNG is common in this store — and fifty of those per page to fill 56px squares
 * is most of the page weight. Anything not on the CDN is left alone.
 */
export function sized(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "cdn.shopify.com") return url;
    parsed.searchParams.set("width", String(width));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function FallbackIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon =
    kind === "Video"
      ? PlayIcon
      : kind === "Model3d"
        ? BoxIcon
        : kind === "GenericFile"
          ? FileIcon
          : ImageIcon;
  return <Icon className={cn("text-muted-foreground", className)} />;
}
