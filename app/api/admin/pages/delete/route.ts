import { after, NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { BuilderError, deleteBuilderPage, waitForStorefront } from "@/lib/admin/page-builder";
import { dropInFreshRequest, revalidateForType } from "@/lib/admin/revalidate";

/** Room for `after()` to wait until Shopify stops serving the page. */
export const maxDuration = 120;

/**
 * Deletes a page builder page — irreversible, so it arrives with nothing but an
 * id and the decision is made from the store: `deleteBuilderPage` re-reads the
 * page and refuses anything that is not a builder page.
 */
const schema = z.strictObject({
  operation: z.literal("pageDelete"),
  id: z.string().regex(/^gid:\/\/shopify\/Page\/\d+$/, "not a page id"),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "page.delete", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) {
    audit({ action: "page.delete", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "pageDelete") {
    audit({ action: "page.delete", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "page.delete");
  if (!parsed.ok) {
    audit({ action: "page.delete", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const deleted = await deleteBuilderPage(parsed.data.id);
    audit({ action: "page.delete", actor: staff.email, outcome: "ok", type: "page", entryId: deleted.id, ip });

    const tags = await revalidateForType("page", { settle: false });
    // Again once Shopify has stopped serving it — the first drop can refill from
    // the Storefront API's cached copy. A fresh request, because a second
    // `revalidateTag` in this one would be ignored. See `waitForStorefront`.
    after(async () => {
      await waitForStorefront(deleted.handle, { gone: true });
      await dropInFreshRequest(tags);
    });
    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof BuilderError) {
      audit({ action: "page.delete", actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail("NOT_ALLOWED", error.message);
    }

    audit({ action: "page.delete", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("page.delete", error);
  }
}
