import type { Metadata } from "next";

import { CollectionCard } from "@/components/collection/collection-card";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { getCollections, getPage } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "The Studio Bizar signature collections — Duna, Safari, Hardy and Arc Teak. Each one built around a single material idea.",
  alternates: { canonical: "/collections" },
};

/** Shopify auto-creates this for the theme's home page; it is not a collection. */
const HIDDEN_HANDLES = new Set(["frontpage"]);

export default async function CollectionsPage() {
  const [page, intro] = await Promise.all([
    getCollections({ first: 100 }),
    getPage("collections").catch(() => null),
  ]);

  const collections = page.items
    .filter((collection) => !HIDDEN_HANDLES.has(collection.handle))
    .sort((a, b) => {
      // Curated order first, then anything without a sort_order, alphabetically.
      const left = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const right = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.title.localeCompare(b.title);
    });

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
          <ul className="sb-grid-4 mt-12">
            {collections.map((collection) => (
              <li key={collection.id}>
                <CollectionCard collection={collection} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
