import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { countMenuItems, menuHandle, menuId, menuItemsSchema, menuRuleResponse, menuTitle } from "@/lib/admin/menu-schema";
import { updateMenu } from "@/lib/admin/menus";
import { revalidateForType } from "@/lib/admin/revalidate";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * Saves a menu: its name, its handle (a menu made here only) and its whole tree.
 *
 * `menuUpdate` REPLACES the item tree rather than patching it, which makes an
 * incomplete payload destructive rather than partial — so the editor always sends
 * every item it holds, and one of the site's own menus may not be emptied (checked in
 * `updateMenu`, which reads the menu from the store rather than trusting the browser).
 */
const schema = z.strictObject({
  operation: z.literal("menuUpdate"),
  id: menuId,
  title: menuTitle,
  handle: menuHandle,
  items: menuItemsSchema,
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "menu.update", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 512 * 1024);
  if (!body.ok) {
    audit({ action: "menu.update", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "menuUpdate") {
    audit({ action: "menu.update", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "menu.update");
  if (!parsed.ok) {
    audit({ action: "menu.update", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { id, title, handle, items } = parsed.data;

  try {
    const updated = await updateMenu(id, title, handle, items);

    audit({
      action: "menu.update",
      actor: staff.email,
      outcome: "ok",
      type: "menu",
      entryId: updated.id,
      // The count, not the titles: a nav label is copy, and the log outlives the
      // request. What matters afterwards is whether the tree grew or shrank.
      fields: [`${countMenuItems(items)} links`],
      ip,
    });

    await revalidateForType("menu");
    return NextResponse.json(updated);
  } catch (error) {
    const rule = menuRuleResponse(error);
    if (rule) {
      audit({ action: "menu.update", actor: staff.email, outcome: "denied", reason: "RULE", ip });
      return rule;
    }
    audit({ action: "menu.update", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("menu.update", error);
  }
}
