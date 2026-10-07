import type { Metadata } from "next";

import { ContactDetails } from "@/components/contact/contact-details";
import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeContactChannel, sortContactChannels } from "@/lib/shopify/entities";
import { metafieldList, metafieldMetaobjects, metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  title: "Contact",
  description:
    "Studio Bizar, Duffelsesteenweg 152, Kontich, Antwerp. General, trade and press contacts, or send us a message.",
  alternates: { canonical: "/contact" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("contact").catch(() => null), METADATA);
}

export default async function ContactPage() {
  const page = await getPage("contact").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;
  const metafields = toMetafieldMap(page?.metafields);

  const intro = metafieldRichText(metafields, "intro_body");
  const inquiryTypes = metafieldList(metafields, "inquiry_types");

  const channels = sortContactChannels(metafieldMetaobjects(metafields, "channels").map(normalizeContactChannel));

  return (
    <PageShell surface="mocha" footerSurface="dark">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">Contact</h1>
        {intro && (
          <div className="sb-prose mt-6 max-w-[36rem] text-h2" dangerouslySetInnerHTML={{ __html: intro }} />
        )}

        <ContactDetails channels={channels} inquiryTypes={inquiryTypes} className="mt-16" />
      </Container>

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
