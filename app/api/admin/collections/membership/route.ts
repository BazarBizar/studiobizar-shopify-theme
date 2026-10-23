import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { setCollectionMembership, SmartCollectionError } from "@/lib/admin/collections";
import { revalidateForType } from "@/lib/admin/revalidate";

/** Room for the product updates, and the second cache drop `revalidateForType` schedules. */
export const maxDuration = 60;

/** Adds products to, or removes them from, a MANUAL collection. A smart one is refused. */
const PRODUCT_IDS = z.array(z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "not a product id")).max(50);

const schema = z.strictObject({
  operation: z.literal("collectionMembership"),
  id: z.string().regex(/^gid:\/\/shopify\/Collection\/\d+$/, "not a collection id"),
  add: PRODUCT_IDS.optional(),
  remove: PRODUCT_IDS.optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "collection.membership", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 32 * 1024);
  if (!body.ok) {
    audit({ action: "collection.membership", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  const parsed = validate(schema, body.value, "collection.membership");
  if (!parsed.ok) {
    audit({ action: "collection.membership", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { id, add = [], remove = [] } = parsed.data;
  if (add.length + remove.length === 0) return fail("INVALID", "Choose at least one product.");

  try {
    const { failed } = await setCollectionMembership(id, { add, remove });
    audit({
      action: "collection.membership",
      actor: staff.email,
      outcome: failed.length ? "error" : "ok",
      type: "collection",
      entryId: id,
      fields: [...(add.length ? ["add"] : []), ...(remove.length ? ["remove"] : [])],
      ip,
    });
    await revalidateForType("collection");
    return NextResponse.json({ failed });
  } catch (error) {
    if (error instanceof SmartCollectionError) return fail("NOT_ALLOWED", error.message);
    audit({ action: "collection.membership", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("collection.membership", error);
  }
}
