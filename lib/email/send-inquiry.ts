import "server-only";

import { render } from "@react-email/render";

import { BRAND } from "@/lib/brand";
import { sendEmail, type SendResult } from "@/lib/email/client";
import { InquiryEmail, type InquiryEmailProps } from "@/lib/email/templates/inquiry-email";
import { generateInquiryPdf } from "@/lib/pdf/inquiry-pdf";
import type { InquirySubmission } from "@/lib/inquiry/schema";

/**
 * Builds the PDF and sends both messages. Every failure is caught and reported
 * rather than thrown: the inquiry is already stored on Shopify by the time this
 * runs, and a mail outage must not make a stored inquiry look unsent.
 */
export async function sendInquiryEmails({
  submission,
  inquiryId,
  submittedAt,
}: {
  submission: InquirySubmission;
  inquiryId: string;
  submittedAt: Date;
}): Promise<{
  pdf: "ok" | "failed";
  customer: SendResult | { ok: false; skipped: false; error: string };
  internal: SendResult | { ok: false; skipped: false; error: string } | { skipped: "no-recipient" };
}> {
  const props: InquiryEmailProps = {
    inquiryId,
    submittedAt,
    name: submission.name,
    company: submission.company || undefined,
    email: submission.email,
    phone: submission.phone || undefined,
    message: submission.message || undefined,
    items: submission.items,
    audience: "customer",
  };

  // A PDF failure must not stop the emails — they carry the same table inline.
  let attachments: { filename: string; content: Buffer }[] | undefined;
  let pdfStatus: "ok" | "failed" = "ok";

  try {
    const bytes = await generateInquiryPdf({
      inquiryId,
      submittedAt,
      customer: {
        name: submission.name,
        company: submission.company || undefined,
        email: submission.email,
        phone: submission.phone || undefined,
      },
      items: submission.items,
      message: submission.message || undefined,
    });
    attachments = [{ filename: `${inquiryId}.pdf`, content: Buffer.from(bytes) }];
  } catch (error) {
    pdfStatus = "failed";
    console.error(`[inquiry ${inquiryId}] PDF generation failed`, error);
  }

  const customerHtml = await render(InquiryEmail(props));
  const customerText = await render(InquiryEmail(props), { plainText: true });

  const internalProps: InquiryEmailProps = { ...props, audience: "internal" };
  const internalHtml = await render(InquiryEmail(internalProps));
  const internalText = await render(InquiryEmail(internalProps), { plainText: true });

  const notify = process.env.INQUIRY_NOTIFY_EMAIL;

  const [customer, internal] = await Promise.all([
    sendEmail({
      to: submission.email,
      subject: `Your ${BRAND.name} inquiry — ${inquiryId}`,
      html: customerHtml,
      text: customerText,
      attachments,
    }).catch((error: unknown) => ({
      ok: false as const,
      skipped: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    })),

    notify
      ? sendEmail({
          to: notify,
          subject: `New inquiry ${inquiryId} — ${submission.name}`,
          html: internalHtml,
          text: internalText,
          attachments,
        }).catch((error: unknown) => ({
          ok: false as const,
          skipped: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
        }))
      : Promise.resolve({ skipped: "no-recipient" as const }),
  ]);

  if (!notify) {
    console.warn(
      `[inquiry ${inquiryId}] INQUIRY_NOTIFY_EMAIL is not set — no internal notification sent.`,
    );
  }

  return { pdf: pdfStatus, customer, internal };
}
