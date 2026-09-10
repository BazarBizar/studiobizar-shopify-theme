"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/admin/auth";

export type LoginState = { error: string | null };

/**
 * Only ever redirect back to an admin path of our own. `from` arrives in the
 * query string, so without this check the login page is an open redirector:
 * `/staff/login?from=https://evil.example` would send a freshly authenticated
 * staff member straight there.
 */
function safeRedirect(from: unknown): string {
  if (typeof from !== "string") return "/admin";
  if (!from.startsWith("/admin")) return "/admin";
  // `//host` is a protocol-relative URL, which browsers treat as absolute.
  if (from.startsWith("//")) return "/admin";
  return from;
}

export async function staffLogin(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const redirectTo = safeRedirect(formData.get("from"));

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
  } catch (error) {
    /**
     * One message for every failure — wrong password, unknown email, an address
     * that was removed from the allowlist, too many attempts. Telling them apart
     * would turn this form into a way to enumerate who has access.
     *
     * A successful `signIn` also throws, with Next's redirect signal; that is not
     * an `AuthError`, so it falls through to the rethrow and does its job.
     */
    if (error instanceof AuthError) {
      return { error: "That email and password did not match." };
    }
    throw error;
  }

  return { error: null };
}
