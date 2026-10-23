import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ContactCta } from "@/components/sections/contact-cta";
import { LocationList } from "@/components/sections/location-list";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeLocation, sortLocations } from "@/lib/shopify/entities";
import { metafieldMetaobjects, metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  title: "Our Locations",
  description: "The Antwerp showroom and the Bali workshop — where to find Studio Bizar in person.",
  alternates: { canonical: "/our-locations" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("our-locations").catch(() => null), METADATA);
}

export default async function OurLocationsPage() {
  const page = await getPage("our-locations").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;
  const metafields = toMetafieldMap(page?.metafields);

  const intro = metafieldRichText(metafields, "intro_body");
  const locations = sortLocations(metafieldMetaobjects(metafields, "locations").map(normalizeLocation));

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Our Locations"}</h1>
        {intro && (
          <div className="sb-prose mt-10 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: intro }} />
        )}

        {locations.length === 0 ? (
          <p className="text-body mt-12 text-muted">No locations published yet.</p>
        ) : (
          <LocationList locations={locations} className="mt-16" />
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
