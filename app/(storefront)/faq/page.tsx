import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { FaqGroups } from "@/components/sections/faq-groups";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getMetaobjects, getPage } from "@/lib/shopify";
import { groupFaqItems, normalizeFaqItem } from "@/lib/shopify/entities";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Lead times, minimum orders, shipping, care and materials — the questions we are asked most often.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const [page, entries] = await Promise.all([
    getPage("faq").catch(() => null),
    getMetaobjects("faq_item", { first: 100 }).catch(() => ({ items: [] })),
  ]);

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
