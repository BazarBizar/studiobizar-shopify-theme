import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { SiteTextsEditor } from "@/components/admin/site-texts/site-texts-editor";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { storefrontUrl } from "@/lib/admin/links";
import { siteTextsView } from "@/lib/admin/site-texts";

export const metadata = { title: "Site texts" };

/**
 * The site's fixed wording — what used to be written into the pages, forms and emails
 * themselves. See `lib/site-texts.ts` for the list and `lib/admin/site-texts.ts` for the save.
 */
export default async function SiteTextsPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const view = await siteTextsView();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Site texts"
        description="The wording that is the same on every product, collection and project page, in the inquiry and contact forms, and in the inquiry emails."
      />
      <SiteTextsEditor view={view} siteUrl={storefrontUrl("/")?.replace(/\/$/, "") ?? null} />
    </div>
  );
}
