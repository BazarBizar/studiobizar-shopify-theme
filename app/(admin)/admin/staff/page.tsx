import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { StaffScreen } from "@/components/admin/staff/staff-screen";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { isOwner, listStaff, MIN_PASSWORD_LENGTH } from "@/lib/admin/staff";

export const metadata = { title: "Staff & sign-in" };

/**
 * Who may sign in to this panel, and each person's own password — what used to be
 * `ADMIN_ALLOWED_EMAILS` and `ADMIN_PASSWORD_HASH` in `.env` only. See
 * `lib/admin/staff.ts` for where it is kept and why owners cannot be removed here.
 */
export default async function StaffPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const rows = await listStaff();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & sign-in"
        description="Who can sign in to this panel, and your own password."
      />
      <StaffScreen me={staff.email} owner={isOwner(staff.email)} rows={rows} minLength={MIN_PASSWORD_LENGTH} />
    </div>
  );
}
