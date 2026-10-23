import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  title: "Care & Maintenance",
  description:
    "General care for wood, upholstery, weaving, metal and stone — the routine that keeps a Studio Bizar piece looking the way it did when it left the workshop.",
  alternates: { canonical: "/care-maintenance" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("care-maintenance").catch(() => null), METADATA);
}

export default async function CareMaintenancePage() {
  const page = await getPage("care-maintenance").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;

  const metafields = toMetafieldMap(page?.metafields);
  const intro = metafieldRichText(metafields, "intro_body");

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Care & Maintenance"}</h1>

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
