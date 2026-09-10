import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { Accordion } from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getMetaobjects, getPage } from "@/lib/shopify";
import { fieldInt, fieldRichText, fieldText, toFieldMap } from "@/lib/shopify/transforms";

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

  const items = entries.items
    .map((entry) => {
      const fields = toFieldMap(entry.fields);
      return {
        handle: entry.handle,
        question: fieldText(fields, "question") ?? entry.handle,
        answer: fieldRichText(fields, "answer"),
        category: fieldText(fields, "category"),
        sortOrder: fieldInt(fields, "sort_order"),
      };
    })
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  // Grouped by category, in the order the categories first appear.
  const groups = items.reduce<{ category: string; items: typeof items }[]>((acc, item) => {
    const category = item.category ?? "General";
    const found = acc.find((group) => group.category === category);
    if (found) found.items.push(item);
    else acc.push({ category, items: [item] });
    return acc;
  }, []);

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "FAQ"}</h1>

        {items.length === 0 ? (
          <p className="text-body mt-10 text-muted">No questions published yet.</p>
        ) : (
          <div className="mt-12 max-w-[52rem]">
            {groups.map((group) => (
              <section key={group.category} className="mb-12">
                <h2 className="text-h3 mb-2 text-muted uppercase tracking-[0.06em]">
                  {group.category}
                </h2>
                {group.items.map((item) => (
                  <Accordion key={item.handle} title={item.question}>
                    <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                  </Accordion>
                ))}
              </section>
            ))}
          </div>
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
