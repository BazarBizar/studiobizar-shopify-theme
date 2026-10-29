/**
 * Settings → Staff & sign-in (lib/admin/staff.ts) and the panel-set Instagram feed,
 * checked against a stand-in for Shopify's Admin API — nothing is sent to the store.
 *
 *   yarn check:staff
 */

import Module from "node:module";

/** `lib/admin/shopify.ts` redirects a request with no staff session — never a script. */
const STUB_REDIRECT = () => {
  throw new Error("redirect() called outside Next");
};

// `lib/admin/shopify.ts` re-throws Next's control-flow errors with `next/navigation`,
// which only loads inside Next. Outside it there is nothing to re-throw.
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: typeof load })._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "next/navigation") return { unstable_rethrow: () => undefined, redirect: STUB_REDIRECT };
  return load.call(this, request, ...rest);
};

// A store that is not the real one, and owners/secrets of its own — set before any
// module reads them.
process.env.SHOPIFY_STORE_DOMAIN = "staff-check.myshopify.com";
process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = "shpat_staff_check";
process.env.SHOPIFY_API_VERSION = "2026-07";
process.env.ADMIN_ALLOWED_EMAILS = "owner@example.com";
process.env.AUTH_SECRET = "a-test-secret-that-is-long-enough-for-the-check-1234567890";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures += 1;
}

/* The stand-in: one shop metafield, with Shopify's compareDigest behaviour. */
let stored: { value: string; digest: string } | null = null;
let writes = 0;
let staleNext = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!String(input).includes("staff-check.myshopify.com")) return realFetch(input, init);
  const body = JSON.parse(String(init?.body)) as { query: string; variables?: { metafields?: { value: string; compareDigest: string | null }[] } };
  if (body.query.includes("AdminStaffAccountsSet")) {
    const [field] = body.variables!.metafields!;
    if (staleNext || (field!.compareDigest ?? null) !== (stored?.digest ?? null)) {
      staleNext = false;
      return Response.json({ data: { metafieldsSet: { metafields: [], userErrors: [{ field: ["metafields"], message: "stale", code: "STALE_OBJECT" }] } } });
    }
    writes += 1;
    stored = { value: field!.value, digest: `d${writes}` };
    return Response.json({ data: { metafieldsSet: { metafields: [{ key: "staff_accounts" }], userErrors: [] } } });
  }
  return Response.json({
    data: { shop: { id: "gid://shopify/Shop/1", staff: stored ? { value: stored.value, compareDigest: stored.digest } : null } },
  });
}) as typeof fetch;

async function main() {
  const { hashPassword } = await import("../lib/admin/password");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword("the owner env password");
  const staff = await import("../lib/admin/staff");
  const { verifyPassword } = await import("../lib/admin/password");
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  const signsIn = async (email: string, password: string) => {
    const target = await staff.signInTarget(email, envHash);
    return target.allowed && target.hash !== null && (await verifyPassword(password, target.hash));
  };
  const throws = async (run: () => Promise<unknown>, code: string) => {
    try {
      await run();
      return false;
    } catch (error) {
      return (error as { code?: string }).code === code;
    }
  };
  // Every module call reads fresh: the cache is cleared by each write, and the checks
  // below write between reads.

  check("owner signs in with the server password", await signsIn("owner@example.com", "the owner env password"));
  check("a stranger cannot", !(await signsIn("someone@example.com", "the owner env password")));

  check("staff cannot add staff", await throws(() => staff.addStaff("new@example.com", "a long first password", "nobody@example.com"), "NOT_ALLOWED"));
  check("a short first password is refused", await throws(() => staff.addStaff("new@example.com", "short", "owner@example.com"), "INVALID"));
  await staff.addStaff("New@Example.com", "a long first password", "owner@example.com");
  check("an owner adds someone, who signs in with their own password", await signsIn("new@example.com", "a long first password"));
  check("…and not with the owner's", !(await signsIn("new@example.com", "the owner env password")));
  check("the stored list holds a hash, never the password", !stored!.value.includes("a long first password") && stored!.value.includes("scrypt:"));
  check("adding the same address twice is refused", await throws(() => staff.addStaff("new@example.com", "another long password", "owner@example.com"), "INVALID"));

  const before = Date.now() - 1000;
  await staff.setPassword("new@example.com", "a brand new long password", "new@example.com");
  check("a changed password works, the old one does not", (await signsIn("new@example.com", "a brand new long password")) && !(await signsIn("new@example.com", "a long first password")));
  check("a session from before the change has ended", !(await staff.sessionAllowed("new@example.com", before)));
  check("a session after it counts", await staff.sessionAllowed("new@example.com", Date.now()));

  await staff.setPassword("owner@example.com", "the owner's own password now", "owner@example.com");
  check("an owner with their own password: the server password stops working", !(await signsIn("owner@example.com", "the owner env password")) && (await signsIn("owner@example.com", "the owner's own password now")));

  check("an owner cannot be removed", await throws(() => staff.removeStaff("owner@example.com", "owner@example.com"), "NOT_ALLOWED"));
  check("staff cannot remove staff", await throws(() => staff.removeStaff("owner@example.com", "new@example.com"), "NOT_ALLOWED"));
  await staff.removeStaff("new@example.com", "owner@example.com");
  check("someone removed can no longer sign in, and their session ends", !(await signsIn("new@example.com", "a brand new long password")) && !(await staff.sessionAllowed("new@example.com", Date.now())));

  staleNext = true;
  check("a change made elsewhere in between is not overwritten", await throws(() => staff.addStaff("late@example.com", "a long first password", "owner@example.com"), "CONFLICT"));

  stored = { value: "not json", digest: "broken" };
  check("an unreadable list leaves the owners able to sign in", await staff.isAllowed("owner@example.com"));
  check("…and nobody else", !(await staff.isAllowed("new@example.com")));

  /* The Instagram feed typed into the panel */
  const { beholdFeedId } = await import("../lib/instagram/feed-id");
  check("feed: an id is accepted", beholdFeedId("aB3dE5fG7hJ9") === "aB3dE5fG7hJ9");
  check("feed: its feeds.behold.so address is accepted", beholdFeedId("https://feeds.behold.so/aB3dE5fG7hJ9") === "aB3dE5fG7hJ9");
  check(
    "feed: any other address is refused — the server never fetches it",
    [
      "https://evil.example/feed",
      "https://feeds.behold.so.evil.example/aB3dE5fG7hJ9",
      "http://feeds.behold.so/aB3dE5fG7hJ9",
      "aB3dE5/../../admin",
      "",
    ].every((value) => beholdFeedId(value) === null),
  );

  console.log(failures ? `\n${failures} staff check(s) failed.` : "\nAll staff checks passed.");
  process.exit(failures ? 1 : 0);
}

void main();
