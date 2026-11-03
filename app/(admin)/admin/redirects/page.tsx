import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { RedirectsScreen } from "@/components/admin/redirects/redirects-screen";
import { currentStaff } from "@/lib/admin/auth";
import { listCollections } from "@/lib/admin/collections";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { linkTargetsFrom } from "@/lib/admin/link-targets";
import { storefrontUrl } from "@/lib/admin/links";
import { listPages } from "@/lib/admin/pages";
import { listRedirects } from "@/lib/admin/redirects";

export const metadata = { title: "Redirects" };

/**
 * Website → Redirects: old addresses that send visitors on to new ones. See
 * `lib/admin/redirects.ts`, and `proxy.ts` for where they are followed.
 */
export default async function RedirectsPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const [redirects, pages, collections] = await Promise.all([listRedirects(), listPages(), listCollections()]);
  const site = storefrontUrl("/")?.replace(/\/$/, "") ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redirects"
        description="Send visitors from an old address to a new one, so links in emails, on Google and on other websites keep working."
      />
      <RedirectsScreen
        initial={redirects}
        destinations={linkTargetsFrom(pages, collections)}
        siteUrl={site}
        siteHost={site ? new URL(site).host : null}
      />
    </div>
  );
}
