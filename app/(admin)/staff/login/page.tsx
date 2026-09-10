import type { Metadata } from "next";

import { StaffLoginForm } from "@/components/admin/staff-login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Card, CardContent } from "@/components/admin/ui/card";
import { adminConfigured } from "@/lib/admin/env";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

/**
 * Staff sign-in, at `/staff/login` rather than `/login` — this storefront serves B2B
 * customers who have their own Shopify customer accounts, and the two must not share a
 * form, a cookie, or a URL.
 *
 * `proxy.ts` deliberately does NOT redirect an already-signed-in visitor away from this
 * page; see the note there about why that rule causes redirect loops.
 *
 * `data-admin` is on the wrapper because this page sits outside the admin layout — it has
 * no sidebar and no session — but still needs the panel's tokens.
 */
export default async function StaffLoginPage({ searchParams }: PageProps<"/staff/login">) {
  const { from } = await searchParams;
  const configured = adminConfigured();

  return (
    <div data-admin className="flex min-h-svh flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Studio Bizar
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Staff sign in</h1>
        </div>

        {configured ? (
          <StaffLoginForm from={typeof from === "string" ? from : "/admin"} />
        ) : (
          /* An honest "not set up" state rather than a 500, the same way the storefront's
             account page handles an unconfigured Customer Account API. The missing keys
             are named in the server log, never here. */
          <Alert>
            <AlertTitle>Not configured yet</AlertTitle>
            <AlertDescription>
              The panel needs <code className="font-mono">ADMIN_ALLOWED_EMAILS</code>,{" "}
              <code className="font-mono">ADMIN_PASSWORD_HASH</code> and{" "}
              <code className="font-mono">AUTH_SECRET</code> in the environment. See{" "}
              <code className="font-mono">.env.example</code> and the README.
            </AlertDescription>
          </Alert>
        )}

        <Card className="gap-0 py-3">
          <CardContent className="px-3">
            <p className="text-muted-foreground text-xs">
              Customers sign in from the storefront account page, not here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
