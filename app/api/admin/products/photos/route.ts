import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { addProductPhotos, removeProductPhotos, reorderProductPhotos } from "@/lib/admin/products";
import { revalidateForType } from "@/lib/admin/revalidate";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * A product's photos: link files from the library, unlink them, put them in order.
 * Unlinking never deletes a file — see `lib/admin/products.ts`.
 */
const PRODUCT_ID = z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "not a product id");
const FILE_ID = z.string().regex(/^gid:\/\/shopify\/(MediaImage|Video|GenericFile|Model3d|ExternalVideo)\/\d+$/, "not a file id");

const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("productPhotosAdd"), id: PRODUCT_ID, files: z.array(FILE_ID).min(1).max(50) }),
  z.strictObject({ operation: z.literal("productPhotosRemove"), id: PRODUCT_ID, files: z.array(FILE_ID).min(1).max(50) }),
  z.strictObject({
    operation: z.literal("productPhotosReorder"),
    id: PRODUCT_ID,
    moves: z.array(z.strictObject({ id: FILE_ID, newPosition: z.number().int().min(0).max(250) })).min(1).max(250),
  }),
]);

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "product.photos", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 64 * 1024);
  if (!body.ok) {
    audit({ action: "product.photos", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  const parsed = validate(schema, body.value, "product.photos");
  if (!parsed.ok) {
    audit({ action: "product.photos", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const input = parsed.data;
  try {
    if (input.operation === "productPhotosAdd") await addProductPhotos(input.id, input.files);
    else if (input.operation === "productPhotosRemove") await removeProductPhotos(input.id, input.files);
    else await reorderProductPhotos(input.id, input.moves);

    audit({
      action: "product.photos",
      actor: staff.email,
      outcome: "ok",
      type: "product",
      entryId: input.id,
      fields: [input.operation],
      ip,
    });
    await revalidateForType("product");
    return NextResponse.json({ ok: true });
  } catch (error) {
    audit({ action: "product.photos", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("product.photos", error);
  }
}
