import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { annotateCustomer } from "@/lib/admin/customers";

/**
 * ANNOTATION ONLY. `note` and `tags` are the two keys this schema has, so nothing else
 * can be sent — a customer's own details, their state and their addresses belong to
 * Shopify, and there is no route here that could change them.
 *
 * There is no create route and no delete route for customers, for the same reason.
 */
const schema = z.strictObject({
  operation: z.literal("customerUpdate"),
  id: z.string().regex(/^gid:\/\/shopify\/Customer\/\d+$/, "not a customer id"),
  note: z.string().max(5000).optional(),
  tags: z.array(z.string().max(255)).max(250).optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "customer.annotate", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 32 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  if ((body.value as { operation?: unknown } | null)?.operation !== "customerUpdate") {
    audit({ action: "customer.annotate", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "customer.annotate");
  if (!parsed.ok) {
    audit({ action: "customer.annotate", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { id, ...annotation } = parsed.data;

  try {
    const updated = await annotateCustomer(id, annotation);

    audit({
      action: "customer.annotate",
      actor: staff.email,
      outcome: "ok",
      type: "customer",
      entryId: id,
      // Keys only — a note about a customer is exactly the kind of text a log must not keep.
      fields: Object.keys(annotation).filter((key) => key !== "operation"),
      ip,
    });

    return NextResponse.json(updated);
  } catch (error) {
    audit({ action: "customer.annotate", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("customer.annotate", error);
  }
}
