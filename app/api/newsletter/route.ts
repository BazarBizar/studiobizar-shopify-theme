import { NextResponse } from "next/server";

import { readPublicForm } from "@/lib/public-form";

/**
 * No marketing provider is wired up yet. Following the same convention the
 * brief sets for Resend: when the integration is absent, log and succeed so
 * development is not blocked — but never claim a subscription was stored.
 *
 * Wire the real provider here and the form needs no changes.
 */
export async function POST(request: Request) {
  // Rate limits and a size cap before anything is read — see lib/public-form.ts.
  const body = await readPublicForm(request, "newsletter", 2_000);
  if (!body.ok) return body.response;
  const email = (body.value as { email?: unknown } | null)?.email;

  if (typeof email !== "string" || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  console.warn(
    `[newsletter] No provider configured — "${email}" was not stored. Wire one up in app/api/newsletter/route.ts.`,
  );

  return NextResponse.json({ message: "Thanks — we'll be in touch." });
}
