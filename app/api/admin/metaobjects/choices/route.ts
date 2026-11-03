import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { addChoiceInput, addFieldChoice, ChoiceError } from "@/lib/admin/choices";
import { NotAllowedError } from "@/lib/admin/metaobjects";

/**
 * "Add a choice" on a field with a fixed list (`lib/admin/choices.ts`) — e.g. a new
 * project Category. Returns the whole list as it now is.
 */
const schema = addChoiceInput.extend({ operation: z.literal("choiceAdd") });

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "choice.add", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");
  if ((body.value as { operation?: unknown } | null)?.operation !== "choiceAdd") {
    audit({ action: "choice.add", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }

  const parsed = validate(schema, body.value, "choice.add");
  if (!parsed.ok) {
    audit({ action: "choice.add", actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }

  const { type, key, choice } = parsed.data;
  try {
    const choices = await addFieldChoice({ type, key, choice });
    audit({ action: "choice.add", actor: staff.email, outcome: "ok", type, fields: [key], ip });
    return NextResponse.json({ choices });
  } catch (error) {
    if (error instanceof ChoiceError || error instanceof NotAllowedError) {
      const code = error instanceof ChoiceError ? error.code : "NOT_ALLOWED";
      audit({ action: "choice.add", actor: staff.email, outcome: "denied", reason: code, ip });
      return fail(code, error.message);
    }
    audit({ action: "choice.add", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("choice.add", error);
  }
}
