import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { adminEnv } from "@/lib/admin/env";
import { verifyPassword } from "@/lib/admin/password";
import { limit } from "@/lib/admin/rate-limit";
import { addStaff, removeStaff, setPassword, signInTarget, StaffError } from "@/lib/admin/staff";

/**
 * Who may sign in, from the panel (Settings → Staff; `lib/admin/staff.ts`):
 *
 *   staffChangePassword  anyone, for themselves — with their current password, which is
 *                        checked against the same rate limit as signing in
 *   staffAdd             owners — an address and a first password to hand over in person
 *   staffRemove          owners — never an owner (they are set on the server)
 *
 * Passwords arrive here and leave as scrypt hashes; they are never logged or returned.
 */

const password = z.string().min(1).max(200);
const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("staffChangePassword"), current: password, next: password }),
  z.strictObject({ operation: z.literal("staffAdd"), email: z.string().max(200), password }),
  z.strictObject({ operation: z.literal("staffRemove"), email: z.string().max(200) }),
]);

const ACTIONS = { staffChangePassword: "staff.password", staffAdd: "staff.add", staffRemove: "staff.remove" } as const;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "staff", limit: "write" });
  if (!guarded.ok) return guarded.response;
  const { staff, ip } = guarded.context;

  const body = await readJson(request, 4 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const operation = (body.value as { operation?: unknown } | null)?.operation;
  if (typeof operation !== "string" || !Object.hasOwn(ACTIONS, operation)) {
    audit({ action: "staff", actor: staff.email, outcome: "denied", reason: "OPERATION_MISMATCH", ip });
    return fail("NOT_ALLOWED", "That operation is not available on this endpoint.");
  }
  const action = ACTIONS[operation as keyof typeof ACTIONS];

  const parsed = validate(schema, body.value, action);
  if (!parsed.ok) {
    audit({ action, actor: staff.email, outcome: "invalid", reason: "SCHEMA", ip });
    return parsed.response;
  }
  const input = parsed.data;

  try {
    switch (input.operation) {
      case "staffChangePassword": {
        // Guessing the current password here is as slow as guessing it at sign-in.
        const budget = await limit("loginAccount", staff.email);
        if (!budget.ok) {
          audit({ action, actor: staff.email, outcome: "denied", reason: "RATE_LIMITED", ip });
          return fail("RATE_LIMITED", "Too many tries. Wait a minute and try again.");
        }
        const target = await signInTarget(staff.email, adminEnv().ADMIN_PASSWORD_HASH);
        if (!target.hash || !(await verifyPassword(input.current, target.hash))) {
          audit({ action, actor: staff.email, outcome: "denied", reason: "BAD_PASSWORD", ip });
          return fail("INVALID", "Your current password is not right.");
        }
        await setPassword(staff.email, input.next, staff.email);
        break;
      }
      case "staffAdd":
        await addStaff(input.email, input.password, staff.email);
        break;
      case "staffRemove":
        await removeStaff(input.email, staff.email);
        break;
    }
    audit({ action, actor: staff.email, outcome: "ok", type: "staff", ip });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StaffError) {
      audit({ action, actor: staff.email, outcome: "denied", reason: error.code, ip });
      return fail(error.code === "CONFLICT" ? "CONFLICT" : error.code === "NOT_ALLOWED" ? "NOT_ALLOWED" : "INVALID", error.message);
    }
    audit({ action, actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure(action, error);
  }
}
