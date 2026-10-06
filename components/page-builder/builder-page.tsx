import "server-only";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import type { PageDocument } from "@/lib/page-builder/document";

import { SectionRenderer } from "./section-renderer";

/**
 * A whole builder page: the shell in the document's chosen ground, then its
 * sections.
 *
 * The page has exactly one `h1`. When the operator has placed a Page heading
 * section, that is it; otherwise the title is rendered for screen readers and
 * search engines only — the same arrangement the landing page uses under its
 * image-only hero.
 */
export function BuilderPage({ doc, title }: { doc: PageDocument; title: string }) {
  const hasHeading = doc.sections.some((section) => section.visible && section.type === "page_heading");

  return (
    <PageShell surface={doc.page.surface} footerSurface={doc.page.footerSurface}>
      {!hasHeading && <h1 className="sr-only">{title}</h1>}
      <SectionRenderer doc={doc} context={{ pageTitle: title }} />
    </PageShell>
  );
}

/**
 * What a builder page shows when its document cannot be read at all — the
 * Shopify page's own title and body, as the legal pages render them. Never a
 * blank page and never a 500 because a metafield was edited by hand.
 */
export function BuilderFallback({ title, body }: { title: string; body: string }) {
  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{title}</h1>
        {body && <div className="sb-prose mt-10 max-w-[46rem]" dangerouslySetInnerHTML={{ __html: body }} />}
      </Container>
    </PageShell>
  );
}
