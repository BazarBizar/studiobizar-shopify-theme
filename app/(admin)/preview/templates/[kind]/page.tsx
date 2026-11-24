import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BuilderPage } from "@/components/page-builder/builder-page";
import { LivePreview } from "@/components/page-builder/live-preview";
import { PreviewBridge } from "@/components/page-builder/preview-bridge";
import { loadTemplateRecord } from "@/components/page-builder/template-record";
import { Providers } from "@/components/providers";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { getTemplateState } from "@/lib/admin/templates";
import { isTemplateKind } from "@/lib/page-builder/template-kinds";

import { renderTemplatePreview } from "../../actions";

/**
 * A template's preview: its DRAFT, drawn by the same `BuilderPage` its route uses,
 * around the item picked in the editor (`?item=` — a product's handle, a search word).
 * Gated like `/preview/pages/[id]`: the proxy turns away a request with no staff
 * cookie, `currentStaff()` verifies the one that has it.
 *
 * `?version=live` shows the published template instead.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function TemplatePreviewPage({ params, searchParams }: PageProps<"/preview/templates/[kind]">) {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const { kind } = await params;
  const { item, version } = await searchParams;
  if (!isTemplateKind(kind)) notFound();

  const [state, loaded] = await Promise.all([getTemplateState(kind), loadTemplateRecord(kind, typeof item === "string" ? item : undefined)]);

  if (!loaded) {
    return (
      <Providers>
        <p style={{ padding: 32, fontFamily: "sans-serif" }}>There is nothing of this kind in the store yet to preview the template with.</p>
      </Providers>
    );
  }

  const doc = version === "live" && state.published ? state.published : state.draft;
  const page = <BuilderPage doc={doc} title={loaded.title} record={loaded.record} preview />;

  return (
    <Providers>
      <PreviewBridge />
      {version === "live" ? (
        page
      ) : (
        <LivePreview initial={page} render={renderTemplatePreview.bind(null, kind, typeof item === "string" ? item : "")} />
      )}
    </Providers>
  );
}
