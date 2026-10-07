import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeCaptionedImage } from "@/lib/shopify/entities";
import { metafieldMetaobjects, metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  title: "Our Artisans",
  description:
    "Every Studio Bizar piece passes through the same workshops in Bali and Java we have returned to for two decades — the makers behind the furniture.",
  alternates: { canonical: "/our-artisans" },
};

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("our-artisans").catch(() => null), METADATA);
}

export default async function OurArtisansPage() {
  const page = await getPage("our-artisans").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;

  const metafields = toMetafieldMap(page?.metafields);

  const story = metafieldRichText(metafields, "story_block_1");
  const features = metafieldMetaobjects(metafields, "feature_images").map(normalizeCaptionedImage);

  return (
    <PageShell surface="blue">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Our Artisans"}</h1>

        {story && (
          <div className="sb-prose mt-10 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: story }} />
        )}
      </Container>

      {features.length > 0 && <CaptionedRow images={features} />}

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
