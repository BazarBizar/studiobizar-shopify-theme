import { NextResponse } from "next/server";

import { BRAND } from "@/lib/brand";
import { contactSchema } from "@/lib/contact/schema";
import { sendEmail } from "@/lib/email/client";

/**
 * The Contact page form. Unlike an inquiry there is nothing to store — the
 * message only needs to reach a person — so this is email-only.
 *
 * Follows the same degradation rule as the rest: with no Resend key the send is
 * logged and reported as success, so development runs without credentials.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "That message is not valid." },
      { status: 400 },
    );
  }

  const { firstName, lastName, email, phone, company, inquiryType, message } = parsed.data;
  const notify = process.env.INQUIRY_NOTIFY_EMAIL;

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

  try {
    if (!notify) {
      console.warn(
        `[contact] INQUIRY_NOTIFY_EMAIL is not set — message from ${email} was not delivered.`,
      );
    } else {
      const result = await sendEmail({
        to: notify,
        subject: `${inquiryType} — ${firstName} ${lastName}`,
        html,
        text: `${rows.map(([l, v]) => `${l}: ${v}`).join("\n")}\n\n${message}`,
      });
      if (!result.ok) throw new Error(result.error);
    }

    return NextResponse.json({ message: "Thanks — we'll be in touch." });
  } catch (error) {
    console.error("[api/contact]", error);
    return NextResponse.json(
      { message: "We could not send that just now. Please email us directly." },
      { status: 502 },
    );
  }
}
