import "server-only";

import { Resend } from "resend";

import { emailConfig } from "@/lib/email/settings";

/**
 * Resend, configured from the panel (Settings → Email) with `.env` as the fallback —
 * see `lib/email/settings.ts`. When no API key or sender address is set the module does
 * not throw — it logs what it would have sent and reports success, so development runs
 * without credentials. That is the brief's rule, and it is also why `sendEmail` returns a
 * `skipped` flag rather than a bare boolean: callers must be able to tell "delivered"
 * from "no provider configured".
 */

export type SendResult =
  | { ok: true; id: string | null; skipped: false }
  | { ok: true; id: null; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

export type Attachment = { filename: string; content: Buffer };

/** One client per key: a key changed in the panel takes effect on the next send. */
let client: { key: string; api: Resend } | null = null;

function resend(key: string): Resend {
  if (client?.key !== key) client = { key, api: new Resend(key) };
  return client.api;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  /** Where a reply goes. Defaults to the reply-to address set in the panel. */
  replyTo?: string;
}): Promise<SendResult> {
  const config = await emailConfig();

  if (!config.apiKey || !config.from) {
    const reason = !config.apiKey ? "no Resend API key is set" : "no sender address is set";
    console.warn(
      `[email] ${reason} — "${subject}" to ${Array.isArray(to) ? to.join(", ") : to} was not sent.`,
    );
    return { ok: true, id: null, skipped: true, reason };
  }

  const reply = replyTo ?? config.replyTo ?? undefined;

  try {
    const { data, error } = await resend(config.apiKey).emails.send({
      from: config.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(reply ? { replyTo: reply } : {}),
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

/**
 * A Resend refusal in words a shop owner can act on, for the panel. Resend's own
 * messages name the fix but in a developer's terms; the original is kept as `detail`.
 */
export function explainSendError(message: string): { title: string; fix: string; link?: string } {
  const text = message.toLowerCase();
  // Before the domain check: this message also says "verify a domain".
  if (text.includes("testing emails") || text.includes("own email address")) {
    const owner = /own email address \(([^)\s]+)\)/i.exec(message)?.[1];
    return {
      title: "The test sender can only email you.",
      fix: `onboarding@resend.dev can only send to the address you signed up to Resend with${owner ? ` (${owner})` : ""}. Send the test there, or verify your own domain at Resend and use an address on it.`,
      link: "https://resend.com/domains",
    };
  }
  if (text.includes("associated domain with your api key")) {
    return {
      title: "Your domain is not verified at Resend yet.",
      fix: "This API key only sends from one domain, and Resend has not verified it. Open Resend → Domains, add the DNS records it shows at your domain host, wait until it says Verified, then send the test again.",
      link: "https://resend.com/domains",
    };
  }
  if (text.includes("domain is not verified") || text.includes("verify a domain") || text.includes("not verified")) {
    return {
      title: "Your sender address is not allowed yet.",
      fix: "Resend only sends from a domain you have verified. Add your domain at Resend (it gives you a few DNS records to add), wait until it says Verified, then send the test again.",
      link: "https://resend.com/domains",
    };
  }
  if (text.includes("api key is invalid") || text.includes("invalid api key") || text.includes("api_key")) {
    return {
      title: "Resend does not accept this API key.",
      fix: "Make a new key at Resend → API Keys (Sending access is enough), paste it here and press Save.",
      link: "https://resend.com/api-keys",
    };
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return { title: "Resend is asking us to slow down.", fix: "Wait a minute and try again." };
  }
  if (text.includes("daily") || text.includes("quota")) {
    return {
      title: "Your Resend plan has reached its sending limit.",
      fix: "Check your plan at Resend, or wait until tomorrow.",
      link: "https://resend.com/settings/billing",
    };
  }
  return { title: "Resend did not send it.", fix: "Check the settings above and try again." };
}
