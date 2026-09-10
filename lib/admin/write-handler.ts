import "server-only";

import { NextResponse } from "next/server";

import { failure, fail, guard, readJson, validate } from "./api";
import { audit } from "./audit";
import { createEntry, updateEntry, NotAllowedError, NotFoundError } from "./metaobjects";
import { revalidateForType } from "./revalidate";
import { createEntrySchema, updateEntrySchema } from "./validation";

/**
 * THE single write pipeline. Both write routes are three lines that call in here,
 * so the order of checks exists in exactly one place:
 *
 *   session -> same-origin -> rate limit -> body size -> schema
 *          -> operation matches what this route allows -> Shopify
 *
 * Cheap and local first, Shopify last. An unauthenticated flood costs a cookie
 * lookup, not an Admin API call.
 *
 * WHY THE ROUTE PINS THE OPERATION. Create and update share this function but each
 * passes the one operation name it will accept, and a payload naming the other is
 * refused. Without that, a create payload could be smuggled through the update
 * endpoint — which matters because the two have different rules: `assertWritable`
 * refuses create outright on a read-only type but allows an update that touches
 * only `editableFields`.
 */

/** Enough for rich text with inline content; small enough to be no threat. */
const MAX_BODY_BYTES = 512 * 1024;

type Allowed = "metaobjectCreate" | "metaobjectUpdate";

export async function handleWrite(request: Request, allowed: Allowed): Promise<NextResponse> {
  const action = allowed === "metaobjectCreate" ? "metaobject.create" : "metaobject.update";

  const guarded = await guard(request, { action, limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) {
    audit({ action, actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(
      body.code,
      body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.",
    );
  }

  // The operation is checked before the schema so that a payload aimed at the
  // wrong endpoint is refused as such, rather than as a validation error about a
  // field it should never have been allowed to name.
  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (operation !== allowed) {
    audit({ action, actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  try {
    if (allowed === "metaobjectCreate") {
      const parsed = validate(createEntrySchema, body.value, action);
      if (!parsed.ok) {
        audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
        return parsed.response;
      }

      const { type, fields } = parsed.data;
      const created = await createEntry(type, fields);

      audit({
        action,
        actor: staff.email,
        outcome: "ok",
        type,
        entryId: created.id,
        // Keys only. A value here would put customer data and unpublished copy
        // into the log, which outlives the request and travels further.
        fields: fields.map((field) => field.key),
        ip,
      });

      await revalidateForType(type);

      return NextResponse.json({ id: created.id, handle: created.handle, type: created.type });
    }

    const parsed = validate(updateEntrySchema, body.value, action);
    if (!parsed.ok) {
      audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
      return parsed.response;
    }

    const { id, fields } = parsed.data;
    const updated = await updateEntry(id, fields);

    audit({
      action,
      actor: staff.email,
      outcome: "ok",
      type: updated.type,
      entryId: updated.id,
      fields: fields.map((field) => field.key),
      ip,
    });

    await revalidateForType(updated.type);

    return NextResponse.json({ id: updated.id, handle: updated.handle, type: updated.type });
  } catch (error) {
    if (error instanceof NotAllowedError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail("NOT_ALLOWED", error.message);
    }

    if (error instanceof NotFoundError) {
      audit({ action, actor: staff.email, outcome: "error", reason: error.code, ip });
      return fail("BAD_REQUEST", error.message);
    }

    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
