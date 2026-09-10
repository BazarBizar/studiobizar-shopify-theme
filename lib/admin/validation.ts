import "server-only";

import { z } from "zod";

/**
 * Wire schemas for the write endpoints.
 *
 * Every field value is a STRING here, matching how Shopify stores them and how
 * `lib/admin/field-values.ts` interprets them. Nothing is coerced: a `number_integer`
 * arrives as "12", a boolean as "true". Shopify does the per-type validation — it is
 * the authority on whether "12.5" is a valid integer for a given field, and
 * duplicating those rules here would mean two sets of rules that can disagree.
 *
 * What IS enforced here is shape and size: that the payload is the right form, that
 * keys look like keys, and that no single value is large enough to be an attack.
 */

/** Generous for rich text, far below anything that could exhaust memory. */
const MAX_VALUE_BYTES = 256 * 1024;

/** Shopify metaobject field keys are lowercase identifiers. */
const fieldKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "not a valid field key");

const fieldValue = z
  .string()
  .max(MAX_VALUE_BYTES, "value is too large");

const fieldEntry = z.object({ key: fieldKey, value: fieldValue });

/**
 * A metaobject type, as it appears in Shopify. Only shape is checked here —
 * whether the type EXISTS is decided by the allowlist in
 * `lib/admin/metaobjects.ts`, against the live store.
 */
const metaobjectType = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, "not a valid metaobject type");

const fields = z
  .array(fieldEntry)
  .min(1, "no fields to write")
  .max(100, "too many fields")
  .refine(
    (list) => new Set(list.map((field) => field.key)).size === list.length,
    "the same field appears twice",
  );

export const createEntrySchema = z.object({
  operation: z.literal("metaobjectCreate"),
  type: metaobjectType,
  fields,
});

export const updateEntrySchema = z.object({
  operation: z.literal("metaobjectUpdate"),
  /** Full Shopify gid. The type is looked up from the store, never trusted here. */
  id: z
    .string()
    .regex(/^gid:\/\/shopify\/Metaobject\/\d+$/, "not a metaobject id"),
  fields,
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
