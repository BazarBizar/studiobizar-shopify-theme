import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BuilderPage } from "@/components/page-builder/builder-page";
import { PreviewBridge } from "@/components/page-builder/preview-bridge";
import { Providers } from "@/components/providers";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { BuilderError, getBuilderState } from "@/lib/admin/page-builder";
import { pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";

/**
 * The page builder's preview: the DRAFT, drawn by the same `BuilderPage` the
 * live route uses, with the same components and the same Shopify data. Nothing
 * here is a preview-only rendering of anything.
 *
 * WHY IT LIVES HERE. The draft is storefront access NONE, so it can only be read
 * through the Admin API — and `lib/admin` may only be imported from the admin
 * half of the app. The route sits beside `/admin`, not inside it, so it renders
 * without the panel's sidebar and with the storefront's own providers.
 *
 * It is gated twice, as `/admin` is: `proxy.ts` turns away a request with no
 * staff cookie, and `currentStaff()` below verifies the one that has it. The
 * proxy also gives this path the one CSP difference it needs — it may be framed,
 * by this origin only, which is how the builder shows it.
 *
 * `?version=live` shows the published copy instead, for comparison.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ params, searchParams }: PageProps<"/preview/pages/[id]">) {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const { id } = await params;
  const { version } = await searchParams;

  const gid = pageIdFromParam(id);
  if (!gid) notFound();

  let state;
  try {
    state = await getBuilderState(gid);
  } catch (error) {
    if (error instanceof PageNotFoundError || error instanceof BuilderError) notFound();
    throw error;
  }

  const doc = version === "live" && state.published ? state.published : state.draft;

  return (
    <Providers>
      <PreviewBridge />
      <BuilderPage doc={doc} title={state.page.title} />
    </Providers>
  );
}
