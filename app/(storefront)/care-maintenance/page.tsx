import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Care & Maintenance",
  description:
    "General care for wood, upholstery, weaving, metal and stone — the routine that keeps a Studio Bizar piece looking the way it did when it left the workshop.",
  alternates: { canonical: "/care-maintenance" },
};

export default async function CareMaintenancePage() {
  const page = await getPage("care-maintenance").catch(() => null);
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
