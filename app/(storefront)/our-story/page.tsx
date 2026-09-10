import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { ContactCta } from "@/components/sections/contact-cta";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeCaptionedImage } from "@/lib/shopify/entities";
import { metafieldMetaobjects, metafieldRichText, toMetafieldMap } from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Studio Bizar began with a container of teak and the makers who could still do better. Two decades on, the same relationships run the workshop.",
  alternates: { canonical: "/our-story" },
};

export default async function OurStoryPage() {
  const page = await getPage("our-story").catch(() => null);
  const metafields = toMetafieldMap(page?.metafields);

  const blockOne = metafieldRichText(metafields, "story_block_1");
  const blockTwo = metafieldRichText(metafields, "story_block_2");
  const features = metafieldMetaobjects(metafields, "feature_images").map(normalizeCaptionedImage);
  const gallery = metafieldMetaobjects(metafields, "gallery").map(normalizeCaptionedImage);

  return (
    <PageShell surface="blue">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page?.title ?? "Our Story"}</h1>

        {blockOne && (
          <div className="sb-prose mt-10 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: blockOne }} />
        )}
      </Container>

      {features.length > 0 && <CaptionedRow images={features} />}

      {blockTwo && (
        <Container className="pb-section">
          <h2 className="text-h2">Our Story</h2>
          <div className="sb-prose mt-6 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: blockTwo }} />
        </Container>
      )}

      {gallery.length > 0 && <CaptionedRow images={gallery.slice(3, 6)} />}

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
