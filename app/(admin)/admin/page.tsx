import { currentStaff } from "@/lib/admin/auth";

/**
 * Phase 1 dashboard: proof that the gate works and a home for the statistics
 * added in Phase 5. The layout has already established there is a session; this
 * reads it again rather than taking it as a prop, because a page that depends on
 * its parent's guard is a page that breaks the day the guard moves.
 */
export default async function AdminDashboardPage() {
  const staff = await currentStaff();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-admin-fg text-lg font-semibold">Dashboard</h1>
      <p className="text-admin-muted mt-1 text-xs">Signed in as {staff?.email}</p>

      <div className="border-admin-border bg-admin-panel rounded-admin mt-6 border p-4">
        <h2 className="text-admin-fg text-sm font-semibold">Foundation is in place</h2>
        <p className="text-admin-muted mt-2 text-xs">
          Staff sign-in, the session gate, rate limiting, the audit log and the Admin API client are
          wired up. Content editing arrives with the generic metaobject screens.
        </p>
      </div>
    </div>
  );
}
