import "server-only";

import { NextResponse } from "next/server";

import { fail, failure, guard, readJson, validate } from "./api";
import { audit } from "./audit";
import { createCollection, updateCollection, type CollectionWriteInput } from "./collections";
import { revalidateForType } from "./revalidate";
import { createCollectionSchema, updateCollectionSchema } from "./validation";

/**
 * The collection write pipeline — same order of checks as the metaobject one, and for
 * the same reasons:
 *
 *   session -> same-origin -> rate limit -> body size -> schema
 *          -> operation matches what this route allows -> Shopify
 *
 * The route pins the operation name, so a create payload cannot be smuggled through the
 * update endpoint. That matters here because create requires a title and update does
 * not — the two have genuinely different rules.
 */

const MAX_BODY_BYTES = 512 * 1024;

type Allowed = "collectionCreate" | "collectionUpdate";

/**
 * Turns the wire shape into Shopify's, dropping anything absent.
 *
 * ON UPDATE, ONLY WHAT CHANGED ARRIVES. Shopify leaves an omitted key alone, so sending
 * a partial input is what stops this from overwriting a field another editor touched a
 * moment ago. The client sends only its dirty fields; this preserves that by never
 * filling in a default for a key it was not given.
 */
function toWriteInput(data: {
  title?: string;
  handle?: string;
  descriptionHtml?: string;
  sortOrder?: string;
  seoTitle?: string;
  seoDescription?: string;
  imageGid?: string;
  imageAlt?: string;
}): CollectionWriteInput {
  const input: CollectionWriteInput = {};

  if (data.title !== undefined) input.title = data.title;
  if (data.handle !== undefined) input.handle = data.handle;
  if (data.descriptionHtml !== undefined) input.descriptionHtml = data.descriptionHtml;
  if (data.sortOrder !== undefined) input.sortOrder = data.sortOrder;

  if (data.seoTitle !== undefined || data.seoDescription !== undefined) {
    input.seo = {
      ...(data.seoTitle !== undefined ? { title: data.seoTitle } : {}),
      ...(data.seoDescription !== undefined ? { description: data.seoDescription } : {}),
    };
  }

  return input;
}

export async function handleCollectionWrite(
  request: Request,
  allowed: Allowed,
): Promise<NextResponse> {
  const action = allowed === "collectionCreate" ? "collection.create" : "collection.update";

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

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (operation !== allowed) {
    audit({ action, actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  try {
    if (allowed === "collectionCreate") {
      const parsed = validate(createCollectionSchema, body.value, action);
      if (!parsed.ok) {
        audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
        return parsed.response;
      }

      const created = await createCollection(toWriteInput(parsed.data));

      audit({
        action,
        actor: staff.email,
        outcome: "ok",
        type: "collection",
        entryId: created.id,
        // Keys only, never the values.
        fields: Object.keys(parsed.data).filter((key) => key !== "operation"),
        ip,
      });

      await revalidateForType("collection");
      return NextResponse.json(created);
    }

    const parsed = validate(updateCollectionSchema, body.value, action);
    if (!parsed.ok) {
      audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
      return parsed.response;
    }

    const { id, ...rest } = parsed.data;
    const updated = await updateCollection(id, toWriteInput(rest));

    audit({
      action,
      actor: staff.email,
      outcome: "ok",
      type: "collection",
      entryId: updated.id,
      fields: Object.keys(rest).filter((key) => key !== "operation"),
      ip,
    });

    await revalidateForType("collection");
    return NextResponse.json(updated);
  } catch (error) {
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
