import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { clearPageMetafields, updatePage } from "@/lib/admin/pages";
import { revalidateForType } from "@/lib/admin/revalidate";
import { BUILDER_METAFIELD_KEYS } from "@/lib/page-builder/document";
import { isReservedHandle } from "@/lib/page-builder/handles";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * EDIT ONLY, like the product route — and for a sharper reason.
 *
 * Neither `pageCreate` nor `pageDelete` is in the operation allowlist. A page is
 * created by `schema-push`, which also gives it the template suffix that decides
 * which storefront route renders it; a page created here would have no suffix and
 * no route, so the button would produce something nobody can reach. Deleting one
 * breaks whichever route reads it by handle. Both belong with the tool that owns
 * the handle-to-route relationship.
 *
 * Core fields and metafields arrive together because they land in ONE `pageUpdate`.
 */
/**
 * The page builder's documents are written ONLY through `/api/admin/pages/builder`,
 * which validates them against the section registry. Accepting them here would be
 * a way round that validation, so they are refused by key.
 */
const notBuilderKey = (key: string) => !BUILDER_METAFIELD_KEYS.includes(key);
const BUILDER_KEY_MESSAGE = "Page builder content is saved from the page builder.";

const schema = z.strictObject({
  operation: z.literal("pageUpdate"),
  id: z.string().regex(/^gid:\/\/shopify\/Page\/\d+$/, "not a page id"),
  title: z.string().min(1).max(255).optional(),
  handle: z
    .string()
    .max(255)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, numbers and hyphens only")
    // A handle a route or Shopify already owns — renaming onto one breaks that route.
    .refine((handle) => !isReservedHandle(handle), "That handle is already used by the site.")
    .optional(),
  body: z.string().max(512 * 1024).optional(),
  isPublished: z.boolean().optional(),
  /** Shopify's SEO fields. "" clears one — see `updatePage`. */
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(320).optional(),
  /** Values stay strings all the way to Shopify — see lib/admin/field-values.ts. */
  metafields: z
    .array(
      z.strictObject({
        key: z.string().max(64).refine(notBuilderKey, BUILDER_KEY_MESSAGE),
        type: z.string().max(64),
        value: z.string().max(256 * 1024),
      }),
    )
    .max(100)
    .optional(),
  /** Keys to clear. A cleared metafield is DELETED, not set to "". */
  clearMetafields: z.array(z.string().max(64).refine(notBuilderKey, BUILDER_KEY_MESSAGE)).max(100).optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "page.update", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 1024 * 1024);
  if (!body.ok) {
    audit({ action: "page.update", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(
      body.code,
      body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.",
    );
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "pageUpdate") {
    audit({
      action: "page.update",
      actor: staff.email,
      outcome: "denied",
      reason: "OPERATION_MISMATCH",
      ip,
    });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "page.update");
  if (!parsed.ok) {
    audit({ action: "page.update", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { id, clearMetafields, ...rest } = parsed.data;

  try {
    // Cleared first: setting and clearing the same key in one request is ambiguous,
    // and doing the delete first makes the set the winner if a caller does both.
    if (clearMetafields?.length) await clearPageMetafields(id, clearMetafields);

    const updated = await updatePage(id, rest);

    audit({
      action: "page.update",
      actor: staff.email,
      outcome: "ok",
      type: "page",
      entryId: updated.id,
      // Keys only, never the values — a page body is publishable copy.
      fields: Object.keys(parsed.data).filter((key) => key !== "operation" && key !== "id"),
      ip,
    });

    await revalidateForType("page");
    return NextResponse.json(updated);
  } catch (error) {
    audit({ action: "page.update", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("page.update", error);
  }
}
