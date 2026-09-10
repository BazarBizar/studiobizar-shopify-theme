import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { setProductPublication } from "@/lib/admin/products";
import { revalidateForType } from "@/lib/admin/revalidate";

/**
 * One channel toggle. Saves immediately rather than joining a form's Save — a switch that
 * looked flipped but was not yet stored would be lying about where the product is live.
 */
const schema = z.strictObject({
  operation: z.literal("publishable"),
  id: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "not a product id"),
  publicationId: z.string().regex(/^gid:\/\/shopify\/Publication\/\d+$/, "not a publication id"),
  publish: z.boolean(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "product.publish", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 8 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "product.publish");
  if (!parsed.ok) return parsed.response;

  try {
    await setProductPublication(parsed.data.id, parsed.data.publicationId, parsed.data.publish);

    audit({
      action: "product.publish",
      actor: staff.email,
      outcome: "ok",
      type: "product",
      entryId: parsed.data.id,
      fields: [parsed.data.publish ? "publish" : "unpublish"],
      ip,
    });

    await revalidateForType("product");
    return NextResponse.json({ ok: true });
  } catch (error) {
    audit({ action: "product.publish", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("product.publish", error);
  }
}
