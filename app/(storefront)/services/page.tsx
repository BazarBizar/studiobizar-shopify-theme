import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

import { PageShell } from "@/components/layout/page-shell";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getMetaobjects, getPage } from "@/lib/shopify";
import { normalizeCaptionedImage } from "@/lib/shopify/entities";
import {
  fieldInt,
  fieldRichText,
  fieldText,
  metafieldMetaobjects,
  metafieldRichText,
  toFieldMap,
  toMetafieldMap,
} from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Through our Design Program we deliver made-to-order pieces, private label collections and tailored solutions — from concept to completion.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const [page, entries] = await Promise.all([
    getPage("our-services").catch(() => null),
    getMetaobjects("service", { first: 100 }).catch(() => ({ items: [] })),
  ]);

  const metafields = toMetafieldMap(page?.metafields);
  const intro = metafieldRichText(metafields, "intro_body");
  const features = metafieldMetaobjects(metafields, "feature_images").map(normalizeCaptionedImage);

  // `metaobjects` has no sort argument, so ordering happens here.
  const services = entries.items
    .map((entry) => {
      const fields = toFieldMap(entry.fields);
      return {
        handle: entry.handle,
        title: fieldText(fields, "title") ?? entry.handle,
        body: fieldRichText(fields, "body"),
        sortOrder: fieldInt(fields, "sort_order"),
      };
    })
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title),
    );

  return (
    <PageShell surface="blue">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">Design Program</h1>
        {intro && (
          <div className="sb-prose mt-8 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: intro }} />
        )}
      </Container>

      {services.length > 0 && (
        <Container className="pb-section">
          <h2 className="text-h2 mb-10">Our Services</h2>
          {/* Two columns in the design, at x=20 and x=874. */}
          <ul className="grid gap-x-16 gap-y-10 lg:grid-cols-2">
            {services.map((service) => (
              <li key={service.handle}>
                <h3 className="text-h3">{service.title}</h3>
                {service.body && (
                  <div
                    className="sb-prose mt-2 max-w-[30rem] text-muted"
                    dangerouslySetInnerHTML={{ __html: service.body }}
                  />
                )}
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container className="pb-section">
        <h2 className="text-h2">Beyond The Project</h2>
        <p className="text-body mt-6 max-w-[44rem]">
          Looking for ready-to-order collections? Our Bazar Bizar Partner Program provides direct
          access to real-time stock, pricing and an efficient order platform for professionals.
          Combined with our Design Program, it offers maximum flexibility.
        </p>
        <ButtonLink href="/contact" className="mt-8">
          read more
        </ButtonLink>
      </Container>

      {features.length > 0 && <CaptionedRow images={features} />}

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
