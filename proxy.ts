import { NextResponse, type NextRequest } from "next/server";

import { STAFF_COOKIE, STAFF_LOGIN_PATH } from "@/lib/admin/cookie";

/**
 * In Next 16 this file is `proxy.ts` exporting `proxy` — `middleware.ts` /
 * `middleware()` is deprecated and renamed. See
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 *
 * Two jobs, both scoped to the admin half of the app:
 *
 *  1. A strict, per-request, nonce-based CSP for `/admin/**` and `/staff/**`.
 *  2. An OPTIMISTIC auth gate for `/admin/**`.
 *
 * WHY THE MATCHER EXCLUDES THE STOREFRONT. The storefront gets its security
 * headers statically from `next.config.ts` instead. Running this function on
 * public traffic would mint a nonce for every storefront request that will never
 * use one, and — because a nonce requires dynamic rendering — would risk pulling
 * prerendered pages into per-request rendering. The storefront carries no CSP
 * today; when one is added it belongs in the branch marked below, as its OWN
 * policy. It must never be done by loosening the admin policy to suit
 * analytics or chat widgets, which would give away the whole point of having a
 * strict one here.
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * `strict-dynamic` means a nonce'd script may load further scripts, which is how
 * Next's bootstrap loads route chunks. `connect-src 'self'` is the important
 * one: the panel talks only to its own `/api/admin/**`, so even a successful
 * injection has nowhere to send what it steals.
 *
 * `style-src` carries `unsafe-inline` and NO nonce, on purpose. A nonce in
 * `style-src` overrides `unsafe-inline` per spec, and that silently kills every
 * React `style={{…}}` attribute — inline style ATTRIBUTES cannot carry a nonce.
 * The panel is full of them, and the failure is invisible: no console error, just
 * a broken layout.
 */
function adminCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://cdn.shopify.com",
    "media-src 'self' https://cdn.shopify.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  /**
   * OPTIMISTIC ONLY: this asks whether a staff cookie is PRESENT, never whether
   * it is valid — verifying a signature here would mean loading Auth.js into the
   * proxy runtime on every request. The real check is
   * `currentStaff()` in `app/(admin)/admin/layout.tsx` and in every route
   * handler.
   *
   * There is deliberately NO mirror rule bouncing cookie-holders away from the
   * login page. Presence says nothing about validity, so a stale or forged
   * cookie would be redirected to /admin, rejected by the layout, sent back to
   * the login page by this branch, and round and round — an infinite loop that
   * only ever traps legitimate users whose session expired.
   */
  if (isAdminPage && !request.cookies.has(STAFF_COOKIE)) {
    const login = new URL(STAFF_LOGIN_PATH, request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  // The storefront branch would go here — its own policy, not a relaxed
  // version of the admin one. Today the matcher below never sends it here.
  const nonce = crypto.randomUUID();
  const csp = adminCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce back out of this header during render and attaches it
  // to its own scripts, so nothing has to thread it through by hand.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  // Belt to `frame-ancestors 'none'`'s braces, for anything that predates CSP3.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export const config = {
  matcher: [
    {
      /**
       * Admin pages and the staff login only. `/api/**` is excluded: a JSON
       * response needs no CSP, and the API's own guards in `lib/admin/api.ts`
       * are authoritative rather than advisory.
       */
      source: "/(admin|staff)/:path*",
      /** A prefetch never executes scripts, so a nonce minted for one is waste. */
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      // `/(admin|staff)/:path*` requires a trailing segment; `/admin` itself does
      // not match it, and that is the one path that most needs the gate.
      source: "/admin",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
