import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminProviders } from "@/components/admin/admin-providers";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { buildNavigation } from "@/lib/admin/navigation";

import { staffSignOut } from "./actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  // The panel must never be indexed. `proxy.ts` sends `X-Robots-Tag` as well, so
  // a crawler that ignores one still sees the other.
  robots: { index: false, follow: false },
};

/**
 * THE AUTHORITATIVE AUTH GATE.
 *
 * `proxy.ts` only checks that a staff cookie exists — it cannot verify a
 * signature without loading Auth.js into the proxy runtime. This layout is where
 * the cookie is actually verified AND where the email is re-checked against
 * `ADMIN_ALLOWED_EMAILS`, so that removing someone from the allowlist locks them
 * out on their next page view instead of whenever their session happens to
 * expire.
 *
 * Every route handler under `/api/admin/**` repeats the check independently
 * (`guard()` in `lib/admin/api.ts`). A layout protects pages, not fetches; a
 * `curl` to an API route never renders a layout.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  /**
   * Derived from the metaobject definitions that exist in the store right now —
   * there is no hardcoded list of screens. A definition created in Shopify shows
   * up on the next page load, grouped by `lib/admin/groups.ts` or, if nobody has
   * classified it, under "Other".
   */
  const groups = await buildNavigation();

  return (
    <AdminProviders>
      <div data-admin className="flex min-h-screen flex-1">
        <AdminSidebar groups={groups} email={staff.email} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-admin-border bg-admin-panel flex items-center justify-between gap-4 border-b px-6 py-3">
            <p className="text-admin-muted text-xs">
              Editing <span className="text-admin-fg font-medium">Studio Bizar</span> on Shopify
            </p>

            <form action={staffSignOut}>
              <button
                type="submit"
                className="border-admin-border text-admin-fg hover:bg-admin-raised rounded-admin border px-2.5 py-1.5 text-xs"
              >
                Sign out
              </button>
            </form>
          </header>

          <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
