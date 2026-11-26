import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectionGrid } from "@/components/collection/collection-grid";
import { PageShell } from "@/components/layout/page-shell";
import { BuilderPage } from "@/components/page-builder/builder-page";
import { ProductCardGrid } from "@/components/product/product-card-grid";
import { ProjectCard } from "@/components/project/project-card";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { METAOBJECT_TYPES, getMetaobject, getProductsByDesigner, getProjectsByDesigner, getPublishedTemplate } from "@/lib/shopify";
import { normalizeDesigner, type Designer } from "@/lib/shopify/entities";
import { cdnImage } from "@/lib/shopify/transforms";

/**
 * Empty `generateStaticParams`: nothing is built ahead, but each designer page is drawn on
 * its first visit and then served from the cache (ISR) — not drawn again for every
 * visitor and every crawler, as it was while this route was dynamic. A change reaches it
 * through its cache tag (the panel's writes, Shopify's webhooks); `REVALIDATE` is only
 * the safety net. An unknown handle is a cached 404 like any other page.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<"/designers/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const entry = await getMetaobject(METAOBJECT_TYPES.designer, handle).catch(() => null);
  if (!entry) return { title: "Not found" };

  const designer = normalizeDesigner(entry);
  const description = designer.bioShort ?? designer.byline ?? `${designer.name} for Studio Bizar.`;

  return {
    title: designer.name,
    description,
    alternates: { canonical: `/designers/${designer.handle}` },
    openGraph: {
      title: designer.name,
      description,
      images: designer.portrait ? [{ url: designer.portrait.url }] : undefined,
      type: "profile",
    },
  };
}

/** `Person`, per the brief's JSON-LD list for designer detail. */
function DesignerJsonLd({ designer }: { designer: Designer }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: designer.name,
    description: designer.bioShort ?? designer.byline ?? undefined,
    jobTitle: designer.byline ?? undefined,
    image: designer.portrait?.url,
    worksFor: designer.studio ? { "@type": "Organization", name: designer.studio } : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function DesignerPage({ params }: PageProps<"/designers/[handle]">) {
  const { handle } = await params;
  const [entry, template] = await Promise.all([
    getMetaobject(METAOBJECT_TYPES.designer, handle),
    getPublishedTemplate("designer"),
  ]);
  if (!entry) notFound();

  const designer = normalizeDesigner(entry);

  // Website → Templates → Designer page, once published; until then the layout below.
  if (template) {
    return (
      <BuilderPage
        doc={template}
        title={designer.name}
        record={{ kind: "designer", designer }}
        before={<DesignerJsonLd designer={designer} />}
      />
    );
  }

  // No metafield filter exists on the Storefront product query, so a designer's
  // work is reached through the collections that credit them.
  const [{ products, collections }, projects] = await Promise.all([
    getProductsByDesigner(handle, { first: 8 }).catch((error: unknown) => {
      console.error(`[designers/${handle}] products lookup failed`, error);
      return { products: [], collections: [] };
    }),
    // Projects that use their pieces (Website → Templates → Designer page draws the same).
    getProjectsByDesigner(handle, { first: 6 }).catch((error: unknown) => {
      console.error(`[designers/${handle}] projects lookup failed`, error);
      return [];
    }),
  ]);

  return (
    <PageShell surface="mocha">
      <DesignerJsonLd designer={designer} />

      <Container className="pt-12 pb-section">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {designer.portrait && (
            <figure className="relative aspect-[619/728] w-full overflow-hidden bg-foreground/10">
              <Image
                src={cdnImage(designer.portrait.url)}
                alt={designer.portrait.altText ?? designer.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1023px) 100vw, 45vw"
              />
            </figure>
          )}

          <div className="max-w-[34rem]">
            <h1 className="text-h2">{designer.name}</h1>
            {designer.studio && designer.studio !== designer.name && (
              <p className="text-secondary mt-1 text-muted">{designer.studio}</p>
            )}
            {designer.byline && <p className="text-h3 mt-6">{designer.byline}</p>}

            {designer.bioHtml ? (
              <div className="sb-prose mt-6" dangerouslySetInnerHTML={{ __html: designer.bioHtml }} />
            ) : (
              designer.bioShort && <p className="text-body mt-6">{designer.bioShort}</p>
            )}

            {collections.length > 0 && (
              <p className="text-secondary mt-8 text-muted">
                Collections:{" "}
                {collections.map((collection, index) => (
                  <span key={collection.handle}>
                    {index > 0 && ", "}
                    <Link href={`/collections/${collection.handle}`} className="sb-underline">
                      {collection.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </Container>

      {products.length > 0 && (
        <Container className="pb-section">
          <h2 className="text-h2 mb-8">Designed by {designer.name}</h2>
          <ProductCardGrid products={products} />
        </Container>
      )}

      {collections.length > 0 && (
        <Container className="pb-section">
          <h2 className="text-h2 mb-8">Collections</h2>
          {/* The card was drawn for the light Collections page: its texts take this page's colours. */}
          <div className="[&_article_h2]:text-foreground [&_[data-byline]]:text-muted">
            <CollectionGrid collections={collections} />
          </div>
        </Container>
      )}

      {projects.length > 0 && (
        <Container className="pb-section">
          <h2 className="text-h2 mb-8">Projects</h2>
          <ul className="grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.handle}>
                <ProjectCard project={project} view="m" />
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container className="pb-section">
        <GoBack fallbackHref="/designers" />
      </Container>
    </PageShell>
  );
}
