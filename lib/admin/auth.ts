import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { audit } from "./audit";
import { STAFF_BASE_PATH, STAFF_COOKIE, STAFF_LOGIN_PATH } from "./cookie";
import { adminEnv } from "./env";
import { dummyHash, verifyPassword } from "./password";
import { limit } from "./rate-limit";
import { clientIp } from "./request";
import { isAllowed, sessionAllowed, signInTarget } from "./staff";

/**
 * Staff authentication — entirely separate from the storefront's customer
 * accounts (Shopify Customer Account API, OAuth + PKCE, cookie
 * `sb_customer_session`). The two never meet:
 *
 *  - Different base path. Auth.js defaults to `/api/auth`, which the storefront
 *    already owns: `/api/auth/login`, `/api/auth/callback` and
 *    `/api/auth/logout` are the customer OAuth flow. Mounting Auth.js there
 *    would have it fight the customer routes for `/api/auth/callback/*`, so it
 *    is moved wholesale to `/api/staff-auth`.
 *  - Different cookie name, set explicitly below. Signing a staff member in must
 *    not touch a customer's session, and signing a customer out must not touch a
 *    staff member's.
 *  - Different login URL. `/staff/login`, not `/login`.
 */

const isProduction = process.env.NODE_ENV === "production";

/** Short enough that a forgotten open laptop expires on its own. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export { STAFF_BASE_PATH, STAFF_COOKIE, STAFF_LOGIN_PATH };

/**
 * Auth.js is configured through a function rather than a literal so that
 * `adminEnv()` runs per request instead of at module load. `next build` imports
 * this module while collecting page data, and a top-level parse would fail the
 * build on any machine without the admin env set (§4.1).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  basePath: STAFF_BASE_PATH,
  secret: adminEnv().AUTH_SECRET,

  /**
   * No database, so JWT is the only strategy available — and the right one: a
   * handful of staff, no need to enumerate live sessions.
   */
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },

  /** Behind a proxy the callback URL is derived from the Host header. Safe here
   *  because there is no OAuth redirect to poison — the only flow is a
   *  same-origin credentials POST, and writes check `Origin` separately. */
  trustHost: true,

  pages: { signIn: STAFF_LOGIN_PATH, error: STAFF_LOGIN_PATH },

  cookies: {
    sessionToken: {
      name: STAFF_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    },
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const ip = clientIp(request.headers);

        // Rate limit before any work: the scrypt derive below is deliberately
        // expensive, which makes an unlimited login endpoint a CPU exhaustion
        // vector as well as a guessing one.
        const perIp = await limit("login", `${email}:${ip}`);
        // Both buckets are always charged, so neither can be spent down behind the other.
        const account = await limit("loginAccount", email);
        if (!perIp.ok || !account.ok) {
          audit({ action: "auth.login", actor: email || "anonymous", outcome: "denied", reason: "RATE_LIMITED", ip });
          return null;
        }

        if (!email || !password) {
          audit({ action: "auth.login", actor: email || "anonymous", outcome: "invalid", reason: "MISSING_CREDENTIALS", ip });
          return null;
        }

        // The owners (ADMIN_ALLOWED_EMAILS) and the staff added in the panel, each
        // against their own password — see lib/admin/staff.ts.
        const who = await signInTarget(email, adminEnv().ADMIN_PASSWORD_HASH);
        const allowed = who.allowed && who.hash !== null;

        /**
         * Derive even for an email that is not on the allowlist, against a
         * throwaway hash. Returning early here would answer in microseconds
         * instead of the ~100ms a real attempt costs, and that difference is a
         * reliable oracle for which addresses are staff addresses.
         */
        const target = allowed ? who.hash! : await dummyHash();
        const passwordMatches = await verifyPassword(password, target);

        if (!allowed || !passwordMatches) {
          audit({
            action: "auth.login",
            actor: email,
            outcome: "denied",
            reason: allowed ? "BAD_PASSWORD" : "NOT_ALLOWED",
            ip,
          });
          return null;
        }

        audit({ action: "auth.login", actor: email, outcome: "ok", ip });
        return { id: email, email };
      },
    }),
  ],

  callbacks: {
    /**
     * The allowlist is checked a second time here. `authorize` ran against the
     * list as it was at sign-in; this runs on every sign-in event including
     * ones that skip the provider, and it is the hook Auth.js documents for
     * refusing a user outright.
     */
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      return Boolean(email && (await isAllowed(email)));
    },

    jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.toLowerCase();
        // When this sign-in happened: a password change or a removal after it ends it.
        token.signedInAt = Date.now();
      }
      return token;
    },

    session({ session, token }) {
      if (session.user && typeof token.email === "string") session.user.email = token.email;
      (session as { signedInAt?: number }).signedInAt = typeof token.signedInAt === "number" ? token.signedInAt : undefined;
      return session;
    },
  },
}));

export type StaffSession = { email: string };

/**
 * The authoritative gate. Verifies the cookie's signature (via `auth()`) AND
 * that the email is still allowed (an owner, or on the staff list — lib/admin/staff.ts)
 * and the session began after their last password change, so removing someone locks
 * them out on their next request instead of when
 * their eight-hour session happens to expire.
 *
 * Every admin page and every admin route handler goes through this, and so does every
 * Admin API call (`adminGraphQL` in `shopify.ts`) — the one gate a page cannot skip. The check in
 * `proxy.ts` is optimistic only — it sees a cookie, not a valid one.
 */
export async function currentStaff(): Promise<StaffSession | null> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  // Still an owner or on the staff list, and signed in since their last password change.
  const signedInAt = (session as { signedInAt?: number } | null)?.signedInAt ?? null;
  if (!(await sessionAllowed(email, signedInAt))) return null;

  return { email };
}
