/**
 * Names shared between the auth layer and `proxy.ts`.
 *
 * Deliberately dependency-free and WITHOUT `server-only`: `proxy.ts` needs the
 * cookie name, and importing `lib/admin/auth.ts` there would drag Auth.js and
 * the env parser into the proxy runtime — which the Next docs explicitly warn
 * against, since the proxy is meant to be deployable to a CDN edge. There is no
 * secret here, only three constants.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * The `__Secure-` prefix is only honoured on a cookie that is also `secure`, and
 * a `secure` cookie is never stored over plain http — so development on
 * http://localhost has to use the unprefixed name.
 *
 * Nothing here may collide with the storefront's `sb_customer_session`: staff and
 * customer sessions are independent, and signing out of one must not disturb the
 * other.
 */
export const STAFF_COOKIE = isProduction
  ? "__Secure-sb_staff.session-token"
  : "sb_staff.session-token";

/** Not `/login`: that path is reserved for customers on this storefront. */
export const STAFF_LOGIN_PATH = "/staff/login";

/** Not `/api/auth`: the storefront's Shopify customer OAuth flow owns that. */
export const STAFF_BASE_PATH = "/api/staff-auth";
