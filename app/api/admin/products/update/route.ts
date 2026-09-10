import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { clearProductMetafields, updateProduct } from "@/lib/admin/products";
import { revalidateForType } from "@/lib/admin/revalidate";

/**
 * EDIT ONLY. There is no create and no delete route for products, and neither
 * `productCreate` nor `productDelete` is in the operation allowlist — so this is not a
 * hidden button, it is a capability the panel does not have.
 *
 * Core fields and metafields arrive together because they land in ONE `productUpdate`.
 * Splitting them into separate endpoints would invent a partial state the API does not
 * have.
 */
const schema = z.strictObject({
  operation: z.literal("productUpdate"),
  id: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "not a product id"),
  title: z.string().min(1).max(255).optional(),
  handle: z
    .string()
    .max(255)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, numbers and hyphens only")
    .optional(),
  descriptionHtml: z.string().max(512 * 1024).optional(),
  vendor: z.string().max(255).optional(),
  productType: z.string().max(255).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  tags: z.array(z.string().max(255)).max(250).optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(1024).optional(),
  /** Values stay strings all the way to Shopify — see lib/admin/field-values.ts. */
  metafields: z
    .array(z.strictObject({ key: z.string().max(64), type: z.string().max(64), value: z.string().max(256 * 1024) }))
    .max(100)
    .optional(),
  /** Keys to clear. A cleared metafield is DELETED, not set to "". */
  clearMetafields: z.array(z.string().max(64)).max(100).optional(),
  /** Files to attach, by Shopify CDN url. */
  attachMedia: z
    .array(
      z.strictObject({
        originalSource: z.string().max(2048),
        alt: z.string().max(512).optional(),
        mediaContentType: z.enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "MODEL_3D"]),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "product.update", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 1024 * 1024);
  if (!body.ok) {
    audit({ action: "product.update", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "productUpdate") {
    audit({ action: "product.update", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "product.update");
  if (!parsed.ok) {
    audit({ action: "product.update", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { id, seoTitle, seoDescription, clearMetafields, attachMedia, ...rest } = parsed.data;

  try {
    // Cleared first: setting and clearing the same key in one request is ambiguous, and
    // doing the delete first makes the set the winner if a caller does both.
    if (clearMetafields?.length) await clearProductMetafields(id, clearMetafields);

    const updated = await updateProduct(
      id,
      {
        ...rest,
        ...(seoTitle !== undefined || seoDescription !== undefined
          ? {
              seo: {
                ...(seoTitle !== undefined ? { title: seoTitle } : {}),
                ...(seoDescription !== undefined ? { description: seoDescription } : {}),
              },
            }
          : {}),
      },
      attachMedia,
    );

    audit({
      action: "product.update",
      actor: staff.email,
      outcome: "ok",
      type: "product",
      entryId: updated.id,
      // Keys only, never the values.
      fields: Object.keys(parsed.data).filter((key) => key !== "operation" && key !== "id"),
      ip,
    });

    await revalidateForType("product");
    return NextResponse.json(updated);
  } catch (error) {
    audit({ action: "product.update", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("product.update", error);
  }
}
