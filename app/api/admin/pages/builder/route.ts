import { after, NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import {
  BuilderError,
  discardDraft,
  publish,
  rollback,
  saveDraft,
  waitForStorefront,
} from "@/lib/admin/page-builder";
import { revalidateForType } from "@/lib/admin/revalidate";
import { documentContentSchema, MAX_DOCUMENT_BYTES } from "@/lib/page-builder/document";

/**
 * The page builder's four writes, one endpoint.
 *
 * `content` is validated against the section registry's strict schemas
 * (`lib/page-builder/document.ts`) — unknown section types, unknown settings,
 * unsafe links and off-CDN images are all refused here, whatever the editor sent.
 *
 * Only publish and rollback drop the storefront cache: a draft save changes
 * nothing a visitor can see, so it has no business rebuilding public pages.
 *
 * They drop it TWICE: at once, and again from `after()` once the Storefront API
 * is serving the new version — see `waitForStorefront` for why the first drop
 * alone can leave the old page cached for an hour. The response does not wait
 * for that; the operator is told the page is live within about half a minute.
 */

/** Room for `after()` to wait out Shopify's cache (at most 75s) once the response is sent. */
export const maxDuration = 120;

function revalidateWhenLive(handle: string, publishedAt: string) {
  after(async () => {
    const landed = await waitForStorefront(handle, { publishedAt });
    if (!landed) console.warn(`[page-builder] /${handle}: Storefront still serving an older version after 75s.`);
    await revalidateForType("page");
  });
}

const id = z.string().regex(/^gid:\/\/shopify\/Page\/\d+$/, "not a page id");
const baseRevision = z.number().int().nonnegative();

const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("builderSaveDraft"), id, baseRevision, content: documentContentSchema }),
  z.strictObject({ operation: z.literal("builderPublish"), id, baseRevision }),
  z.strictObject({ operation: z.literal("builderDiscard"), id, baseRevision }),
  z.strictObject({ operation: z.literal("builderRollback"), id, baseRevision }),
]);

const ACTIONS = {
  builderSaveDraft: "page.builder.save",
  builderPublish: "page.builder.publish",
  builderDiscard: "page.builder.discard",
  builderRollback: "page.builder.rollback",
} as const;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "page.builder", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  // A little headroom over the document cap for the envelope around it.
  const body = await readJson(request, MAX_DOCUMENT_BYTES + 16 * 1024);
  if (!body.ok) {
    audit({ action: "page.builder", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "This page is too large to save." : "Send a JSON body.");
  }

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "page.builder", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
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
      case "builderSaveDraft":
        result = await saveDraft(input.id, input.content, input.baseRevision, staff.email);
        break;
      case "builderPublish": {
        const published = await publish(input.id, input.baseRevision, staff.email);
        await revalidateForType("page");
        revalidateWhenLive(published.handle, published.publishedAt);
        result = published;
        break;
      }
      case "builderDiscard":
        result = await discardDraft(input.id, input.baseRevision, staff.email);
        break;
      case "builderRollback": {
        const restored = await rollback(input.id, input.baseRevision, staff.email);
        await revalidateForType("page");
        revalidateWhenLive(restored.handle, restored.publishedAt);
        result = restored;
        break;
      }
    }

    audit({ action, actor: staff.email, outcome: "ok", type: "page", entryId: input.id, ip });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BuilderError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });

      if (error.code === "CONFLICT") return fail("CONFLICT", error.message);
      if (error.code === "NOT_READY") return fail("INVALID", error.message, { problems: error.problems });
      if (error.code === "TOO_LARGE") return fail("PAYLOAD_TOO_LARGE", error.message);
      if (error.code === "NOT_FOUND") return fail("BAD_REQUEST", error.message);
      return fail("NOT_ALLOWED", error.message);
    }

    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
