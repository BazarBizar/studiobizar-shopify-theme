/**
 * Generates the three secrets the admin panel needs and prints them as `.env`
 * lines.
 *
 *   npx tsx --conditions=react-server scripts/admin-credentials.ts
 *   npx tsx --conditions=react-server scripts/admin-credentials.ts "my password"
 *
 * With no argument a strong password is generated and shown once — it is not
 * stored anywhere, so copy it before closing the terminal.
 *
 * `--conditions=react-server` is required because this imports
 * `lib/admin/password.ts`, which is `server-only`. Importing it rather than
 * re-implementing scrypt here is deliberate: a hash written by a script that
 * drifted from the verifier is a login that fails with no useful error.
 */

import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "../lib/admin/password";

async function main() {
  const supplied = process.argv[2];
  /** base64url of 24 bytes: no shell-quoting hazards, ~192 bits. */
  const password = supplied ?? randomBytes(24).toString("base64url");

  const hash = await hashPassword(password);

  // Round-trip before printing. A hash that does not verify is worse than an
  // error, because it fails much later and looks like a forgotten password.
  if (!(await verifyPassword(password, hash))) {
    console.error("The generated hash did not verify. Refusing to print it.");
    process.exit(1);
  }

  /**
   * These values are pasted into `.env`, which Next loads through dotenv-expand —
   * a `$` in the value is treated as the start of a variable reference and the
   * rest of the name is deleted. This once cost an afternoon: the hash format used
   * to be `$`-separated and the correct password was rejected with no clue why.
   * Fail loudly here rather than emit a line that will be silently corrupted.
   */
  for (const [key, value] of [
    ["ADMIN_PASSWORD_HASH", hash],
    ["password", password],
  ] as const) {
    if (value.includes("$")) {
      console.error(`Refusing to print: ${key} contains "$", which dotenv would expand inside .env.`);
      process.exit(1);
    }
  }

  console.log("Add these to .env — and never commit them:\n");
  console.log(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`ADMIN_ALLOWED_EMAILS=you@example.com`);

  if (!supplied) {
    console.log(`\nPassword (shown once, not stored):\n\n    ${password}\n`);
  }

  console.log("All staff share ADMIN_PASSWORD_HASH; ADMIN_ALLOWED_EMAILS decides who may use it.");
}

void main();
