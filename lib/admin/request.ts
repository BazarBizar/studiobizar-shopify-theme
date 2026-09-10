import "server-only";

/**
 * Request inspection shared by the auth layer and the API guards. Kept in its
 * own module so `auth.ts` and `api.ts` can both use it without importing each
 * other.
 */

/**
 * Best-effort client IP, for rate-limit keys and audit lines only — never for
 * access control. `x-forwarded-for` is caller-supplied and trivially spoofed;
 * the leftmost entry is the closest thing to the origin that a proxy chain
 * offers. `unknown` is a valid answer and simply shares a bucket.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Same-origin check for state-changing requests — the CSRF defence for the write
 * pipeline (§4.5).
 *
 * `Origin` is set by the browser on every cross-origin request and cannot be
 * forged by page script. A request with NEITHER `Origin` nor `Referer` is
 * rejected rather than waved through: a same-origin `fetch` from the panel
 * always carries `Origin`, so the header being absent means the caller is not
 * the panel.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const candidate = request.headers.get("origin") ?? request.headers.get("referer");
  if (!candidate) return false;

  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}
