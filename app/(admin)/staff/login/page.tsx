import type { Metadata } from "next";

import { StaffLoginForm } from "@/components/admin/staff-login-form";
import { adminConfigured } from "@/lib/admin/env";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

/**
 * Staff sign-in, at `/staff/login` rather than `/login` — this storefront serves
 * B2B customers who have their own Shopify customer accounts, and the two must
 * not share a form, a cookie, or a URL.
 *
 * `proxy.ts` deliberately does NOT redirect an already-signed-in visitor away
 * from this page; see the note there about why that rule causes redirect loops.
 */
export default async function StaffLoginPage({ searchParams }: PageProps<"/staff/login">) {
  const { from } = await searchParams;
  const configured = adminConfigured();

  return (
    <div data-admin className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-admin-muted text-xs font-medium tracking-[0.12em] uppercase">
            Studio Bizar
          </p>
          <h1 className="text-admin-fg mt-1 text-xl">Staff sign in</h1>
        </div>

        {configured ? (
          <StaffLoginForm from={typeof from === "string" ? from : "/admin"} />
        ) : (
          /* An honest "not set up" state rather than a 500, the same way the
             storefront's account page handles an unconfigured Customer Account
             API. The missing keys are named in the server log, never here. */
          <div className="border-admin-border bg-admin-panel rounded-admin border p-4">
            <h2 className="text-admin-fg text-sm font-semibold">Not configured yet</h2>
            <p className="text-admin-muted mt-2 text-xs">
              The admin panel needs <code>ADMIN_ALLOWED_EMAILS</code>,{" "}
              <code>ADMIN_PASSWORD_HASH</code> and <code>AUTH_SECRET</code> in the environment.
              See <code>.env.example</code> and the README.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
