import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { createRedirect, deleteRedirect, RedirectError, redirectInput } from "@/lib/admin/redirects";

/**
 * Website → Redirects (`lib/admin/redirects.ts`):
 *
 *   redirectCreate  an old address and where it goes — refused when the old address
 *                   still shows a page, already has a redirect, or would make a circle
 *   redirectDelete  one redirect, by id
 *
 * Nothing to revalidate: no page is cached with a redirect in it. The proxy reloads the
 * list within a minute (`lib/redirect-map.ts`).
 */
const schema = z.discriminatedUnion("operation", [
  redirectInput.extend({ operation: z.literal("redirectCreate") }),
  z.strictObject({
    operation: z.literal("redirectDelete"),
    id: z.string().regex(/^gid:\/\/shopify\/UrlRedirect\/\d+$/, "not a redirect id"),
  }),
]);

const ACTIONS = { redirectCreate: "redirect.create", redirectDelete: "redirect.delete" } as const;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "redirect", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 8 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "redirect", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
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
    if (input.operation === "redirectCreate") {
      const created = await createRedirect({ from: input.from, to: input.to });
      audit({ action, actor: staff.email, outcome: "ok", type: "redirect", entryId: created.id, ip });
      return NextResponse.json(created);
    }
    await deleteRedirect(input.id);
    audit({ action, actor: staff.email, outcome: "ok", type: "redirect", entryId: input.id, ip });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RedirectError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code, error.message);
    }
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
