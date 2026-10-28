import { NextResponse } from "next/server";

import { BRAND } from "@/lib/brand";
import { contactSchema } from "@/lib/contact/schema";
import { sendEmail } from "@/lib/email/client";
import { notificationRecipients } from "@/lib/email/notification-recipients";
import { saveContactMessage } from "@/lib/inbox/save";
import { readPublicForm } from "@/lib/public-form";

/**
 * The Contact page form: emailed to the team (Settings → Email notifications) and
 * kept in the panel (Inbox → Messages) — each with the other as its safety net. The
 * visitor is thanked when at least one of the two worked; only when both failed is
 * the message lost, and then they are told so.
 */
export async function POST(request: Request) {
  // Rate limits and a size cap before anything is read — see lib/public-form.ts.
  const body = await readPublicForm(request, "contact", 16_000);
  if (!body.ok) return body.response;
  const payload = body.value;

  const parsed = contactSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "That message is not valid." },
      { status: 400 },
    );
  }

  const { firstName, lastName, email, phone, company, inquiryType, message } = parsed.data;
  const notify = await notificationRecipients("contact");

  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rows: [string, string][] = [
    ["Name", `${firstName} ${lastName}`],
    ["Email", email],
    ["Phone", phone],
    ...(company ? ([["Company", company]] as [string, string][]) : []),
    ["Type", inquiryType],
  ];

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${BRAND.ink};">
      <h1 style="color:${BRAND.heading};font-size:20px;">New contact message</h1>
      ${rows.map(([label, value]) => `<p style="margin:4px 0;"><strong>${label}:</strong> ${escape(value)}</p>`).join("")}
      <hr style="border:0;border-top:1px solid ${BRAND.border};margin:18px 0;" />
      <p style="white-space:pre-line;">${escape(message)}</p>
    </div>
  `;

  // 1. The team's email. Its outcome is recorded on the saved message, in words.
  let emailed = false;
  let emailStatus: string;
  if (!notify.to.length) {
    emailStatus = "Not sent: nobody is set to receive contact messages.";
    console.warn(`[contact] message from ${email} was not emailed: ${notify.source}.`);
  } else {
    const result = await sendEmail({
      to: notify.to,
      subject: `${inquiryType} — ${firstName} ${lastName}`,
      html,
      text: `${rows.map(([l, v]) => `${l}: ${v}`).join("\n")}\n\n${message}`,
      // "Reply" in the team's mailbox answers the visitor, not the website.
      replyTo: email,
    }).catch((error: unknown) => ({ ok: false as const, skipped: false as const, error: String(error) }));
    if (result.ok && !result.skipped) {
      emailed = true;
      emailStatus = `Sent to ${notify.to.join(", ")}`;
    } else {
      emailStatus = result.ok ? `Not sent: email is not set up (${result.reason}).` : `Not sent: ${result.error}`;
      console.error(`[contact] message from ${email} was not emailed: ${emailStatus}`);
    }
  }

  // 2. The panel's copy (Inbox → Messages), so nothing depends on the email arriving.
  let saved = false;
  try {
    await saveContactMessage({
      name: `${firstName} ${lastName}`,
      email,
      phone,
      company: company ?? "",
      topic: inquiryType,
      message,
      receivedAt: new Date(),
      emailStatus,
    });
    saved = true;
  } catch (error) {
    console.error("[api/contact] could not save the message", error);
  }

  // Either one is enough for the message to reach someone.
  if (saved || emailed) return NextResponse.json({ message: "Thanks — we'll be in touch." });
  return NextResponse.json(
    { message: "We could not send that just now. Please email us directly." },
    { status: 502 },
  );
}
