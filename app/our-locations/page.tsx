import type { Metadata } from "next";
import Image from "next/image";

import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeLocation } from "@/lib/shopify/entities";
import { cdnImage, metafieldMetaobjects, metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Our Locations",
  description: "The Antwerp showroom and the Bali workshop — where to find Studio Bizar in person.",
  alternates: { canonical: "/our-locations" },
};

export default async function OurLocationsPage() {
  const page = await getPage("our-locations").catch(() => null);
  const metafields = toMetafieldMap(page?.metafields);

  const intro = metafieldRichText(metafields, "intro_body");
  const locations = metafieldMetaobjects(metafields, "locations")
    .map(normalizeLocation)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

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
          <ul className="mt-16 grid gap-x-16 gap-y-16 lg:grid-cols-2">
            {locations.map((location) => (
              <li key={location.handle}>
                <article>
                  {location.image && (
                    <div className="relative aspect-3/2 w-full overflow-hidden bg-foreground/5">
                      <Image
                        src={cdnImage(location.image.url)}
                        alt={location.image.altText ?? location.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1023px) 100vw, 50vw"
                      />
                    </div>
                  )}

                  <div className="mt-5">
                    {location.kind && (
                      <p className="text-tertiary text-muted uppercase tracking-[0.06em]">{location.kind}</p>
                    )}
                    <h2 className="text-h3 mt-1">{location.name}</h2>

                    {location.address && (
                      <p className="text-secondary mt-3 whitespace-pre-line">{location.address}</p>
                    )}

                    <dl className="text-secondary mt-3 flex flex-col gap-1">
                      {location.phone && (
                        <div className="flex gap-2">
                          <dt className="text-muted">Phone</dt>
                          <dd>
                            <a href={`tel:${location.phone.replace(/\s+/g, "")}`} className="sb-underline">
                              {location.phone}
                            </a>
                          </dd>
                        </div>
                      )}
                      {location.email && (
                        <div className="flex gap-2">
                          <dt className="text-muted">Email</dt>
                          <dd>
                            <a href={`mailto:${location.email}`} className="sb-underline">
                              {location.email}
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>

                    {location.hours && (
                      <p className="text-tertiary mt-3 whitespace-pre-line text-muted">{location.hours}</p>
                    )}

                    {location.mapUrl && (
                      <a
                        href={location.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-button sb-underline mt-4 inline-block uppercase tracking-[0.06em]"
                      >
                        View on map
                      </a>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Container>

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
