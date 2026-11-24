import { after, NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { dropInFreshRequest, revalidateForType } from "@/lib/admin/revalidate";
import {
  discardTemplateDraft,
  getTemplateState,
  publishTemplate,
  rollbackTemplate,
  saveTemplateDraft,
  TemplateError,
  unpublishTemplate,
} from "@/lib/admin/templates";
import { documentContentSchema, MAX_DOCUMENT_BYTES } from "@/lib/page-builder/document";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/page-builder/template-kinds";
import { getLiveTemplateStamp } from "@/lib/shopify";

/**
 * Website → Templates: the writes, one endpoint — the page builder's contract
 * (`app/api/admin/pages/builder/route.ts`) for the templates of the product,
 * collection, project and designer pages and the lists.
 *
 * `content` goes through the section registry's strict schemas, and a template's own
 * sections are accepted only in their own template (`lib/admin/templates.ts`).
 *
 * Publish and "stop using" change what visitors see, so they drop the template's cache
 * tag — at once, and again once the Storefront API serves the new copy (Shopify caches
 * it for about half a minute).
 */

export const maxDuration = 120;

const kind = z.enum(TEMPLATE_KINDS);
const baseRevision = z.number().int().nonnegative();

const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("templateSaveDraft"), kind, baseRevision, content: documentContentSchema }),
  z.strictObject({ operation: z.literal("templatePublish"), kind, baseRevision }),
  z.strictObject({ operation: z.literal("templateDiscard"), kind, baseRevision }),
  z.strictObject({ operation: z.literal("templateRollback"), kind, baseRevision }),
  z.strictObject({ operation: z.literal("templateUnpublish"), kind, baseRevision }),
  // The draft revision now — the editor asks on open, as a page's does.
  z.strictObject({ operation: z.literal("templateRevision"), kind }),
]);

const ACTIONS = {
  templateSaveDraft: "template.save",
  templatePublish: "template.publish",
  templateDiscard: "template.discard",
  templateRollback: "template.rollback",
  templateUnpublish: "template.unpublish",
  templateRevision: "template.revision",
} as const;

function revalidateWhenLive(template: TemplateKind, expected: string | null, tags: string[]) {
  after(async () => {
    const deadline = Date.now() + 75_000;
    for (;;) {
      try {
        if ((await getLiveTemplateStamp(template)) === expected) break;
      } catch {
        // One missed poll, not a failed publish.
      }
      if (Date.now() + 3_000 > deadline) {
        console.warn(`[templates] Storefront still serving an older ${template} template after 75s.`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    await dropInFreshRequest(tags);
  });
}

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "template", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  const body = await readJson(request, MAX_DOCUMENT_BYTES + 16 * 1024);
  if (!body.ok) {
    audit({ action: "template", actor: staff.email, outcome: "invalid", reason: body.code, ip });
    return fail(body.code, body.code === "PAYLOAD_TOO_LARGE" ? "This template is too large to save." : "Send a JSON body.");
  }

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "template", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
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
      case "templateSaveDraft":
        result = await saveTemplateDraft(input.kind, input.content, input.baseRevision, staff.email);
        break;
      case "templatePublish": {
        const published = await publishTemplate(input.kind, input.baseRevision, staff.email);
        const tags = await revalidateForType("template", { settle: false, handle: input.kind });
        revalidateWhenLive(input.kind, published.publishedAt, tags);
        result = published;
        break;
      }
      case "templateUnpublish": {
        result = await unpublishTemplate(input.kind, input.baseRevision, staff.email);
        const tags = await revalidateForType("template", { settle: false, handle: input.kind });
        revalidateWhenLive(input.kind, null, tags);
        break;
      }
      case "templateDiscard":
        result = await discardTemplateDraft(input.kind, input.baseRevision, staff.email);
        break;
      case "templateRollback":
        // Into the draft only — nothing a visitor sees changes until Publish.
        result = await rollbackTemplate(input.kind, input.baseRevision, staff.email);
        break;
      case "templateRevision":
        result = { revision: (await getTemplateState(input.kind)).draft.meta.revision };
        break;
    }

    if (input.operation !== "templateRevision") {
      audit({ action, actor: staff.email, outcome: "ok", type: "template", entryId: input.kind, ip });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TemplateError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      if (error.code === "CONFLICT") return fail("CONFLICT", error.message);
      if (error.code === "NOT_READY") return fail("INVALID", error.message, { problems: error.problems });
      if (error.code === "TOO_LARGE") return fail("PAYLOAD_TOO_LARGE", error.message);
      return fail("NOT_ALLOWED", error.message);
    }

    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
