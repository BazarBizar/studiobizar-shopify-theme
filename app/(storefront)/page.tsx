import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ProductCard } from "@/components/product/product-card";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { CollectionCarousel } from "@/components/sections/collection-carousel";
import { ContactCta } from "@/components/sections/contact-cta";
import { FullBleedImage } from "@/components/sections/full-bleed-image";
import { HeroSlider } from "@/components/sections/hero-slider";
import { InstagramRow } from "@/components/sections/instagram-row";
import { IntroBlock, IntroBody } from "@/components/sections/intro-block";
import { ProjectCards } from "@/components/sections/project-cards";
import { RowHeading } from "@/components/sections/row-heading";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
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

export const metadata: Metadata = {
  title: "Studio Bizar — Designed for life, inspired by the world",
  description:
    "Furniture, lighting and objects made by hand in Bali and Java, for interiors that are meant to last.",
  alternates: { canonical: "/" },
};

/** Every carousel row on this page shows at most twelve. */
const ROW_LIMIT = 12;

export default async function HomePage() {
  const page = await getPage("home").catch(() => null);
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

      {newIn.length > 0 && (
        <Container className="pb-section">
          <RowHeading
            title="New In"
            href={newInHandle ? `/collections/${newInHandle}` : "/shop"}
          />
          <Carousel ariaLabel="New In">
            {newIn.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Carousel>
        </Container>
      )}

      {monthly.length > 0 && (
        <Container className="pb-section">
          <RowHeading
            title="Monthly Selection"
            href={monthlyHandle ? `/collections/${monthlyHandle}` : "/shop"}
          />
          <Carousel ariaLabel="Monthly Selection">
            {monthly.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Carousel>
        </Container>
      )}

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
