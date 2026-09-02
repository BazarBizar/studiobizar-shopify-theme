import type { Metadata } from "next";

import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import { normalizeCaptionedImage } from "@/lib/shopify/entities";
import { metafieldMetaobjects, toMetafieldMap } from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Studio Bizar pieces photographed in the rooms they were made for — interiors, details and the workshop.",
  alternates: { canonical: "/gallery" },
};

/**
 * Images come from the `custom.gallery` PAGE metafield on the `gallery` page,
 * which is a list of `captioned_image` — the same metaobject the project
 * galleries use, so a photograph is described once and reused.
 */
export default async function GalleryPage() {
  const page = await getPage("gallery").catch(() => null);
  const metafields = toMetafieldMap(page?.metafields);
  const images = metafieldMetaobjects(metafields, "gallery").map(normalizeCaptionedImage);

  return (
    <PageShell surface="black">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">{page?.title ?? "Gallery"}</h1>
          {page?.bodySummary && <p className="text-body mt-6">{page.bodySummary}</p>}
        </header>

        <div className="mt-12">
          <GalleryGrid images={images} />
        </div>
      </Container>

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
