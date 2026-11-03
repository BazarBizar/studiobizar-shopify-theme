import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { revalidateForType } from "@/lib/admin/revalidate";
import { saveShopCategories, ShopCategoriesError, shopCategoriesInput } from "@/lib/admin/shop-categories";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * Saves Shop All's category chips (Content → Shop categories; `lib/admin/shop-categories.ts`)
 * — the whole list at once, named by the digest it was edited from.
 */
const schema = shopCategoriesInput.extend({ operation: z.literal("shopCategoriesSave") });

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "shop_categories.save", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 64 * 1024);
  if (!body.ok) {
    audit({ action: "shop_categories.save", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "shopCategoriesSave") {
    audit({ action: "shop_categories.save", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "shop_categories.save");
  if (!parsed.ok) {
    audit({ action: "shop_categories.save", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const { digest, categories } = parsed.data;
    const saved = await saveShopCategories({ digest, categories }, staff.email);
    audit({
      action: "shop_categories.save",
      actor: staff.email,
      outcome: "ok",
      type: "shop_categories",
      fields: [`${saved.categories.length} categories`],
      ip,
    });
    await revalidateForType("shop_categories");
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof ShopCategoriesError) {
      audit({ action: "shop_categories.save", actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code, error.message);
    }
    audit({ action: "shop_categories.save", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("shop_categories.save", error);
  }
}
