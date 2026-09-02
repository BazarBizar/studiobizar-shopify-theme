import "server-only";

import { Resend } from "resend";

/**
 * Resend, configured from the environment. When `RESEND_API_KEY` is absent the
 * module does not throw — it logs what it would have sent and reports success,
 * so development runs without credentials. That is the brief's rule, and it is
 * also why `sendEmail` returns a `skipped` flag rather than a bare boolean:
 * callers must be able to tell "delivered" from "no provider configured".
 */

export type SendResult =
  | { ok: true; id: string | null; skipped: false }
  | { ok: true; id: null; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

export type Attachment = { filename: string; content: Buffer };

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const from = process.env.RESEND_FROM_EMAIL;
  const api = resend();

  if (!api || !from) {
    const reason = !api ? "RESEND_API_KEY is not set" : "RESEND_FROM_EMAIL is not set";
    console.warn(
      `[email] ${reason} — "${subject}" to ${Array.isArray(to) ? to.join(", ") : to} was not sent.`,
    );
    return { ok: true, id: null, skipped: true, reason };
  }

  try {
    const { data, error } = await api.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      attachments: attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
      })),
    });

    if (error) {
      console.error("[email] Resend rejected the message", error);
      return { ok: false, skipped: false, error: error.message };
    }

    return { ok: true, id: data?.id ?? null, skipped: false };
  } catch (error) {
    console.error("[email] send failed", error);
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
