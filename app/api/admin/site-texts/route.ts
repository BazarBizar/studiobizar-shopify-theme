import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { revalidateForType } from "@/lib/admin/revalidate";
import { saveSiteTexts, SiteTextsError, siteTextsInput } from "@/lib/admin/site-texts";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/**
 * Saves the site's changed wording (Settings → Site texts; `lib/admin/site-texts.ts`) — every
 * change at once, named by the digest it was edited from.
 */
const schema = siteTextsInput.extend({ operation: z.literal("siteTextsSave") });

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "site_texts.save", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 64 * 1024);
  if (!body.ok) {
    audit({ action: "site_texts.save", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "That change is too large." : "Send a JSON body.");
  }

  if ((body.value as { operation?: unknown } | null)?.operation !== "siteTextsSave") {
    audit({ action: "site_texts.save", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "site_texts.save");
  if (!parsed.ok) {
    audit({ action: "site_texts.save", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  try {
    const { digest, texts } = parsed.data;
    const saved = await saveSiteTexts({ digest, texts }, staff.email);
    audit({
      action: "site_texts.save",
      actor: staff.email,
      outcome: "ok",
      type: "site_texts",
      // The keys, not the words: what matters afterwards is which texts changed.
      fields: Object.keys(saved.changes),
      ip,
    });
    await revalidateForType("site_texts");
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof SiteTextsError) {
      audit({ action: "site_texts.save", actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code, error.message);
    }
    audit({ action: "site_texts.save", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("site_texts.save", error);
  }
}
