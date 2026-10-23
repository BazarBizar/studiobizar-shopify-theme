import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, publishedDocument } from "@/components/page-builder/builder-page";
import { LivePreview } from "@/components/page-builder/live-preview";
import { PreviewBridge } from "@/components/page-builder/preview-bridge";
import { Providers } from "@/components/providers";
import { Container } from "@/components/ui/container";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { getThemeState } from "@/lib/admin/theme-builder";
import { getPage } from "@/lib/shopify";

import { renderThemePreview } from "../actions";

/**
 * The Theme Builder's preview: the DRAFT header and footer around a real page of the
 * site (the home page unless another is named), drawn by the same `PageShell` every
 * page uses. Gated like the page builder's preview — see
 * `app/(admin)/preview/pages/[id]/page.tsx` for why it lives beside `/admin`.
 *
 * `?page=<handle>` chooses the page; `?version=live` shows the published layout.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function ThemePreview({ searchParams }: PageProps<"/preview/theme">) {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const { page: handle, version } = await searchParams;
  const state = await getThemeState();
  const theme = version === "live" ? state.published : state.draft;

  const shown = typeof handle === "string" && /^[a-z0-9-]+$/.test(handle) ? handle : "home";
  const page = await getPage(shown).catch(() => null);
  const doc = publishedDocument(page);

  const body = doc ? (
    <BuilderPage doc={doc} title={page!.title} theme={theme} />
  ) : (
    // A page drawn by its own code: the header and footer around a plain body.
    <PageShell theme={theme}>
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Preview"}</h1>
        <p className="text-body text-muted mt-6 max-w-[38rem]">The header and footer, around this page.</p>
      </Container>
    </PageShell>
  );

  return (
    <Providers>
      <PreviewBridge />
      {version === "live" ? (
        body
      ) : (
        // Follows the editor as it changes the layout — see `LivePreview`.
        <LivePreview initial={body} render={renderThemePreview.bind(null, shown)} />
      )}
    </Providers>
  );
}
