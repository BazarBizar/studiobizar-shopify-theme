import { NextResponse } from "next/server";

import { sendInquiryEmails } from "@/lib/email/send-inquiry";
import { inquirySubmissionSchema } from "@/lib/inquiry/schema";
import { saveInquiry } from "@/lib/inquiry/submit";
import { limitRecipient, readPublicForm } from "@/lib/public-form";

/**
 * 1. Validate with the same schema the form uses.
 * 2. Generate the inquiry ID.
 * 3. Store it on Shopify — authoritative; a failure here fails the request.
 * 4/5. PDF + email (Step 6) attach here and must never fail the request.
 */
export async function POST(request: Request) {
  // Rate limits and a size cap before anything is read — see lib/public-form.ts.
  const body = await readPublicForm(request, "inquiry", 128_000);
  if (!body.ok) return body.response;
  const payload = body.value;

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

  // The confirmation goes to the address typed in: a few to one address, then wait.
  const tooMany = await limitRecipient("inquiry", parsed.data.email);
  if (tooMany) return tooMany;

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
