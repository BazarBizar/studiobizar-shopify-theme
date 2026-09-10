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

export const createEntrySchema = z.strictObject({
  operation: z.literal("metaobjectCreate"),
  type: metaobjectType,
  fields,
});

export const updateEntrySchema = z.strictObject({
  operation: z.literal("metaobjectUpdate"),
  /** Full Shopify gid. The type is looked up from the store, never trusted here. */
  id: z
    .string()
    .regex(/^gid:\/\/shopify\/Metaobject\/\d+$/, "not a metaobject id"),
  fields,
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

/* -------------------------------------------------------------------------- *
 * Collections
 * -------------------------------------------------------------------------- */

/**
 * NOTE WHAT IS ABSENT: there is no `ruleSet` key here, and there must never be one.
 * A smart collection's rules decide which products it contains; one wrong condition
 * empties it on the storefront with no undo. The panel reads rules and never writes
 * them — `lib/admin/collections.ts` has no place to put them either, so this schema and
 * that type agree.
 *
 * The schemas below are STRICT for that reason. Zod's default is to strip a key it does
 * not recognise, which meant a request asking to set `ruleSet` was answered `200` — safe,
 * because nothing reached Shopify, but it told the caller the change had been applied.
 * A strict object refuses it instead, so an unsupported write fails loudly.
 */
const collectionFields = {
  title: z.string().min(1).max(255).optional(),
  handle: z
    .string()
    .max(255)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, numbers and hyphens only")
    .optional(),
  descriptionHtml: z.string().max(256 * 1024).optional(),
  sortOrder: z
    .enum([
      "ALPHA_ASC",
      "ALPHA_DESC",
      "BEST_SELLING",
      "CREATED",
      "CREATED_DESC",
      "MANUAL",
      "MOST_RELEVANT",
      "PRICE_ASC",
      "PRICE_DESC",
    ])
    .optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(1024).optional(),
  /** A Shopify file gid, chosen through the media picker. */
  imageGid: z.string().max(255).optional(),
  imageAlt: z.string().max(512).optional(),
};

export const createCollectionSchema = z.strictObject({
  operation: z.literal("collectionCreate"),
  ...collectionFields,
  title: z.string().min(1).max(255),
});

export const updateCollectionSchema = z.strictObject({
  operation: z.literal("collectionUpdate"),
  id: z.string().regex(/^gid:\/\/shopify\/Collection\/\d+$/, "not a collection id"),
  ...collectionFields,
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
