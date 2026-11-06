import { NextResponse, type NextRequest } from "next/server";

import { STAFF_COOKIE, STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { findRedirect } from "@/lib/redirect-map";
import { shopifyAddressRoute } from "@/lib/redirects";

/**
 * In Next 16 this file is `proxy.ts` exporting `proxy` — `middleware.ts` /
 * `middleware()` is deprecated and renamed. See
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 *
 * Three jobs:
 *
 *  1. A strict, per-request, nonce-based CSP for `/admin/**` and `/staff/**`.
 *  2. An OPTIMISTIC auth gate for `/admin/**`.
 *  3. On the storefront, REDIRECTS ONLY (`storefront()` below): the URL redirects
 *     kept in Shopify (Website → Redirects), and Shopify's own addresses
 *     (`/products/x` → `/shop/x`).
 *
 * WHY THE STOREFRONT GETS NOTHING ELSE HERE. Its security headers come statically
 * from `next.config.ts`. Minting a nonce for public traffic would — because a nonce
 * requires dynamic rendering — risk pulling prerendered pages into per-request
 * rendering; the storefront branch therefore never touches request or response
 * headers, it either redirects or lets the request through untouched. A storefront
 * CSP, if one is ever added here, must be its OWN policy — never the admin one
 * loosened to suit analytics or chat widgets.
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
function adminCsp(nonce: string, { preview = false }: { preview?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // The preview draws storefront sections, and the Instagram one loads from
    // the hosts `next.config.ts` allows for it. The panel itself never needs them.
    `img-src 'self' blob: data: https://cdn.shopify.com${preview ? " https://*.cdninstagram.com https://*.fbcdn.net https://behold.pictures https://feeds.behold.so" : ""}`,
    "media-src 'self' https://cdn.shopify.com",
    "font-src 'self' data:",
    // Development only: the dev server's live reload is a websocket on another local
    // port. Without it the panel never picks up a code change until a hard reload.
    `connect-src 'self'${isDevelopment ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    // The builder frames its own preview; the preview's Video section frames the
    // two players `parseVideoUrl` allows — and only after play is pressed.
    `frame-src 'self'${preview ? " https://www.youtube-nocookie.com https://player.vimeo.com" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // The one difference that matters: the page builder frames its preview, so
    // the preview may be framed — by this origin and nothing else.
    `frame-ancestors ${preview ? "'self'" : "'none'"}`,
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** The panel's paths; everything else the matcher sends here is the storefront. */
const PANEL = /^\/(admin|staff|preview)(\/|$)/;

/**
 * A redirect, or straight through. Pages, not files: an address with an extension
 * (`/brand/logo.svg`) and anything but GET/HEAD pass untouched. A redirect is 308 — the
 * permanent kind, which tells Google to move the old address's ranking to the new one —
 * and keeps the visitor's query string unless the destination has its own.
 */
async function storefront(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if ((request.method !== "GET" && request.method !== "HEAD") || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }

  const target = (await findRedirect(pathname)) ?? shopifyAddressRoute(pathname);
  if (!target) return NextResponse.next();

  const url = new URL(target, request.url);
  if (!url.search && search) url.search = search;
  // Never onto itself: a redirect whose destination is its own address would loop.
  if (url.origin === request.nextUrl.origin && url.pathname.toLowerCase() === pathname.toLowerCase()) {
    return NextResponse.next();
  }
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PANEL.test(pathname)) return storefront(request);

  const isPreview = pathname.startsWith("/preview/");
  // The page builder's preview renders unpublished drafts — gated exactly like the panel.
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/") || isPreview;

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

  const nonce = crypto.randomUUID();
  const csp = adminCsp(nonce, { preview: isPreview });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce back out of this header during render and attaches it
  // to its own scripts, so nothing has to thread it through by hand.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  // Belt to `frame-ancestors 'none'`'s braces, for anything that predates CSP3.
  response.headers.set("X-Frame-Options", isPreview ? "SAMEORIGIN" : "DENY");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export const config = {
  matcher: [
    {
      /**
       * Admin pages, the staff login and the page builder preview only. `/api/**` is excluded: a JSON
       * response needs no CSP, and the API's own guards in `lib/admin/api.ts`
       * are authoritative rather than advisory.
       */
      source: "/(admin|staff|preview)/:path*",
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
    /**
     * The storefront, for `storefront()` above: every page address, without Next's own
     * files, the API (its routes are not pages) and the panel (the two entries above).
     */
    "/((?!api/|_next/|admin|staff|preview|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
