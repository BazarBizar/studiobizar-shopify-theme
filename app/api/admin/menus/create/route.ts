import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { menuHandle, menuRuleResponse, menuTitle } from "@/lib/admin/menu-schema";
import { createMenu } from "@/lib/admin/menus";
import { revalidateForType } from "@/lib/admin/revalidate";

export const maxDuration = 60;

/**
 * Makes an EMPTY menu — its links are added in the editor it opens on, as in Shopify.
 * `createMenu` refuses a handle the site's own menus use, or any menu already has.
 */
const schema = z.strictObject({
  operation: z.literal("menuCreate"),
  title: menuTitle,
  handle: menuHandle,
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "menu.create", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) {
    audit({ action: "menu.create", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "menuCreate") {
    audit({ action: "menu.create", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "menu.create");
  if (!parsed.ok) {
    audit({ action: "menu.create", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const created = await createMenu(parsed.data.title, parsed.data.handle);
    audit({ action: "menu.create", actor: staff.email, outcome: "ok", type: "menu", entryId: created.id, ip });
    await revalidateForType("menu");
    return NextResponse.json(created);
  } catch (error) {
    const rule = menuRuleResponse(error);
    if (rule) {
      audit({ action: "menu.create", actor: staff.email, outcome: "denied", reason: "RULE", ip });
      return rule;
    }
    audit({ action: "menu.create", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("menu.create", error);
  }
}
