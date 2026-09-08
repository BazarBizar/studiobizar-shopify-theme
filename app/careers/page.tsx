import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "A small team split between Antwerp and the workshops of Bali and Java. We grow slowly — if there's a fit, write to us and tell us why.",
  alternates: { canonical: "/careers" },
};

export default async function CareersPage() {
  const page = await getPage("careers").catch(() => null);
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
