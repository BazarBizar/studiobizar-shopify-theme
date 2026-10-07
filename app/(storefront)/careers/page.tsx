import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  title: "Careers",
  description:
    "A small team split between Antwerp and the workshops of Bali and Java. We grow slowly — if there's a fit, write to us and tell us why.",
  alternates: { canonical: "/careers" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("careers").catch(() => null), METADATA);
}

export default async function CareersPage() {
  const page = await getPage("careers").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;

  const metafields = toMetafieldMap(page?.metafields);
  const intro = metafieldRichText(metafields, "intro_body");

  return (
    <PageShell surface="mocha">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Careers"}</h1>

        {intro && (
          <div className="sb-prose mt-10 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: intro }} />
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
