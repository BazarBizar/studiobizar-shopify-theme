import "server-only";

import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { BUILDER_METAFIELDS, parsePageDocument, type PageDocument } from "@/lib/page-builder/document";
import type { Maybe, ShopifyPage } from "@/lib/shopify/types";
import { toMetafieldMap } from "@/lib/shopify/transforms";

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
export function BuilderPage({ doc, title, preview = false }: { doc: PageDocument; title: string; preview?: boolean }) {
  const hasHeading = doc.sections.some((section) => section.visible && section.type === "page_heading");

  return (
    <PageShell surface={doc.page.surface} footerSurface={doc.page.footerSurface}>
      {!hasHeading && <h1 className="sr-only">{title}</h1>}
      <SectionRenderer doc={doc} context={{ pageTitle: title, preview }} />
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

/* -------------------------------------------------------------------------- *
 * MVP-2: hand-built routes that opt in
 * -------------------------------------------------------------------------- */

/**
 * The page's PUBLISHED builder document, or null — for a hand-built route that
 * has a migration (`lib/page-builder/migrations.ts`):
 *
 *   const doc = publishedDocument(page);
 *   if (doc && page) return <BuilderPage doc={doc} title={page.title} />;
 *   …the route's own JSX, unchanged…
 *
 * Null when there is no document, and ALSO when it cannot be read, so a damaged
 * metafield sends the route back to its own JSX rather than to a blank page. A
 * draft is never returned: the storefront cannot read one.
 */
export function publishedDocument(page: Maybe<ShopifyPage>): PageDocument | null {
  if (!page) return null;
  const parsed = parsePageDocument(toMetafieldMap(page.metafields)[BUILDER_METAFIELDS.published]?.value);
  if (!parsed.ok && parsed.reason === "invalid") {
    console.error(`[page-builder] ${page.handle}: the published document is not readable — rendering the page's own layout.`);
  }
  return parsed.ok ? parsed.doc : null;
}

/**
 * Metadata for an opted-in route: Shopify's own SEO fields while the builder
 * version is live — that is what the builder publishes them to — and the route's
 * hand-written metadata otherwise, or wherever a field is left empty.
 */
export function builderMetadata(page: Maybe<ShopifyPage>, fallback: Metadata): Metadata {
  if (!page || !publishedDocument(page)) return fallback;
  return {
    ...fallback,
    title: page.seo.title ?? fallback.title,
    description: page.seo.description ?? fallback.description,
  };
}
