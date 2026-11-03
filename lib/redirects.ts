import { shopifyUrlToRoute } from "@/lib/routes";

/**
 * Redirects: an old address on the site that sends visitors on to a new one.
 *
 * They are Shopify's own URL redirects (Online Store → Navigation → URL redirects), so
 * the ones Shopify makes when a handle changes count too. Shopify writes those in its own
 * paths — `/products/old` → `/products/new` — and this site serves `/shop/old`, so every
 * redirect is read through `shopifyUrlToRoute`, on both ends.
 *
 * Edited under Website → Redirects (`lib/admin/redirects.ts`); followed by `proxy.ts`
 * through `lib/redirect-map.ts`. Plain logic, no server-only: the proxy, the panel and
 * the checks share it.
 */

/** Never redirected: the panel, the API and Next's own files. */
const PROTECTED = /^\/(admin|api|staff|preview|_next)(\/|$)/;

export const MAX_REDIRECT_PATH = 255;

/**
 * An address as it is compared: no domain, no query, no trailing slash, lower case,
 * percent-escapes decoded — so `/Old-Page/` and `/old-page` are the same address.
 */
export function normalizePath(input: string): string {
  let path = input.trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return "";
  }
  path = path.split(/[?#]/)[0] ?? "";
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray % — compare it as written.
  }
  path = path.toLowerCase().replace(/\/+$/, "");
  return path.startsWith("/") ? path : path ? `/${path}` : "/";
}

/**
 * Where a redirect really sends a visitor on this site: Shopify's paths become this
 * site's routes; another website stays as it is.
 */
export function redirectTarget(target: string): string {
  return shopifyUrlToRoute(target.trim());
}

/**
 * The addresses a stored redirect answers on. A Shopify path answers on its own
 * spelling (an old link to the Liquid theme) and on this site's route for it.
 */
export function redirectSources(path: string): string[] {
  const own = normalizePath(path);
  const route = normalizePath(shopifyUrlToRoute(own));
  return [...new Set([own, route])].filter((source) => source !== "/" && !PROTECTED.test(source));
}

export type RedirectRow = { path: string; target: string };

/** source address → where it goes. The first redirect for an address wins, as in Shopify. */
export function buildRedirectMap(rows: RedirectRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const target = redirectTarget(row.target);
    for (const source of redirectSources(row.path)) {
      // A redirect onto itself (a Shopify path that maps to the same route) is no redirect.
      if (!map.has(source) && normalizePath(target) !== source) map.set(source, target);
    }
  }
  return map;
}

/**
 * Shopify's own addresses — `/products/x`, `/pages/x`, `/policies/x` — have no route on
 * this site. Links to them (from the Liquid theme's days, from Google) go to the route
 * that shows the same thing. Null when the address is not one of those.
 */
export function shopifyAddressRoute(pathname: string): string | null {
  const first = pathname.split("/")[1]?.toLowerCase();
  if (first !== "products" && first !== "pages" && first !== "policies") return null;
  const route = shopifyUrlToRoute(pathname);
  return route !== pathname ? route : null;
}

/** Why an old address cannot be redirected, in the editor's words; null when it can. */
export function redirectSourceProblem(input: string): string | null {
  const raw = input.trim();
  if (!raw) return "Type the old address, for example /old-page.";
  if (raw.startsWith("//")) return "Type an address on this website, for example /old-page.";
  const path = normalizePath(raw);
  if (!path || path === "/") return "The home page cannot be redirected.";
  if (path.length > MAX_REDIRECT_PATH) return `An address can be at most ${MAX_REDIRECT_PATH} characters.`;
  if (PROTECTED.test(path)) return "That address belongs to the admin or the website’s own files and cannot be redirected.";
  if (/\s/.test(path)) return "An address cannot contain spaces.";
  return null;
}

/** Why a destination cannot be used, or null. A path here, or an https:// address elsewhere. */
export function redirectTargetProblem(input: string): string | null {
  const target = input.trim();
  if (!target) return "Choose where visitors should go.";
  if (/[\u0000-\u001f\s]/.test(target)) return "An address cannot contain spaces.";
  if (target.startsWith("/")) return target.startsWith("//") ? "Use an address starting with / or https://." : null;
  if (/^https:\/\/[^/]/i.test(target)) return null;
  return "Use an address on this website starting with /, or a full address starting with https://.";
}
