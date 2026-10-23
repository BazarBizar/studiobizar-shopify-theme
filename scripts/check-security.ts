/**
 * The protections the security audit (2026-10-23) added or relied on, checked.
 *
 *   yarn check:security        # with `yarn dev` running for the request half
 *
 * Unit: the rate limiter — a login cannot be guessed at by inventing a new ip each
 * time; a slow limit is not reset early by the clean-up; the public forms' limits.
 * Requests (localhost only): the admin API refuses a caller with no session, the
 * public forms answer 429 after a visitor's share and 413 for an oversized body.
 * Only INVALID form bodies are sent — nothing is stored and no mail goes out.
 */

import { consume, limit, resetRateLimits } from "../lib/admin/rate-limit";
import { inquirySubmissionSchema, MAX_INQUIRY_ITEMS } from "../lib/inquiry/schema";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail !== undefined ? `  → ${String(detail).slice(0, 200)}` : ""}`);
  if (!ok) failures += 1;
}

/* -------------------------------------------------------------------------- *
 * The limiter
 * -------------------------------------------------------------------------- */

{
  resetRateLimits();
  const t0 = 1_000_000;
  // A script inventing a new ip for every guess at one address.
  let allowed = 0;
  for (let i = 0; i < 40; i++) {
    const perIp = consume("login", `staff@example.com:10.0.0.${i}`, t0);
    const perAccount = consume("loginAccount", "staff@example.com", t0);
    if (perIp.ok && perAccount.ok) allowed += 1;
  }
  check("login: a new ip per guess still stops at 20 for one address", allowed === 20, allowed);
  check("login: another address is not affected", consume("loginAccount", "other@example.com", t0).ok);

  // A slow bucket left idle well past the old 10-minute clean-up keeps its limit.
  resetRateLimits();
  for (let i = 0; i < 3; i++) consume("formRecipient", "inquiry:someone@example.com", t0);
  consume("form", "warm-up", t0 + 11 * 60_000); // runs the clean-up
  check(
    "clean-up: a slow limit is not reset by being idle",
    !consume("formRecipient", "inquiry:someone@example.com", t0 + 11 * 60_000).ok,
  );
  check("clean-up: it has refilled one after 20 minutes", consume("formRecipient", "inquiry:someone@example.com", t0 + 21 * 60_000).ok);

  resetRateLimits();
  let sent = 0;
  for (let i = 0; i < 100; i++) if (consume("formAll", "contact", t0).ok) sent += 1;
  check("public forms: one form takes 60 at once from everyone together", sent === 60, sent);
  resetRateLimits();
}

/* -------------------------------------------------------------------------- *
 * The inquiry, bounded
 * -------------------------------------------------------------------------- */

{
  const item = { variantId: "gid://shopify/ProductVariant/1", productHandle: "a", sku: null, title: "A", variantTitle: null, qty: 1, image: null };
  const contact = { name: "Test", email: "test@example.com" };
  check(
    `inquiry: more than ${MAX_INQUIRY_ITEMS} products is refused`,
    !inquirySubmissionSchema.safeParse({ ...contact, items: Array.from({ length: MAX_INQUIRY_ITEMS + 1 }, () => item) }).success,
  );
  check("inquiry: a 10 000-character product title is refused", !inquirySubmissionSchema.safeParse({ ...contact, items: [{ ...item, title: "x".repeat(10_000) }] }).success);
  check("inquiry: an ordinary one passes", inquirySubmissionSchema.safeParse({ ...contact, items: [item] }).success);
}

/* -------------------------------------------------------------------------- *
 * Requests
 * -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- *
 * The shared limiter, against a stand-in for Upstash's REST API
 * -------------------------------------------------------------------------- */

async function sharedLimiter() {
  const realFetch = globalThis.fetch;
  const store = new Map<string, { n: number; expires: number }>();
  let down = false;
  let calls = 0;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith("https://redis.example")) return realFetch(input, init);
    calls += 1;
    if (down) throw new Error("connect ECONNREFUSED");
    const now = Date.now();
    const commands = JSON.parse(String(init!.body)) as string[][];
    const results = commands.map(([command, key, ms, flag]) => {
      const entry = store.get(key!);
      const live = entry && entry.expires > now ? entry : undefined;
      if (command === "INCR") {
        const next = { n: (live?.n ?? 0) + 1, expires: live?.expires ?? Infinity };
        store.set(key!, next);
        return { result: next.n };
      }
      if (command === "PEXPIRE") {
        const current = store.get(key!)!;
        if (flag === "NX" && current.expires !== Infinity) return { result: 0 };
        current.expires = now + Number(ms);
        return { result: 1 };
      }
      return { result: Math.max(0, (store.get(key!)?.expires ?? now) - now) };
    });
    return new Response(JSON.stringify(results), { status: 200 });
  }) as typeof fetch;

  try {
    resetRateLimits();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await limit("form", "contact:198.51.100.7"));
    check("shared store: the limit is counted in Redis", calls === 6 && results.slice(0, 5).every((r) => r.ok) && !results[5]!.ok, JSON.stringify(results.map((r) => r.ok)));
    const refused = results[5]!;
    check("shared store: a refusal says how long to wait", !refused.ok && refused.retryAfterSeconds > 200 && refused.retryAfterSeconds <= 300, JSON.stringify(refused));
    down = true;
    const fallback = await limit("form", "contact:198.51.100.8");
    check("shared store: Redis down falls back to this instance, not a lock-out", fallback.ok);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetRateLimits();
  }
}

async function main() {
  await sharedLimiter();
  const up = await fetch(BASE, { method: "HEAD" }).then(() => true, () => false);
  if (!up) {
    console.log(`– ${BASE} is not running: request checks skipped (start \`yarn dev\`).`);
  } else {
    // A fresh made-up ip each run, so a rerun starts with a full share.
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    const post = (path: string, body: string, from = ip) =>
      fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": from }, body });

    const admin = await post("/api/admin/pages/update", "{}");
    check("admin API: no session is refused", admin.status === 401 || admin.status === 403, admin.status);

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post("/api/contact", JSON.stringify({ firstName: "" }))).status);
    check("contact: invalid bodies are refused (400), not sent", statuses.slice(0, 5).every((status) => status === 400), statuses);
    check("contact: the 6th from one visitor at once is 429", statuses[5] === 429, statuses);

    const big = await post("/api/contact", JSON.stringify({ message: "x".repeat(40_000) }), `198.51.100.${Math.floor(Math.random() * 250) + 1}`);
    check("contact: an oversized body is 413", big.status === 413, big.status);

    const news = await post("/api/newsletter", JSON.stringify({ email: "not-an-address" }), `192.0.2.${Math.floor(Math.random() * 250) + 1}`);
    check("newsletter: goes through the same guard (400 for a bad address)", news.status === 400, news.status);

    // The bot trap: answered like a success, before the body is even validated.
    const bot = await post("/api/contact", JSON.stringify({ website: "http://spam.example" }), `192.0.2.${Math.floor(Math.random() * 250) + 1}`);
    const botBody = (await bot.json()) as { message?: string };
    check("contact: a filled bot trap is thanked (200) and dropped", bot.status === 200 && /Thanks/.test(botBody.message ?? ""), `${bot.status} ${JSON.stringify(botBody)}`);

    // Each half of the site carries its own policy, and only one.
    const csp = (response: Response) => response.headers.get("content-security-policy") ?? "";
    const shop = await fetch(BASE + "/", { redirect: "manual" });
    check(
      "storefront: a CSP that refuses framing and scripts from elsewhere",
      /frame-ancestors 'none'/.test(csp(shop)) && /script-src 'self'/.test(csp(shop)) && /object-src 'none'/.test(csp(shop)) && shop.headers.get("x-frame-options") === "DENY",
      csp(shop),
    );
    const login = await fetch(BASE + "/staff/login", { redirect: "manual" });
    check(
      "admin: its own nonce policy, not the storefront's on top",
      /'nonce-/.test(csp(login)) && !csp(login).includes(", ") && !csp(login).includes("frame-src https://www.youtube"),
      csp(login),
    );
  }

  console.log(failures ? `\n${failures} security check(s) failed.` : "\nAll security checks passed.");
  process.exit(failures ? 1 : 0);
}

void main();
