import { z } from "zod";

import { HEX_COLOR, type ImageRef } from "./value-types";

/**
 * Value shapes shared by the field vocabulary (`fields.ts`) and the design value
 * (`design.ts`). Their own module so the two can import each other's pieces without
 * a circular import — `fields.ts` re-exports everything here.
 */

export { HEX_COLOR, type ImageRef };

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
});
