import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminProviders } from "@/components/admin/admin-providers";
import { AppBreadcrumbs } from "@/components/admin/app-breadcrumbs";
import { AppSidebar, type SidebarSection } from "@/components/admin/app-sidebar";
import { Separator } from "@/components/admin/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/admin/ui/sidebar";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { buildNavigation } from "@/lib/admin/navigation";

import { staffSignOut } from "./actions";

/**
 * The panel is never static. The layout reads the session cookie and every screen reads
 * Shopify with `no-store`, so a prerender attempt can only fail — declaring it here stops
 * the build from trying, which is both faster and quieter than letting it discover the
 * fact through a thrown dynamic-usage error on each route.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  // `proxy.ts` sends `X-Robots-Tag` as well, so a crawler that ignores one still
  // sees the other.
  robots: { index: false, follow: false },
};

/**
 * THE AUTHORITATIVE AUTH GATE.
 *
 * `proxy.ts` only checks that a staff cookie exists — it cannot verify a signature
 * without loading Auth.js into the proxy runtime. This layout is where the cookie is
 * actually verified AND where the email is re-checked against
 * `ADMIN_ALLOWED_EMAILS`, so removing someone from the allowlist locks them out on
 * their next page view rather than whenever their session happens to expire.
 *
 * Every route handler under `/api/admin/**` repeats the check independently
 * (`guard()` in `lib/admin/api.ts`). A layout protects pages, not fetches; a `curl`
 * to an API route never renders a layout.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  /**
   * The per-request nonce `proxy.ts` minted, on its way to next-themes.
   *
   * Next finds this by itself for its OWN bootstrap scripts — it parses the
   * `Content-Security-Policy` request header the proxy sets — but that does nothing for
   * an inline `<script>` a library renders into the tree. Until this was threaded
   * through, `x-nonce` was written by the proxy and read by nobody.
   */
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  /**
   * Derived from the metaobject definitions that exist in the store right now —
   * there is no hardcoded list of screens. A definition created in Shopify appears
   * on the next page load, grouped by `lib/admin/groups.ts` or, if nobody has
   * classified it, under "Other".
   */
  const groups = await buildNavigation();

  const sections: SidebarSection[] = groups.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map((item) => ({
      href: item.href,
      label: item.label,
      readOnly: item.readOnly,
      badge: item.badge,
      type: item.type ?? null,
      group: group.key,
    })),
  }));

  /** Type -> display name, so the breadcrumb can say "FAQ" rather than "faq_item". */
  const crumbLabels = Object.fromEntries(
    groups.flatMap((group) =>
      group.items
        .filter((item) => item.href !== "/admin")
        .map((item) => [item.href.replace("/admin/", ""), item.label]),
    ),
  );

  return (
    <AdminProviders nonce={nonce}>
      {/* `data-admin` is what re-points the shared utility names at the panel's
          tokens — see the bridge block in globals.css. */}
      <div data-admin className="flex min-h-svh flex-1">
        <SidebarProvider>
          <AppSidebar sections={sections} email={staff.email} onSignOut={staffSignOut} />

          <SidebarInset className="min-w-0">
            {/* h-14 and z-10 are fixed by convention: anything sticky inside a page
                must use top-14, or it will sit under this header. */}
            <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-1 h-4" />
              <AppBreadcrumbs labels={crumbLabels} />
            </header>

            <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </AdminProviders>
  );
}
