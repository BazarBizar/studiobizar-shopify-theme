import { z } from "zod";

import { HEX_COLOR, type ImageCrop, type ImageRef } from "./value-types";

/**
 * Value shapes shared by the field vocabulary (`fields.ts`) and the design value
 * (`design.ts`). Their own module so the two can import each other's pieces without
 * a circular import — `fields.ts` re-exports everything here.
 */

export { HEX_COLOR, type ImageCrop, type ImageRef };

/**
 * Only Shopify's CDN. `next.config.ts` allows a handful of image hosts for the
 * Instagram feed; a builder image has no business being any of them, and an
 * arbitrary host here would be an arbitrary request from every visitor.
 */
const CDN_URL = /^https:\/\/cdn\.shopify\.com\/[^\s]+$/;

export const imageRefSchema = z.strictObject({
  id: z.string().regex(/^gid:\/\/shopify\/(MediaImage|GenericFile)\/\d+$/),
  url: z.string().max(2048).regex(CDN_URL),
  altText: z.string().max(512).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  crop: z
    .strictObject({
      x: z.number().int().min(0).max(20000),
      y: z.number().int().min(0).max(20000),
      width: z.number().int().min(1).max(20000),
      height: z.number().int().min(1).max(20000),
    })
    .optional(),
}).refine(
  // Inside the photograph, when its size is known.
  (image) =>
    !image.crop ||
    ((image.width === null || image.crop.x + image.crop.width <= image.width) &&
      (image.height === null || image.crop.y + image.crop.height <= image.height)),
  "The crop reaches past the edge of the photo. Crop it again.",
);
