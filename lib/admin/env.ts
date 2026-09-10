import "server-only";

import { z } from "zod";

/**
 * Every secret the admin panel needs, parsed in one place.
 *
 * Two things about this module are deliberate and easy to "simplify" into bugs:
 *
 *  1. The parse is LAZY. `next build` imports this module while collecting page
 *     data, long before any request exists. Parsing at module load would fail
 *     the build on a machine that has no admin env set — with a stack trace
 *     pointing at a page component rather than at the missing key.
 *
 *  2. Failures name the KEY, never the VALUE. An env error surfaces in logs and
 *     sometimes in a 500 body; echoing the value there would leak the token it
 *     is complaining about.
 */

/** An unset var and a var set to "" mean the same thing: not configured.
 *  Without this, one stray blank line in `.env` fails the whole schema —
 *  including the Shopify and auth keys that were set correctly. */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const required = (key: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string({ error: `${key} is not set` }).min(1, `${key} is empty`),
  );

const schema = z.object({
  SHOPIFY_STORE_DOMAIN: required("SHOPIFY_STORE_DOMAIN"),
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: required("SHOPIFY_ADMIN_API_ACCESS_TOKEN"),
  SHOPIFY_API_VERSION: optionalString,

  /** Comma-separated. The allowlist is the whole authorisation model: a valid
   *  password for an email that is not on this list is still a failed login. */
  ADMIN_ALLOWED_EMAILS: required("ADMIN_ALLOWED_EMAILS"),
  /** `scrypt:N:r:p:<salt-b64>:<hash-b64>` — see lib/admin/password.ts. */
  ADMIN_PASSWORD_HASH: required("ADMIN_PASSWORD_HASH"),
  /** Signs the staff session cookie. Auth.js reads this name by convention. */
  AUTH_SECRET: required("AUTH_SECRET").pipe(
    z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ),
});

export class AdminEnvError extends Error {
  constructor(missing: string[]) {
    super(`Admin panel env is incomplete: ${missing.join("; ")}`);
    this.name = "AdminEnvError";
  }
}

type AdminEnv = z.infer<typeof schema> & { apiVersion: string };

let cached: AdminEnv | null = null;

/** Falls back to the same version the storefront client defaults to, so both
 *  halves of the app talk to one Shopify API version unless told otherwise. */
const DEFAULT_API_VERSION = "2026-07";

export function adminEnv(): AdminEnv {
  if (cached) return cached;

  const parsed = schema.safeParse({
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ADMIN_API_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    AUTH_SECRET: process.env.AUTH_SECRET,
  });

  if (!parsed.success) {
    // `issue.path` is the env key; `issue.message` was written above to name it.
    // Neither carries the submitted value, which is the point.
    throw new AdminEnvError(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`),
    );
  }

  cached = { ...parsed.data, apiVersion: parsed.data.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION };
  return cached;
}

/** Emails are compared lowercase everywhere; normalise once, here. */
export function allowedEmails(): Set<string> {
  return new Set(
    adminEnv()
      .ADMIN_ALLOWED_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when the panel is configured at all. Lets a page render an honest
 *  "not set up" state instead of a 500, the way `customerAccountConfigured()`
 *  already does for the storefront's customer accounts. */
export function adminConfigured(): boolean {
  try {
    adminEnv();
    return true;
  } catch {
    return false;
  }
}
