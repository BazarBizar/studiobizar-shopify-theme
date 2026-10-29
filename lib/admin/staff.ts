import "server-only";

import { z } from "zod";

import { allowedEmails } from "./env";
import { OPERATIONS } from "./operations";
import { hashPassword } from "./password";
import { adminGraphQL, assertNoUserErrors, withoutStaffSession } from "./shopify";

/**
 * WHO MAY SIGN IN — editable from the panel (Settings → Staff), not only in `.env`.
 *
 * Two kinds of staff:
 *  - OWNERS, the addresses in `ADMIN_ALLOWED_EMAILS`. Always allowed, never removable
 *    from the panel — so the panel can never lock everyone out. An owner signs in with
 *    `ADMIN_PASSWORD_HASH` until they set their own password here; from then on only
 *    their own (a leaked old password must stop working when it is changed).
 *  - STAFF added by an owner, each with their own password.
 *
 * Stored on the shop as ONE json metafield in a private namespace with no definition:
 * the Admin API token can read it, the Storefront API cannot, and nothing on the site
 * ever renders it. Passwords are scrypt hashes (`password.ts`), never the passwords.
 *
 * A change of password or a removal ends that person's other sessions: a session
 * signed in before `validFrom` is refused by `currentStaff`.
 *
 * Read on every admin request, so it is cached here for a few seconds; a change made
 * through this module clears the cache at once.
 *
 * Lost the owner password? Delete the owner's entry (or the whole metafield
 * `studio_admin.staff_accounts` on the shop, in Shopify admin → Settings → Custom data)
 * and `ADMIN_PASSWORD_HASH` works again.
 */

export const STAFF_NAMESPACE = "studio_admin";
export const STAFF_KEY = "staff_accounts";

export const MIN_PASSWORD_LENGTH = 12;

const accountSchema = z.object({
  email: z.email().max(200),
  /** The scrypt hash — see `password.ts`. */
  hash: z.string().min(20).max(400),
  addedAt: z.string(),
  addedBy: z.string(),
  /** Sessions signed in before this are refused (a password change, a re-add). ms. */
  validFrom: z.number().int().nonnegative(),
});
export type StaffAccount = z.infer<typeof accountSchema>;

const storedSchema = z.object({ version: z.literal(1), accounts: z.array(accountSchema).max(100) });

type State = { shopId: string; digest: string | null; accounts: StaffAccount[] };

const CACHE_MS = 15_000;
let cache: { at: number; state: State } | null = null;

async function readState(): Promise<State> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  // Read to decide whether someone IS signed in — so it cannot ask for a session itself.
  const data = await withoutStaffSession("sign-in checks the staff list", () =>
    adminGraphQL<{ shop: { id: string; staff: { value: string; compareDigest: string } | null } }>(
      "staffAccounts",
      OPERATIONS.staffAccounts.document,
      {},
    ),
  );
  let accounts: StaffAccount[] = [];
  if (data.shop.staff?.value) {
    try {
      const parsed = storedSchema.safeParse(JSON.parse(data.shop.staff.value));
      if (parsed.success) accounts = parsed.data.accounts;
      else console.error("[staff] the stored staff list is unreadable; only the owners can sign in");
    } catch {
      console.error("[staff] the stored staff list is not JSON; only the owners can sign in");
    }
  }
  const state = { shopId: data.shop.id, digest: data.shop.staff?.compareDigest ?? null, accounts };
  cache = { at: Date.now(), state };
  return state;
}

export class StaffError extends Error {
  readonly code: "CONFLICT" | "INVALID" | "NOT_ALLOWED";
  constructor(code: StaffError["code"], message: string) {
    super(message);
    this.name = "StaffError";
    this.code = code;
  }
}

async function write(state: State, accounts: StaffAccount[]) {
  const data = await adminGraphQL<{
    metafieldsSet: { userErrors: { field?: string[] | null; message: string; code?: string | null }[] };
  }>("staffAccountsSet", OPERATIONS.staffAccountsSet.document, {
    metafields: [
      {
        ownerId: state.shopId,
        namespace: STAFF_NAMESPACE,
        key: STAFF_KEY,
        type: "json",
        value: JSON.stringify({ version: 1, accounts }),
        // Refused when someone else changed the list since it was read — no lost update.
        compareDigest: state.digest,
      },
    ],
  });
  cache = null;
  if (data.metafieldsSet.userErrors.some((error) => error.code === "STALE_OBJECT")) {
    throw new StaffError("CONFLICT", "The staff list was changed somewhere else just now. Try again.");
  }
  assertNoUserErrors(data.metafieldsSet.userErrors);
}

const normal = (email: string) => email.trim().toLowerCase();
export const isOwner = (email: string) => allowedEmails().has(normal(email));

/* -------------------------------------------------------------------------- *
 * Reading — for sign-in and every request
 * -------------------------------------------------------------------------- */

/**
 * Who this address is, for sign-in: allowed or not, and the hash its password is
 * checked against. Never throws: if Shopify cannot be reached, the owners can still
 * sign in with the `.env` password, and nobody else.
 */
export async function signInTarget(
  email: string,
  envHash: string,
): Promise<{ allowed: boolean; hash: string | null }> {
  const address = normal(email);
  const owner = isOwner(address);
  try {
    const stored = (await readState()).accounts.find((account) => account.email === address);
    if (stored) return { allowed: true, hash: stored.hash };
    return { allowed: owner, hash: owner ? envHash : null };
  } catch (error) {
    console.error("[staff] could not read the staff list; owners only", error);
    return { allowed: owner, hash: owner ? envHash : null };
  }
}

/** Whether this address may sign in at all: an owner, or on the staff list. */
export async function isAllowed(email: string): Promise<boolean> {
  const address = normal(email);
  try {
    return isOwner(address) || (await readState()).accounts.some((account) => account.email === address);
  } catch {
    return isOwner(address);
  }
}

/**
 * Whether a session for this address, signed in at `signedInAt` (ms), still counts:
 * the address is allowed, and — once it has its own password — the session began
 * after that password was set (an older one, or one with no time, has ended).
 */
export async function sessionAllowed(email: string, signedInAt: number | null): Promise<boolean> {
  const address = normal(email);
  try {
    const stored = (await readState()).accounts.find((account) => account.email === address);
    if (stored) return signedInAt !== null && signedInAt >= stored.validFrom;
    return isOwner(address);
  } catch {
    // Shopify unreachable: keep owners working, refuse the rest until it answers.
    return isOwner(address);
  }
}

export type StaffRow = { email: string; owner: boolean; ownPassword: boolean; addedAt: string | null; addedBy: string | null };

/** The list the Staff screen shows: owners first, then everyone added. No hashes. */
export async function listStaff(): Promise<StaffRow[]> {
  const { accounts } = await readState();
  const owners = [...allowedEmails()].map((email) => {
    const own = accounts.find((account) => account.email === email);
    return { email, owner: true, ownPassword: Boolean(own), addedAt: null, addedBy: null };
  });
  const added = accounts
    .filter((account) => !isOwner(account.email))
    .map((account) => ({ email: account.email, owner: false, ownPassword: true, addedAt: account.addedAt, addedBy: account.addedBy }));
  return [...owners, ...added];
}

/* -------------------------------------------------------------------------- *
 * Changing
 * -------------------------------------------------------------------------- */

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new StaffError("INVALID", `Use at least ${MIN_PASSWORD_LENGTH} characters — a short sentence is easiest to remember.`);
  }
  if (password.length > 200) throw new StaffError("INVALID", "That password is too long.");
}

/** Sets (or replaces) someone's own password. Their other sessions end. */
export async function setPassword(email: string, password: string, actor: string) {
  assertPassword(password);
  const address = normal(email);
  const state = await readState();
  const existing = state.accounts.find((account) => account.email === address);
  if (!existing && !isOwner(address)) throw new StaffError("NOT_ALLOWED", "That address is not on the staff list.");
  const account: StaffAccount = {
    email: address,
    hash: await hashPassword(password),
    addedAt: existing?.addedAt ?? new Date().toISOString(),
    addedBy: existing?.addedBy ?? actor,
    validFrom: Date.now(),
  };
  await write(state, [...state.accounts.filter((candidate) => candidate.email !== address), account]);
}

/** Adds someone, with a first password to give them in person. Owners only. */
export async function addStaff(email: string, password: string, actor: string) {
  if (!isOwner(actor)) throw new StaffError("NOT_ALLOWED", "Only an owner can add staff.");
  const address = normal(email);
  if (!z.email().safeParse(address).success) throw new StaffError("INVALID", "Enter a valid email address.");
  assertPassword(password);
  const state = await readState();
  if (isOwner(address) || state.accounts.some((account) => account.email === address)) {
    throw new StaffError("INVALID", "That address can already sign in.");
  }
  const account: StaffAccount = {
    email: address,
    hash: await hashPassword(password),
    addedAt: new Date().toISOString(),
    addedBy: actor,
    validFrom: Date.now(),
  };
  await write(state, [...state.accounts, account]);
}

/** Removes someone; their sessions end on their next request. Owners only; never an owner. */
export async function removeStaff(email: string, actor: string) {
  if (!isOwner(actor)) throw new StaffError("NOT_ALLOWED", "Only an owner can remove staff.");
  const address = normal(email);
  if (isOwner(address)) {
    throw new StaffError("NOT_ALLOWED", "An owner is set on the server (ADMIN_ALLOWED_EMAILS) and cannot be removed here.");
  }
  const state = await readState();
  if (!state.accounts.some((account) => account.email === address)) return;
  await write(state, state.accounts.filter((account) => account.email !== address));
}
