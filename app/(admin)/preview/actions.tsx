"use server";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, publishedDocument } from "@/components/page-builder/builder-page";
import { Container } from "@/components/ui/container";
import { currentStaff } from "@/lib/admin/auth";
import { parsePageDocument } from "@/lib/page-builder/document";
import { getPage } from "@/lib/shopify";
import { readThemeContent } from "@/lib/theme-builder/layout";

/**
 * LIVE PREVIEW. The editors send what is on screen — not yet saved — and get the page
 * drawn from it, by the same server components the live route uses. So the preview
 * follows typing within a fraction of a second, instead of waiting for the draft to
 * reach Shopify and the page to be fetched back.
 *
 * Nothing is stored and nothing is published: the content is read leniently (exactly
 * as a saved draft would be), drawn, and forgotten. Staff only, like the preview
 * routes themselves.
 */

async function assertStaff() {
  if (!(await currentStaff())) throw new Error("Sign in to preview.");
}

/** A page being built, drawn from the editor's current content. */
export async function renderPagePreview(title: string, content: unknown) {
  await assertStaff();
  const parsed = parsePageDocument(JSON.stringify(content ?? null));
  if (!parsed.ok) return null;
  return <BuilderPage doc={parsed.doc} title={title} preview />;
}

/** The Theme Builder's header and footer, drawn from the editor's current content around a real page. */
export async function renderThemePreview(handle: string, content: unknown) {
  await assertStaff();
  const theme = readThemeContent(content);
  const page = await getPage(/^[a-z0-9-]+$/.test(handle) ? handle : "home").catch(() => null);
  const doc = publishedDocument(page);
  if (doc) return <BuilderPage doc={doc} title={page!.title} theme={theme} />;
  return (
    <PageShell theme={theme}>
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Preview"}</h1>
        <p className="text-body text-muted mt-6 max-w-[38rem]">The header and footer, around this page.</p>
      </Container>
    </PageShell>
  );
}
