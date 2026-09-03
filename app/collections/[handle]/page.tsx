import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectionHighlightGrid } from "@/components/collection/collection-highlight-grid";
import { PageShell } from "@/components/layout/page-shell";
import { ContactCta } from "@/components/sections/contact-cta";
import { MediaText } from "@/components/sections/media-text";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getCollection, getCollectionProducts } from "@/lib/shopify";
import {
  cdnImage,
  fieldImage,
  fieldRichText,
  fieldText,
  metafieldImage,
  metafieldMetaobjects,
  metafieldRichText,
  metafieldText,
  toFieldMap,
} from "@/lib/shopify/transforms";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollection(handle).catch(() => null);
  if (!collection) return { title: "Not found" };

  const description = collection.seo.description ?? collection.description.slice(0, 160);

  return {
    title: collection.seo.title ?? collection.title,
    description,
    alternates: { canonical: `/collections/${collection.handle}` },
    openGraph: {
      title: collection.seo.title ?? collection.title,
      description,
      images: collection.heroImage ? [{ url: collection.heroImage.url }] : undefined,
    },
  };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) notFound();

  // The mosaic below shows at most 10 — the top of the collection, not every
  // product in it (Shop All is where the whole catalogue pages through).
  const products = await getCollectionProducts({ handle, first: 10 });

  const metafields = collection.metafields;
  const ideaTitle = metafieldText(metafields, "idea_title") ?? "The Idea";
  const ideaBody = metafieldRichText(metafields, "idea_body");
  const ideaImage = metafieldImage(metafields, "idea_image");

  const designerEntry = metafields.designer?.reference;
  const designer =
    designerEntry?.__typename === "Metaobject"
      ? (() => {
          const entry = designerEntry as unknown as { handle: string; fields: [] };
          const fields = toFieldMap(entry.fields);
          return {
            handle: entry.handle,
            name: fieldText(fields, "name"),
            studio: fieldText(fields, "studio"),
            bio: fieldRichText(fields, "bio_full") || fieldRichText(fields, "bio_short"),
            portrait: fieldImage(fields, "portrait"),
          };
        })()
      : null;

  // Projects the collection appears in. The `project` metaobject is unseeded,
  // so this is empty today and the section hides.
  const inContext = metafieldMetaobjects(metafields, "in_context_projects").map((entry) => {
    const fields = toFieldMap(entry.fields);
    return {
      handle: entry.handle,
      title: fieldText(fields, "title"),
      location: fieldText(fields, "location"),
      image: fieldImage(fields, "card_image") ?? fieldImage(fields, "hero_image"),
    };
  });

  const wordmark = collection.title.replace(/^The\s+/i, "").replace(/\s+Collection$/i, "");

  return (
    <PageShell surface="light">
      {/* Hero — the design lays a 128px wordmark over a full-bleed image. */}
      <section data-surface="dark" className="relative isolate flex min-h-[32rem] items-center justify-center overflow-hidden lg:min-h-[44rem]">
        {collection.heroImage && (
          <Image
            src={cdnImage(collection.heroImage.url, 2000)}
            alt={collection.heroImage.altText ?? collection.title}
            fill
            priority
            className="-z-10 object-cover"
            sizes="100vw"
          />
        )}

        {collection.logo ? (
          <Image
            src={cdnImage(collection.logo.url, 1200)}
            alt={collection.title}
            width={600}
            height={200}
            className="h-auto w-[min(60vw,38rem)] object-contain"
          />
        ) : (
          <h1 className="text-display-lg px-gutter text-center leading-none tracking-[0.02em] text-foreground uppercase">
            {wordmark}
          </h1>
        )}
      </section>

      {/* Light, unlike Shop Detail's own "The Idea" — this page alternates
          the other way round. */}
      {ideaBody && (
        <MediaText title={ideaTitle} html={ideaBody} image={ideaImage} align="left" padding="wide" />
      )}

      {designer?.bio && (
        <MediaText
          title="The Designer"
          html={designer.bio}
          image={designer.portrait}
          align="right"
          link={{ href: `/designers/${designer.handle}`, label: "learn more" }}
          surface="olive"
          padding="wide"
        />
      )}

      <Container className="pb-section">
        <h2 className="text-h1">{collection.title}</h2>
        {collection.descriptionHtml && (
          <div
            className="sb-prose mt-6 max-w-[46rem]"
            dangerouslySetInnerHTML={{ __html: collection.descriptionHtml }}
          />
        )}

        <div className="mt-12">
          <CollectionHighlightGrid products={products.items} />
        </div>
      </Container>

      {/* Full-bleed on charcoal-blue — the one section on this page with no
          page gutter on its images, edge to edge across the row. */}
      {inContext.length > 0 && (
        <section data-surface="blue" className="bg-background py-section text-foreground">
          <Container>
            <h2 className="text-h2 mb-8">In Context</h2>
          </Container>

          <Carousel ariaLabel="In Context" gap="none" slideClassName="w-full sm:w-1/2 lg:w-1/3">
            {inContext.map((project) => (
              <Link key={project.handle} href={`/projects/${project.handle}`} className="group block">
                <div className="relative aspect-3/4 overflow-hidden bg-foreground/10">
                  {project.image && (
                    <Image
                      src={cdnImage(project.image.url, 1100)}
                      alt={project.image.altText ?? project.title ?? ""}
                      fill
                      className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
                      sizes="(max-width: 749px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    />
                  )}
                </div>
                <div className="px-gutter mt-3">
                  <h3 className="text-h4">{project.title}</h3>
                  {project.location && <p className="text-secondary text-muted italic">{project.location}</p>}
                </div>
              </Link>
            ))}
          </Carousel>
        </section>
      )}

      <ContactCta />

      <Container className="pb-section">
        <GoBack fallbackHref="/collections" />
      </Container>
    </PageShell>
  );
}
