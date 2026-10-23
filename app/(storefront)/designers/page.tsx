import type { Metadata } from "next";

import { DesignerGrid } from "@/components/designer/designer-grid";
import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { METAOBJECT_TYPES, getMetaobjects, getPage } from "@/lib/shopify";
import { normalizeDesigner, sortDesigners } from "@/lib/shopify/entities";

const METADATA: Metadata = {
  title: "Our Designers",
  description:
    "The designers and studios behind Studio Bizar — the people who draw the pieces and choose the materials.",
  alternates: { canonical: "/designers" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("professionals").catch(() => null), METADATA);
}

export default async function DesignersPage() {
  const [page, intro] = await Promise.all([
    getMetaobjects(METAOBJECT_TYPES.designer, { first: 200 }),
    getPage("professionals").catch(() => null),
  ]);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(intro);
  if (doc && intro) return <BuilderPage doc={doc} title={intro.title} />;

  const designers = sortDesigners(page.items.map(normalizeDesigner));

  return (
    <PageShell surface="mocha">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">Our Designers</h1>
          {intro?.bodySummary && <p className="text-body mt-6">{intro.bodySummary}</p>}
        </header>

        {designers.length === 0 ? (
          <p className="text-body mt-16 text-muted">No designers published yet.</p>
        ) : (
          <DesignerGrid designers={designers} className="mt-12" />
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
