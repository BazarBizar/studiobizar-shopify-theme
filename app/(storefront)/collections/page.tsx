import type { Metadata } from "next";

import { CollectionGrid } from "@/components/collection/collection-grid";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { getListedCollections, getPage } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "The Studio Bizar signature collections, each one built around a single material idea.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const [collections, intro] = await Promise.all([
    getListedCollections(),
    getPage("collections").catch(() => null),
  ]);

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">Collections</h1>
          {intro?.bodySummary && <p className="text-body mt-6">{intro.bodySummary}</p>}
        </header>

        {collections.length === 0 ? (
          <p className="text-body mt-16 text-muted">No collections published yet.</p>
        ) : (
          <CollectionGrid collections={collections} className="mt-12" />
        )}
      </Container>
    </PageShell>
  );
}
