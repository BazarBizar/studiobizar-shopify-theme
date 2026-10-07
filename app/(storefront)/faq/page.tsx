import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ContactCta } from "@/components/sections/contact-cta";
import { FaqGroups } from "@/components/sections/faq-groups";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getMetaobjects, getPage } from "@/lib/shopify";
import { groupFaqItems, normalizeFaqItem } from "@/lib/shopify/entities";

const METADATA: Metadata = {
  title: "FAQ",
  description:
    "Lead times, minimum orders, shipping, care and materials — the questions we are asked most often.",
  alternates: { canonical: "/faq" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("faq").catch(() => null), METADATA);
}

export default async function FaqPage() {
  const [page, entries] = await Promise.all([
    getPage("faq").catch(() => null),
    getMetaobjects("faq_item", { first: 100 }).catch(() => ({ items: [] })),
  ]);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;

  const items = entries.items.map(normalizeFaqItem);

  // Grouped by category, in the order the categories first appear.
  const groups = groupFaqItems(items);

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "FAQ"}</h1>

        {items.length === 0 ? (
          <p className="text-body mt-10 text-muted">No questions published yet.</p>
        ) : (
          <FaqGroups groups={groups} className="mt-12" />
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
