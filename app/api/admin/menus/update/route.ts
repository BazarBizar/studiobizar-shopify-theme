import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { updateMenu } from "@/lib/admin/menus";
import { revalidateForType } from "@/lib/admin/revalidate";

/**
 * EDIT ONLY. `menuCreate` and `menuDelete` are not in the operation allowlist: a
 * menu exists because a component asks for it by handle, so a new one is
 * reachable by nothing, and deleting one drops that component to its
 * `FALLBACK_NAV` without saying so.
 *
 * `menuUpdate` REPLACES the item tree rather than patching it, which makes an
 * incomplete payload destructive rather than partial. Two things guard that:
 * `items` must be non-empty, and the editor always sends every item it holds.
 * Emptying a menu deliberately is therefore not possible here, and that is the
 * intended trade — no storefront nav is improved by having nothing in it.
 */

/** Two levels, because that is what the header and the drawer render. */
const item = z.strictObject({
  /** Absent for an item being added. */
  id: z.string().regex(/^gid:\/\/shopify\/MenuItem\/\d+$/).optional(),
  title: z.string().min(1).max(255),
  type: z.enum([
    "FRONTPAGE",
    "CATALOG",
    "COLLECTIONS",
    "SEARCH",
    "HTTP",
    "PAGE",
    "COLLECTION",
    "SHOP_POLICY",
    "PRODUCT",
    "BLOG",
    "ARTICLE",
    "CUSTOMER_ACCOUNT_PAGE",
  ]),
  url: z.string().max(2048).nullable().optional(),
  resourceId: z.string().max(255).nullable().optional(),
});

const schema = z.strictObject({
  operation: z.literal("menuUpdate"),
  id: z.string().regex(/^gid:\/\/shopify\/Menu\/\d+$/, "not a menu id"),
  title: z.string().min(1).max(255),
  handle: z.string().min(1).max(255),
  items: z
    .array(item.extend({ items: z.array(item).max(50).optional() }))
    .min(1, "a menu cannot be emptied here")
    .max(50),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "menu.update", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, 256 * 1024);
  if (!body.ok) {
    audit({ action: "menu.update", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(
      body.code,
      body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.",
    );
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "menuUpdate") {
    audit({
      action: "menu.update",
      actor: staff.email,
      outcome: "denied",
      reason: "OPERATION_MISMATCH",
      ip,
    });
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
      // The item count, not the titles: a nav label is copy, and the log outlives
      // the request. What matters afterwards is whether the tree grew or shrank.
      fields: [`${items.length} top-level items`],
      ip,
    });

    await revalidateForType("menu");
    return NextResponse.json(updated);
  } catch (error) {
    audit({ action: "menu.update", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("menu.update", error);
  }
}
