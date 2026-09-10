"use server";

import { audit } from "@/lib/admin/audit";
import { currentStaff, signOut } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";

export async function staffSignOut() {
  const staff = await currentStaff();
  if (staff) audit({ action: "auth.logout", actor: staff.email, outcome: "ok" });

  // Clears only the staff cookie. A customer signed in on the same browser keeps
  // their `sb_customer_session` — the two sessions are independent by design.
  await signOut({ redirectTo: STAFF_LOGIN_PATH });
}
