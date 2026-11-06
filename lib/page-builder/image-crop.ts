import type { ImageCrop, ImageRef } from "./value-types";

/**
 * A builder image's CROP (`ImageRef.crop`), drawn by the Shopify CDN itself:
 * `crop=region` cuts the original, so the visitor downloads only that part, and
 * `width=` still sizes what is left (`cdnImage` adds it on top).
 *
 * The section renderer passes every section's settings through `withCrops` before
 * anything draws them: each component then simply sees a smaller photograph, of the
 * crop's size and shape. No component knows crops exist, so none can forget one.
 */

/** The address of just the cropped part. */
export function croppedUrl(url: string, crop: ImageCrop): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("crop", "region");
    parsed.searchParams.set("crop_left", String(crop.x));
    parsed.searchParams.set("crop_top", String(crop.y));
    parsed.searchParams.set("crop_width", String(crop.width));
    parsed.searchParams.set("crop_height", String(crop.height));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Was this photo cropped? A crop is a choice of SHAPE as well as of part: a photo frame
 * that would otherwise impose its own shape (4:5, 3:4 …) takes the crop's instead. Not
 * a banner's or a hero's ground, whose box is the section's — there the crop only picks
 * the part shown.
 */
export function isCropped(image: unknown): boolean {
  return Boolean(image && typeof image === "object" && (image as { crop?: unknown }).crop);
}

/**
 * The style of a frame a photo FILLS: `--sb-photo-ratio` always (the photo's own shape,
 * read by the Style tab's "As uploaded" — known before the photo loads, so nothing
 * jumps), and the shape itself when the frame follows the photo (`own`).
 */
export function photoFrameStyle(
  image: { width?: number | null; height?: number | null } | null | undefined,
  own: boolean,
): React.CSSProperties | undefined {
  if (!image?.width || !image.height) return undefined;
  const ratio = `${image.width} / ${image.height}`;
  return { ["--sb-photo-ratio" as string]: ratio, ...(own ? { aspectRatio: ratio } : {}) };
}

/** The photograph as the visitor sees it: the crop's address, size and shape. */
export function croppedImage<T extends ImageRef>(image: T): T {
  if (!image.crop) return image;
  return { ...image, url: croppedUrl(image.url, image.crop), width: image.crop.width, height: image.crop.height };
}

const isCroppedImage = (value: Record<string, unknown>): value is ImageRef & { crop: ImageCrop } =>
  typeof value.url === "string" &&
  typeof value.id === "string" &&
  value.crop !== null &&
  typeof value.crop === "object" &&
  !Array.isArray(value.crop);

/**
 * Every cropped image anywhere in a value — a section's settings, its blocks, its
 * design's background — replaced by what it looks like cropped. What is unchanged is
 * returned as it was (same object), so nothing is copied for a page with no crops.
 */
export function withCrops<T>(value: T): T {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = withCrops(item);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? out : value) as T;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (isCroppedImage(record)) return croppedImage(record) as T;
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      const next = withCrops(item);
      if (next !== item) changed = true;
      out[key] = next;
    }
    return (changed ? out : value) as T;
  }
  return value;
}
