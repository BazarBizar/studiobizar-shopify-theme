import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { EmailSettingsError, emailSettingsInput, saveEmailSettings } from "@/lib/admin/email-settings";
import { BRAND } from "@/lib/brand";
import { explainSendError, sendEmail } from "@/lib/email/client";

/**
 * How the site sends email, from the panel (Settings → Email; `lib/email/settings.ts`):
 *
 *   emailSave  the Resend key (sealed, never returned), sender name and address, reply-to
 *   emailTest  one message to an address the staff member types, with the saved settings —
 *              a refusal comes back in plain words with what to do about it
 *
 * Any signed-in staff member, like the rest of Settings. The key arrives here and is
 * stored sealed; it is never logged or sent back.
 */

const schema = z.discriminatedUnion("operation", [
  emailSettingsInput.extend({ operation: z.literal("emailSave") }),
  z.strictObject({ operation: z.literal("emailTest"), to: z.email("Enter the address to send the test to.").max(200) }),
]);

const ACTIONS = { emailSave: "email.settings", emailTest: "email.test" } as const;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "email", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "email", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
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
    if (input.operation === "emailSave") {
      await saveEmailSettings(
        { fromName: input.fromName, fromEmail: input.fromEmail, replyTo: input.replyTo, apiKey: input.apiKey, removeKey: input.removeKey },
        staff.email,
      );
      audit({ action, actor: staff.email, outcome: "ok", type: "email", ip });
      return NextResponse.json({ ok: true });
    }

    const result = await sendEmail({
      to: input.to,
      subject: `Test email from ${BRAND.name}`,
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;color:${BRAND.ink};">
          <h1 style="color:${BRAND.heading};font-size:20px;">Email works</h1>
          <p>This is a test sent from the ${BRAND.name} admin by ${staff.email}.</p>
          <p>Contact form messages, inquiries and their confirmations will be sent the same way.</p>
        </div>
      `,
      text: `Email works.\n\nThis is a test sent from the ${BRAND.name} admin by ${staff.email}.`,
    });

    if (result.ok && !result.skipped) {
      audit({ action, actor: staff.email, outcome: "ok", type: "email", ip });
      return NextResponse.json({ ok: true, id: result.id });
    }
    audit({ action, actor: staff.email, outcome: "denied", reason: result.ok ? "NOT_SET_UP" : "PROVIDER", ip });
    if (result.ok) {
      return fail("INVALID", "Email is not set up yet.", {
        explanation: {
          title: "Email is not set up yet.",
          fix:
            result.reason === "no Resend API key is set"
              ? "Paste your Resend API key above and press Save."
              : "Fill in the sender address above and press Save.",
        },
      });
    }
    return fail("INVALID", "Resend did not send it.", { explanation: { ...explainSendError(result.error), detail: result.error } });
  } catch (error) {
    if (error instanceof EmailSettingsError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code, error.message);
    }
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
