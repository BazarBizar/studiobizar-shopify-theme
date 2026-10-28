import { NextResponse } from "next/server";

import { subscribeToNewsletter } from "@/lib/inbox/save";
import { readPublicForm } from "@/lib/public-form";

/**
 * The newsletter sign-up. Kept in the panel (Inbox → Subscribers), one entry per
 * address, from where the list can be exported to whatever sends the newsletter.
 *
 * A sign-up is only confirmed once it is stored: a visitor told "you are on the list"
 * must be on it.
 */
export async function POST(request: Request) {
  // Rate limits and a size cap before anything is read — see lib/public-form.ts.
  const body = await readPublicForm(request, "newsletter", 2_000);
  if (!body.ok) return body.response;
  const email = (body.value as { email?: unknown } | null)?.email;

  if (typeof email !== "string" || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  // The page it was sent from, for the panel — a path on this site only.
  let source = "";
  try {
    const referer = new URL(request.headers.get("referer") ?? "");
    if (referer.host === new URL(request.url).host) source = referer.pathname;
  } catch {
    // No referer, or not a URL.
  }

  try {
    const result = await subscribeToNewsletter(email, source);
    return NextResponse.json({
      message: result === "again" ? "You are already on the list — thank you." : "Thanks — you are on the list.",
    });
  } catch (error) {
    console.error("[api/newsletter] could not save the sign-up", error);
    return NextResponse.json(
      { message: "We could not sign you up just now. Please try again in a moment." },
      { status: 502 },
    );
  }
}
