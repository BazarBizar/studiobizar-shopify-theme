import { after, NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { dropInFreshRequest, revalidateForType } from "@/lib/admin/revalidate";
import {
  discardThemeDraft,
  publishTheme,
  rollbackTheme,
  saveThemeDraft,
  ThemeBuilderError,
} from "@/lib/admin/theme-builder";
import { getLiveThemeLayoutStamp } from "@/lib/shopify";
import { MAX_THEME_BYTES, themeContentSchema, type ThemeLayoutContent } from "@/lib/theme-builder/layout";

/**
 * The Theme Builder's four writes, one endpoint — the page builder's contract
 * (`app/api/admin/pages/builder/route.ts`) for the header and footer.
 *
 * `content` is validated against the strict layout schema — unknown elements,
 * unknown settings, unsafe links and colours that are not `#rrggbb` are refused
 * here, whatever the editor sent. The announcement bar and the pop-ups are part of
 * that content (`lib/theme-builder/promo.ts`), checked the same way.
 *
 * Only Publish drops the storefront cache, and it drops it twice: at once, and again
 * once the Storefront API serves the new layout (Shopify caches it for about half a
 * minute), so no page is left cached with the old header for an hour.
 */

export const maxDuration = 120;

const baseRevision = z.number().int().nonnegative();

const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("themeSaveDraft"), baseRevision, content: themeContentSchema }),
  z.strictObject({ operation: z.literal("themePublish"), baseRevision }),
  z.strictObject({ operation: z.literal("themeDiscard"), baseRevision }),
  z.strictObject({ operation: z.literal("themeRollback"), baseRevision }),
]);

const ACTIONS = {
  themeSaveDraft: "theme.save",
  themePublish: "theme.publish",
  themeDiscard: "theme.discard",
  themeRollback: "theme.rollback",
} as const;

function revalidateWhenLive(publishedAt: string, tags: string[]) {
  after(async () => {
    const deadline = Date.now() + 75_000;
    for (;;) {
      try {
        if ((await getLiveThemeLayoutStamp()) === publishedAt) break;
      } catch {
        // One missed poll, not a failed publish.
      }
      if (Date.now() + 3_000 > deadline) {
        console.warn("[theme-builder] Storefront still serving an older header and footer after 75s.");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    await dropInFreshRequest(tags);
  });
}

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "theme", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, MAX_THEME_BYTES + 16 * 1024);
  if (!body.ok) {
    audit({ action: "theme", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "The header and footer are too large to save." : "Send a JSON body.");
  }

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "theme", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
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
    let result: Record<string, unknown>;
    switch (input.operation) {
      case "themeSaveDraft":
        result = await saveThemeDraft(input.content as ThemeLayoutContent, input.baseRevision, staff.email);
        break;
      case "themePublish": {
        const published = await publishTheme(input.baseRevision, staff.email);
        const tags = await revalidateForType("theme", { settle: false });
        revalidateWhenLive(published.publishedAt, tags);
        result = published;
        break;
      }
      case "themeDiscard":
        result = await discardThemeDraft(input.baseRevision, staff.email);
        break;
      case "themeRollback":
        // Into the draft only — nothing a visitor sees changes until Publish.
        result = await rollbackTheme(input.baseRevision, staff.email);
        break;
    }
    audit({ action, actor: staff.email, outcome: "ok", type: "theme", ip });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ThemeBuilderError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      if (error.code === "CONFLICT") return fail("CONFLICT", error.message);
      if (error.code === "TOO_LARGE") return fail("PAYLOAD_TOO_LARGE", error.message);
      return fail("INVALID", error.message);
    }
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
