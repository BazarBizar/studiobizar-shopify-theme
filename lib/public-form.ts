import "server-only";

import { NextResponse } from "next/server";

import { readJson } from "@/lib/admin/api";
import { limit, type RateLimitResult } from "@/lib/admin/rate-limit";
import { clientIp } from "@/lib/admin/request";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

/**
 * The visitor-facing forms (contact, inquiry, newsletter): anyone can post them, and
 * each one causes mail — to the shop, and for an inquiry to the address typed in. So
 * before any of that work:
 *
 *   per visitor     5, then one a minute — keyed by ip, which a script can make up,
 *   per form        so also a ceiling on everyone together: 60, then one every 15s,
 *   size            the body is read up to a cap, never buffered whole first,
 *   bot trap        a filled honeypot field is thanked and dropped (lib/honeypot.ts).
 *
 * And once the address is known, `limitRecipient`: 3 to one address, then one every
 * 20 minutes — the shop's name cannot be used to fill a stranger's inbox.
 *
 * A refusal says so plainly and when to try again; it never says which limit it was.
 */

export type PublicForm = "contact" | "inquiry" | "newsletter";

const TOO_MANY = "Too many messages just now — please try again in a minute.";

function refused(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { message: TOO_MANY },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

/** The posted JSON, or the response to send instead. */
export async function readPublicForm(
  request: Request,
  form: PublicForm,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  // Both charged every time, so neither can be spent down behind the other.
  const visitor = await limit("form", `${form}:${clientIp(request.headers)}`);
  const everyone = await limit("formAll", form);
  if (!visitor.ok) return { ok: false, response: refused(visitor) };
  if (!everyone.ok) return { ok: false, response: refused(everyone) };

  const body = await readJson(request, maxBytes);
  if (!body.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: body.code === "PAYLOAD_TOO_LARGE" ? "That message is too long." : "Send a JSON body." },
        { status: body.code === "PAYLOAD_TOO_LARGE" ? 413 : 400 },
      ),
    };
  }
  // The bot trap (lib/honeypot.ts): answered as a success, and nothing is sent or stored.
  const trap = (body.value as Record<string, unknown> | null)?.[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") {
    console.warn(`[${form}] dropped a submission that filled the bot trap`);
    return { ok: false, response: NextResponse.json({ message: "Thanks — we'll be in touch." }) };
  }
  return { ok: true, value: body.value };
}

/** For a form that writes to an address the visitor typed: null to go ahead, or the response to send. */
export async function limitRecipient(form: PublicForm, email: string): Promise<NextResponse | null> {
  const result = await limit("formRecipient", `${form}:${email.trim().toLowerCase()}`);
  return result.ok ? null : refused(result);
}
