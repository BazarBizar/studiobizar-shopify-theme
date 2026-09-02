import { NextResponse } from "next/server";

/**
 * No marketing provider is wired up yet. Following the same convention the
 * brief sets for Resend: when the integration is absent, log and succeed so
 * development is not blocked — but never claim a subscription was stored.
 *
 * Wire the real provider here and the form needs no changes.
 */
export async function POST(request: Request) {
  let email: unknown;

  try {
    ({ email } = (await request.json()) as { email?: unknown });
  } catch {
    return NextResponse.json({ message: "Send a JSON body with an email." }, { status: 400 });
  }

  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  console.warn(
    `[newsletter] No provider configured — "${email}" was not stored. Wire one up in app/api/newsletter/route.ts.`,
  );

  return NextResponse.json({ message: "Thanks — we'll be in touch." });
}
