import type { Metadata } from "next";
import Image from "next/image";

import { CollectionCard } from "@/components/collection/collection-card";
import { PageShell } from "@/components/layout/page-shell";
import { ProductCard } from "@/components/product/product-card";
import { ProjectCard } from "@/components/project/project-card";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { ContactCta } from "@/components/sections/contact-cta";
import { HeroSlider } from "@/components/sections/hero-slider";
import { InstagramRow } from "@/components/sections/instagram-row";
import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { getInstagramPosts } from "@/lib/instagram/behold";
import { cn } from "@/lib/utils/cn";
import {
  METAOBJECT_TYPES,
  getCollectionProducts,
  getCollections,
  getMetaobjects,
  getPage,
} from "@/lib/shopify";
import {
  normalizeCaptionedImage,
  normalizeProjectCard,
  sortProjects,
} from "@/lib/shopify/entities";
import {
  cdnImage,
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

type IntroProps = {
  title: string;
  html: string;
  href: string;
  label: string;
};

/**
 * Heading + copy + a text link. `IntroBody` is the bare block, for when it
 * already sits inside a Container — nesting one Container in another doubles
 * the gutter and pushes the copy out of line with the rest of the page.
 */
function IntroBody({ title, html, href, label }: IntroProps) {
  return (
    <>
      <h2 className="text-h2">{title}</h2>
      <div
        className="sb-prose mt-6 max-w-[44rem]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ButtonLink href={href} className="mt-8" variant="outline">
        {label}
      </ButtonLink>
    </>
  );
}

/** The same block on its own band, as Our Services and Our Story use it. */
function IntroBlock(props: IntroProps) {
  return (
    <Container className="py-section">
      <IntroBody {...props} />
    </Container>
  );
}

function RowHeading({
  title,
  href,
  className,
}: {
  title: string;
  href?: string;
  /** For a row that sits on its own band and needs a different ink. */
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-6", className)}>
      <h2 className="text-h2">{title}</h2>
      {href && (
        <ButtonLink href={href} className="shrink-0">
          view all
        </ButtonLink>
      )}
    </div>
  );
}

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

  const [collectionsPage, projectsPage, newIn, monthly, instagramPosts] =
    await Promise.all([
      getCollections({ first: 100 }).catch(() => ({ items: [] })),
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

  const collections = collectionsPage.items
    .filter((collection) => collection.isSignature)
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, ROW_LIMIT);

  // `is_selected` marks the projects meant for the landing page; if none is
  // flagged, fall back to the first three by sort order.
  const allProjects = sortProjects(
    projectsPage.items.map(normalizeProjectCard),
  );
  const selected = allProjects.filter((project) => project.isSelected);
  const projects = (selected.length > 0 ? selected : allProjects).slice(0, 3);

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

      {projects.length > 0 && (
        <Container className="pb-section">
          <RowHeading title="Selected Projects" href="/projects" />
          <ul className="grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.handle}>
                <ProjectCard project={project} view="m" />
              </li>
            ))}
          </ul>

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
        </Container>
      )}

      {collections.length > 0 && (
        <>
          <section
            data-surface="light"
            className="bg-background py-16 text-foreground"
          >
            <Container>
              <h2 className="text-h2 mb-8">Signature Collections</h2>
              <Carousel ariaLabel="Signature Collections">
                {collections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </Carousel>
            </Container>
          </section>

          {/* Centred beneath the band, on the dark ground — as measured. */}
          <Container className="flex justify-center py-14">
            <ButtonLink href="/collections">view all</ButtonLink>
          </Container>
        </>
      )}

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
        <div className="relative aspect-[16/10] w-full overflow-hidden lg:aspect-[16/7]">
          <Image
            src={cdnImage(storyImage.url)}
            alt={storyImage.altText ?? "Studio Bizar"}
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
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
