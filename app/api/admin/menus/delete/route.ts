import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { menuId, menuRuleResponse } from "@/lib/admin/menu-schema";
import { deleteMenu } from "@/lib/admin/menus";
import { revalidateForType } from "@/lib/admin/revalidate";

export const maxDuration = 60;

/**
 * Deletes a menu made here — irreversible, so it arrives with nothing but an id and
 * the decision is made from the store: `deleteMenu` refuses the site's own menus,
 * Shopify's defaults, and a menu a Theme Builder layout (published or draft) shows.
 */
const schema = z.strictObject({
  operation: z.literal("menuDelete"),
  id: menuId,
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "menu.delete", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) {
    audit({ action: "menu.delete", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "menuDelete") {
    audit({ action: "menu.delete", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "menu.delete");
  if (!parsed.ok) {
    audit({ action: "menu.delete", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const deleted = await deleteMenu(parsed.data.id);
    audit({ action: "menu.delete", actor: staff.email, outcome: "ok", type: "menu", entryId: deleted.id, ip });
    await revalidateForType("menu");
    return NextResponse.json(deleted);
  } catch (error) {
    const rule = menuRuleResponse(error);
    if (rule) {
      audit({ action: "menu.delete", actor: staff.email, outcome: "denied", reason: "RULE", ip });
      return rule;
    }
    audit({ action: "menu.delete", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("menu.delete", error);
  }
}
