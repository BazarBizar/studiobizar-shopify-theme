import { NextResponse } from "next/server";

import { sendInquiryEmails } from "@/lib/email/send-inquiry";
import { inquirySubmissionSchema } from "@/lib/inquiry/schema";
import { saveInquiry } from "@/lib/inquiry/submit";

/**
 * 1. Validate with the same schema the form uses.
 * 2. Generate the inquiry ID.
 * 3. Store it on Shopify — authoritative; a failure here fails the request.
 * 4/5. PDF + email (Step 6) attach here and must never fail the request.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = inquirySubmissionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "That inquiry is not valid.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await saveInquiry(parsed.data);

    // The inquiry is stored from here on. The PDF and the two emails are
    // enhancements: anything that goes wrong below is logged, never surfaced as
    // a failed submission, or a customer would send the same inquiry twice.
    try {
      const delivery = await sendInquiryEmails({
        submission: parsed.data,
        inquiryId: result.inquiryId,
        submittedAt: result.submittedAt,
      });

      if (delivery.pdf === "failed" || delivery.customer.ok === false) {
        console.error(`[api/inquiry] ${result.inquiryId} stored, but delivery degraded`, delivery);
      }
    } catch (error) {
      console.error(`[api/inquiry] ${result.inquiryId} stored, but email step threw`, error);
    }

    return NextResponse.json({ inquiryId: result.inquiryId });
  } catch (error) {
    console.error("[api/inquiry] could not store inquiry", error);
    return NextResponse.json(
      { message: "We could not send that just now. Please try again, or email us directly." },
      { status: 502 },
    );
  }
}
