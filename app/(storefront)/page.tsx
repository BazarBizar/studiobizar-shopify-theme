import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage, builderMetadata, publishedDocument } from "@/components/page-builder/builder-page";
import { ProductRail } from "@/components/product/product-rail";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { CollectionCarousel } from "@/components/sections/collection-carousel";
import { ContactCta } from "@/components/sections/contact-cta";
import { FullBleedImage } from "@/components/sections/full-bleed-image";
import { HeroSlider } from "@/components/sections/hero-slider";
import { InstagramRow } from "@/components/sections/instagram-row";
import { IntroBlock, IntroBody } from "@/components/sections/intro-block";
import { ProjectCards } from "@/components/sections/project-cards";
import { getInstagramPosts } from "@/lib/instagram/behold";
import {
  METAOBJECT_TYPES,
  getCollectionProducts,
  getMetaobjects,
  getPage,
  getSignatureCollections,
} from "@/lib/shopify";
import {
  featuredProjects,
  normalizeCaptionedImage,
  normalizeProjectCard,
} from "@/lib/shopify/entities";
import {
  metafieldImage,
  metafieldMetaobjects,
  metafieldRichText,
  toMetafieldMap,
} from "@/lib/shopify/transforms";

const METADATA: Metadata = {
  // Absolute: it already says "Studio Bizar"; the template would add it again.
  title: { absolute: "Studio Bizar — Designed for life, inspired by the world" },
  description:
    "Furniture, lighting and objects made by hand in Bali and Java, for interiors that are meant to last.",
  alternates: { canonical: "/" },
};

/** Every carousel row on this page shows at most twelve. */
const ROW_LIMIT = 12;

/** Shopify's SEO fields once the page builder version is live — see `builderMetadata`. */
export async function generateMetadata(): Promise<Metadata> {
  return builderMetadata(await getPage("home").catch(() => null), METADATA);
}

export default async function HomePage() {
  const page = await getPage("home").catch(() => null);

  // MVP-2: the page builder version, once one is published. Until then — and if
  // it is ever unreadable — the layout below, unchanged.
  const doc = publishedDocument(page);
  if (doc && page) return <BuilderPage doc={doc} title={page.title} />;

  const metafields = toMetafieldMap(page?.metafields);

  const heroSlides = metafieldMetaobjects(metafields, "hero_slides").map(
    normalizeCaptionedImage,
  );
  const featureImages = metafieldMetaobjects(metafields, "feature_images").map(
    normalizeCaptionedImage,
  );
  const instagram = metafieldMetaobjects(metafields, "gallery").map(
    normalizeCaptionedImage,
  );
  const storyImage = metafieldImage(metafields, "story_image");
  const servicesHtml = metafieldRichText(metafields, "intro_body");
  const projectsIntroHtml = metafieldRichText(metafields, "projects_intro");
  const storyHtml = metafieldRichText(metafields, "story_block_1");

  // Which collection feeds each product row is chosen in the admin, not here.
  const newInRef = metafields.new_in?.reference;
  const monthlyRef = metafields.monthly_selection?.reference;
  const newInHandle =
    newInRef?.__typename === "Collection"
      ? (newInRef as { handle: string }).handle
      : null;
  const monthlyHandle =
    monthlyRef?.__typename === "Collection"
      ? (monthlyRef as { handle: string }).handle
      : null;

  const [collections, projectsPage, newIn, monthly, instagramPosts] =
    await Promise.all([
      getSignatureCollections(ROW_LIMIT).catch(() => []),
      getMetaobjects(METAOBJECT_TYPES.project, { first: 100 }).catch(() => ({
        items: [],
      })),
      newInHandle
        ? getCollectionProducts({ handle: newInHandle, first: ROW_LIMIT }).then(
            (p) => p.items,
          )
        : Promise.resolve([]),
      monthlyHandle
        ? getCollectionProducts({
            handle: monthlyHandle,
            first: ROW_LIMIT,
          }).then((p) => p.items)
        : Promise.resolve([]),
      getInstagramPosts(10),
    ]);

  // `is_selected` marks the projects meant for the landing page; if none is
  // flagged, fall back to the first three by sort order.
  const projects = featuredProjects(projectsPage.items.map(normalizeProjectCard), 3);

  return (
    <PageShell surface="dark">
      {/* The hero is image-only by design, so the page's one h1 is for screen
          readers and search engines — every other page has a visible one. */}
      <h1 className="sr-only">Studio Bizar — designed for life, inspired by the world</h1>
      <HeroSlider slides={heroSlides} />

      {servicesHtml && (
        <IntroBlock
          title="Our Services"
          html={servicesHtml}
          href="/services"
          label="explore our services"
        />
      )}

      {featureImages.length > 0 && <CaptionedRow images={featureImages} />}

      <ProjectCards title="Selected Projects" href="/projects" projects={projects}>
        {projectsIntroHtml && (
          <div className="mt-section-sm">
            <IntroBody
              title="Selected Project"
              html={projectsIntroHtml}
              href="/projects"
              label="view all projects"
            />
          </div>
        )}
      </ProjectCards>

      <CollectionCarousel
        title="Signature Collections"
        collections={collections}
        viewAllHref="/collections"
      />

      <ProductRail
        title="New In"
        products={newIn}
        viewAllHref={newInHandle ? `/collections/${newInHandle}` : "/shop"}
        viewAllPlacement="heading"
      />

      <ProductRail
        title="Monthly Selection"
        products={monthly}
        viewAllHref={monthlyHandle ? `/collections/${monthlyHandle}` : "/shop"}
        viewAllPlacement="heading"
      />

      {storyImage && (
        <FullBleedImage image={storyImage} alt={storyImage.altText ?? "Studio Bizar"} />
      )}

      {storyHtml && (
        <IntroBlock
          title="Our Story"
          html={storyHtml}
          href="/our-story"
          label="read our story"
        />
      )}

      <InstagramRow posts={instagramPosts} fallback={instagram} />

      <ContactCta />
    </PageShell>
  );
}
