import "server-only";

/**
 * Token-bucket rate limiting, in memory, no dependency.
 *
 * SCOPE: this is per-process. One instance is exactly the deployment this panel
 * is built for — a handful of staff on a single Next server. Behind more than
 * one instance the effective limit multiplies by the instance count, which
 * degrades gracefully but is no longer the number written below. To fix that,
 * swap the body of `consume()` for a Redis/Upstash `INCR` + `EXPIRE` (or a
 * Lua-scripted bucket); every call site already speaks this signature, so
 * nothing else has to change.
 */

export type LimitPreset =
  | "write"
  | "read"
  | "login"
  | "loginAccount"
  | "form"
  | "formAll"
  | "formRecipient";

type Limit = { burst: number; refillPerSecond: number };

/**
 * Login is the tight one on purpose: 5 attempts, then one more every 30s. That
 * is generous for a person who mistyped and punishing for a script.
 *
 * `login` is keyed by email AND ip — but the ip comes from `x-forwarded-for`,
 * which a caller can make up, so a script could rotate it for a fresh bucket on
 * every guess. `loginAccount` is keyed by the email alone: whatever ip is
 * claimed, one address gets 20 attempts, then one a minute. Someone hammering a
 * staff address can slow its real owner to that rate, never lock them out.
 */
const LIMITS: Record<LimitPreset, Limit> = {
  write: { burst: 20, refillPerSecond: 1 },
  read: { burst: 60, refillPerSecond: 5 },
  login: { burst: 5, refillPerSecond: 1 / 30 },
  loginAccount: { burst: 20, refillPerSecond: 1 / 60 },
  // The public forms (lib/public-form.ts). Per visitor: 5, then one a minute. Per form,
  // whoever sends: 60, then one every 15s — the ceiling on mail a script can cause by
  // claiming a new ip each time. Per address a form writes to: 3, then one every 20
  // minutes, so the shop's name cannot be used to fill a stranger's inbox.
  form: { burst: 5, refillPerSecond: 1 / 60 },
  formAll: { burst: 60, refillPerSecond: 1 / 15 },
  formRecipient: { burst: 3, refillPerSecond: 1 / 1200 },
};

type Bucket = { tokens: number; updatedAt: number; limit: Limit };

const buckets = new Map<string, Bucket>();

/** A bucket that has refilled is indistinguishable from a fresh one, so it can be
 *  dropped. Without the sweep the Map grows once per distinct key forever, which
 *  for an `email:ip` key is an unbounded, attacker-controlled set. Dropping on
 *  idle TIME instead would reset a slow bucket (one an hour) long before it had
 *  refilled — the limit would quietly become a shorter one. */
const SWEEP_EVERY_MS = 60 * 1000;

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;

  for (const [key, bucket] of buckets) {
    const refilled = bucket.tokens + ((now - bucket.updatedAt) / 1000) * bucket.limit.refillPerSecond;
    if (refilled >= bucket.limit.burst) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * `key` should identify the caller as narrowly as the request allows —
 * `email:ip` for a login, `email:ip` for an authenticated write. Keying on IP
 * alone lets one office share a budget; keying on email alone lets an attacker
 * spend someone else's.
 */
export function consume(preset: LimitPreset, key: string, now = Date.now()): RateLimitResult {
  const limit = LIMITS[preset];
  const id = `${preset}:${key}`;

  sweep(now);

  const bucket = buckets.get(id) ?? { tokens: limit.burst, updatedAt: now, limit };

  const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
  const tokens = Math.min(limit.burst, bucket.tokens + elapsedSeconds * limit.refillPerSecond);

  if (tokens < 1) {
    // Report the wait for one whole token, rounded up — a `Retry-After` of 0
    // invites an immediate retry that is guaranteed to fail again.
    const retryAfterSeconds = Math.ceil((1 - tokens) / limit.refillPerSecond);
    buckets.set(id, { tokens, updatedAt: now, limit });
    return { ok: false, retryAfterSeconds };
  }

  buckets.set(id, { tokens: tokens - 1, updatedAt: now, limit });
  return { ok: true, remaining: Math.floor(tokens - 1) };
}

/** Test seam: the buckets are module state, so a test that asserts a 429 has to
 *  be able to get back to a known baseline. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}

/* -------------------------------------------------------------------------- *
 * Shared across instances
 * -------------------------------------------------------------------------- */

/**
 * `consume` counts in this process only. On a host that runs several instances (any
 * serverless platform), each one has its own buckets and a limit multiplies by their
 * number. So when a Redis is configured — Upstash's REST API, as Vercel KV also
 * provides it — `limit` counts there instead, for every instance at once:
 *
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL + KV_REST_API_TOKEN)
 *
 * There it is a fixed window of the same size: `burst` requests per the time a bucket
 * takes to refill (login: 5 per 2½ minutes). Slightly looser at a window's edge than the
 * bucket, and one request to Redis per check.
 *
 * If Redis does not answer in time, the check falls back to this process's buckets —
 * a slow Redis must not lock staff out of the panel or visitors out of the forms.
 */
function sharedStore(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

let warned = false;

export async function limit(preset: LimitPreset, key: string): Promise<RateLimitResult> {
  const store = sharedStore();
  if (!store) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.warn(
        "[rate-limit] No UPSTASH_REDIS_REST_URL/TOKEN: limits are counted per instance. Set them on a host that runs more than one.",
      );
    }
    return consume(preset, key);
  }

  const { burst, refillPerSecond } = LIMITS[preset];
  const windowMs = Math.round((burst / refillPerSecond) * 1000);
  const id = `sb:rl:${preset}:${key}`;
  try {
    const response = await fetch(`${store.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${store.token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", id],
        ["PEXPIRE", id, String(windowMs), "NX"],
        ["PTTL", id],
      ]),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [count, , ttl] = (await response.json()) as { result?: unknown; error?: string }[];
    if (typeof count?.result !== "number") throw new Error(count?.error ?? "no count");
    if (count.result <= burst) return { ok: true, remaining: burst - count.result };
    const left = typeof ttl?.result === "number" && ttl.result > 0 ? ttl.result : windowMs;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(left / 1000)) };
  } catch (error) {
    console.warn(`[rate-limit] shared store unavailable, counting in this instance: ${(error as Error).message}`);
    return consume(preset, key);
  }
}
