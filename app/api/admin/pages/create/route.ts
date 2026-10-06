import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { BuilderError, createBuilderPage } from "@/lib/admin/page-builder";
import { PAGE_TEMPLATE_IDS } from "@/lib/page-builder/templates";

/**
 * Creates a PAGE BUILDER page. The one way the panel makes a page: a page with a
 * hand-coded route still comes from schema-push, because its route is code and a
 * page made here would have nowhere to render. A builder page renders at
 * `/<handle>` the moment it is published, which is what makes creating one here
 * safe.
 */
const schema = z.strictObject({
  operation: z.literal("pageCreate"),
  title: z.string().trim().min(1, "Give the page a title.").max(255),
  handle: z.string().max(100),
  template: z.enum(PAGE_TEMPLATE_IDS),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "page.create", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 8 * 1024);
  if (!body.ok) {
    audit({ action: "page.create", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "pageCreate") {
    audit({ action: "page.create", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "page.create");
  if (!parsed.ok) {
    audit({ action: "page.create", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const created = await createBuilderPage(parsed.data, staff.email);
    audit({ action: "page.create", actor: staff.email, outcome: "ok", type: "page", entryId: created.id, ip });
    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof BuilderError) {
      audit({ action: "page.create", actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail("INVALID", error.message, { issues: [{ path: "handle", message: error.message }] });
    }

    audit({ action: "page.create", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("page.create", error);
  }
}
