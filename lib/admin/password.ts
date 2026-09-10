import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Hand-wrapped rather than `promisify`d: the `util.promisify` types resolve to
 * scrypt's three-argument overload and drop the `options` parameter, which is
 * exactly where N, r and p travel.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Staff password hashing. scrypt from Node's own crypto — no dependency, and
 * memory-hard, which is the property that matters against offline cracking if
 * `.env` ever leaks.
 *
 * Stored format, one line in `ADMIN_PASSWORD_HASH`:
 *
 *   scrypt:<N>:<r>:<p>:<salt base64>:<hash base64>
 *
 * The parameters travel with the hash so they can be raised later without
 * invalidating hashes already in the wild.
 *
 * NOT `$`-separated, despite that being the crypt(3) convention every other
 * scrypt/argon2 hash uses. This value's home is `.env`, and Next loads `.env`
 * through dotenv-expand, which performs shell-style `$VAR` substitution on
 * values: `scrypt$16384$8$1$…` arrives as `scrypt6384…` with the parameters and
 * the salt silently deleted. The failure mode is a login that rejects the
 * correct password with no hint as to why. `:` has no meaning to dotenv and
 * cannot occur in base64, so it separates unambiguously.
 */

const KEY_LENGTH = 64;
const DEFAULTS = { N: 16384, r: 8, p: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULTS;
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r, p });

  return ["scrypt", N, r, p, salt.toString("base64"), derived.toString("base64")].join(":");
}

type Parsed = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, rawN, rawR, rawP, salt, hash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;

  return {
    N,
    r,
    p,
    salt: Buffer.from(salt, "base64"),
    hash: Buffer.from(hash, "base64"),
  };
}

/**
 * A hash of a random secret nobody knows, used to spend the same scrypt work on
 * a login for an unknown email as on a real one. Generated once per process:
 * the value is irrelevant, only the cost of comparing against it is.
 */
let dummy: Promise<string> | null = null;

export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(32).toString("hex"));
  return dummy;
}

/**
 * Returns false rather than throwing on a malformed stored hash, but only after
 * the derive has run. Bailing out early on a bad `ADMIN_PASSWORD_HASH` would
 * answer noticeably faster than a real rejection, which is a signal worth
 * denying an attacker.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored) ?? parse(await dummyHash());
  if (!parsed) return false;

  const { N, r, p, salt, hash } = parsed;

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, hash.length || KEY_LENGTH, { N, r, p });
  } catch {
    // Out-of-range scrypt parameters in a hand-edited hash land here.
    return false;
  }

  // Still constant-time within a length, and length alone is not secret.
  if (derived.length !== hash.length) return false;
  return timingSafeEqual(derived, hash);
}
