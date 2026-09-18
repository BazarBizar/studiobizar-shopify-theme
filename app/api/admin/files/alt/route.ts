import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { setFileAlt } from "@/lib/admin/media";

/**
 * Alt text on an existing file.
 *
 * `setFileAlt` has existed in `lib/admin/media.ts` since the media picker was
 * built and nothing has ever called it: alt text could be supplied at upload and
 * never changed afterwards. On a store with five thousand images that meant a
 * missing or wrong description was permanent. This is the route that reaches it.
 *
 * ALT TEXT IS THE ONLY PROPERTY OF A FILE THE PANEL MAY CHANGE, and there is no
 * delete anywhere — `fileDelete` is not in the operation allowlist. Shopify does
 * not check references before removing a file, so deleting one silently empties
 * every product, metaobject and page metafield pointing at it, with nothing to
 * say which. That is not a confirmation dialog's problem to solve.
 *
 * NO REVALIDATION. Alt text reaches the storefront through the same image
 * objects the page already caches, and dropping the whole content cache for a
 * one-word accessibility fix costs far more than waiting out the ISR window.
 */
const schema = z.strictObject({
  operation: z.literal("fileAlt"),
  id: z.string().regex(/^gid:\/\/shopify\/(MediaImage|Video|GenericFile)\/\d+$/, "not a file id"),
  /** Empty clears it, which is correct for a decorative image. */
  alt: z.string().max(512),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "file.alt", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 8 * 1024);
  if (!body.ok) {
    audit({ action: "file.alt", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "fileAlt") {
    audit({
      action: "file.alt",
      actor: staff.email,
      outcome: "denied",
      reason: "OPERATION_MISMATCH",
      ip,
    });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "file.alt");
  if (!parsed.ok) {
    audit({ action: "file.alt", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    await setFileAlt(parsed.data.id, parsed.data.alt);

    audit({
      action: "file.alt",
      actor: staff.email,
      outcome: "ok",
      type: "file",
      entryId: parsed.data.id,
      fields: ["alt"],
      ip,
    });

    return NextResponse.json({ id: parsed.data.id, alt: parsed.data.alt });
  } catch (error) {
    audit({ action: "file.alt", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("file.alt", error);
  }
}
