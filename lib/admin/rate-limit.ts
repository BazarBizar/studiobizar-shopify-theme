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

export type LimitPreset = "write" | "read" | "login";

type Limit = { burst: number; refillPerSecond: number };

/**
 * Login is the tight one on purpose: 5 attempts, then one more every 30s. That
 * is generous for a person who mistyped and punishing for a script.
 */
const LIMITS: Record<LimitPreset, Limit> = {
  write: { burst: 20, refillPerSecond: 1 },
  read: { burst: 60, refillPerSecond: 5 },
  login: { burst: 5, refillPerSecond: 1 / 30 },
};

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

/** Buckets idle this long are indistinguishable from a fresh one, so they can
 *  be dropped. Without the sweep the Map grows once per distinct key forever,
 *  which for an `email:ip` key is an unbounded, attacker-controlled set. */
const IDLE_MS = 10 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;

  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > IDLE_MS) buckets.delete(key);
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

  const bucket = buckets.get(id) ?? { tokens: limit.burst, updatedAt: now };

  const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
  const tokens = Math.min(limit.burst, bucket.tokens + elapsedSeconds * limit.refillPerSecond);

  if (tokens < 1) {
    // Report the wait for one whole token, rounded up — a `Retry-After` of 0
    // invites an immediate retry that is guaranteed to fail again.
    const retryAfterSeconds = Math.ceil((1 - tokens) / limit.refillPerSecond);
    buckets.set(id, { tokens, updatedAt: now });
    return { ok: false, retryAfterSeconds };
  }

  buckets.set(id, { tokens: tokens - 1, updatedAt: now });
  return { ok: true, remaining: Math.floor(tokens - 1) };
}

/** Test seam: the buckets are module state, so a test that asserts a 429 has to
 *  be able to get back to a known baseline. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
