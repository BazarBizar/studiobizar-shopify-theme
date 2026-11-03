import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import {
  createProductField,
  ProductDetailsError,
  productDetailsInput,
  productFieldInput,
  saveProductDetails,
} from "@/lib/admin/product-details";
import { revalidateForType } from "@/lib/admin/revalidate";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * Content → Product details (`lib/admin/product-details.ts`):
 *
 *   productDetailsSave  the rows and panels, whole, named by their digest
 *   productFieldCreate  a new product field to show as a row or a panel
 */
const schema = z.discriminatedUnion("operation", [
  productDetailsInput.extend({ operation: z.literal("productDetailsSave") }),
  productFieldInput.extend({ operation: z.literal("productFieldCreate") }),
]);

const ACTIONS = { productDetailsSave: "product_details.save", productFieldCreate: "product_field.create" } as const;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "product_details", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 32 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "product_details", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }
  const action = ACTIONS[operation as keyof typeof ACTIONS];

  const parsed = validate(schema, body.value, action);
  if (!parsed.ok) {
    audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }
  const input = parsed.data;

  try {
    if (input.operation === "productFieldCreate") {
      const field = await createProductField({ name: input.name, kind: input.kind });
      audit({ action, actor: staff.email, outcome: "ok", type: "product", fields: [field.key], ip });
      return NextResponse.json(field);
    }
    const saved = await saveProductDetails({ digest: input.digest, rows: input.rows, panels: input.panels }, staff.email);
    audit({ action, actor: staff.email, outcome: "ok", type: "product_details", fields: [...input.rows, ...input.panels].map((item) => item.key), ip });
    await revalidateForType("product_details");
    // The product pages are cached under their own tag, and they draw the list.
    await revalidateForType("product");
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof ProductDetailsError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code, error.message);
    }
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
