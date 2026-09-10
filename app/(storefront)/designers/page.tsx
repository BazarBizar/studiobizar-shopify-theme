import type { Metadata } from "next";

import { DesignerCard } from "@/components/designer/designer-card";
import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { METAOBJECT_TYPES, getMetaobjects, getPage } from "@/lib/shopify";
import { normalizeDesigner } from "@/lib/shopify/entities";

export const metadata: Metadata = {
  title: "Our Designers",
  description:
    "The designers and studios behind Studio Bizar — the people who draw the pieces and choose the materials.",
  alternates: { canonical: "/designers" },
};

export default async function DesignersPage() {
  const [page, intro] = await Promise.all([
    getMetaobjects(METAOBJECT_TYPES.designer, { first: 200 }),
    getPage("professionals").catch(() => null),
  ]);

  // `metaobjects` has no sort argument, so ordering happens here.
  const designers = page.items
    .map(normalizeDesigner)
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    );

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
          <ul className="sb-grid-4 mt-12 gap-y-12">
            {designers.map((designer, index) => (
              <li key={designer.handle}>
                <DesignerCard designer={designer} priority={index < 4} />
              </li>
            ))}
          </ul>
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
