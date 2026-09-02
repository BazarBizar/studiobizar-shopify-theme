import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { ProductRail } from "@/components/product/product-rail";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectGallery } from "@/components/project/project-gallery";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import {
  METAOBJECT_TYPES,
  getMetaobject,
  getMetaobjects,
  getProductsByIds,
} from "@/lib/shopify";
import { normalizeProject, normalizeProjectCard, sortProjects } from "@/lib/shopify/entities";
import { cdnImage } from "@/lib/shopify/transforms";
import type { Project } from "@/lib/shopify/entities";

export async function generateMetadata({
  params,
}: PageProps<"/projects/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const entry = await getMetaobject(METAOBJECT_TYPES.project, handle).catch(() => null);
  if (!entry) return { title: "Not found" };

  const project = normalizeProject(entry);
  const description =
    project.subtitle ?? [project.location, project.year].filter(Boolean).join(", ");

  return {
    title: project.title,
    description,
    alternates: { canonical: `/projects/${project.handle}` },
    openGraph: {
      title: project.title,
      description,
      images: project.heroImage ? [{ url: project.heroImage.url }] : undefined,
    },
  };
}

/** `CreativeWork`, per the brief's JSON-LD list for project detail. */
function ProjectJsonLd({ project }: { project: Project }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    abstract: project.subtitle ?? undefined,
    dateCreated: project.year ?? undefined,
    locationCreated: project.location ? { "@type": "Place", name: project.location } : undefined,
    genre: project.category ?? undefined,
    creator: project.creativeLead
      ? { "@type": "Organization", name: project.creativeLead }
      : undefined,
    image: [project.heroImage?.url, ...project.gallery.map((item) => item.image?.url)].filter(
      Boolean,
    ),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** location / year / creative lead / collaborators / photography */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-secondary text-muted lowercase">{label}</dt>
      {/* Collaborators arrive as a multi-line field; each credit gets its own line. */}
      <dd className="text-secondary mt-1 whitespace-pre-line">{value}</dd>
    </div>
  );
}

export default async function ProjectPage({ params }: PageProps<"/projects/[handle]">) {
  const { handle } = await params;
  const entry = await getMetaobject(METAOBJECT_TYPES.project, handle);
  if (!entry) notFound();

  const project = normalizeProject(entry);

  const [featured, others] = await Promise.all([
    getProductsByIds(project.featuredProductIds).catch((error: unknown) => {
      console.error(`[projects/${handle}] featured items failed`, error);
      return [];
    }),
    // `related_projects` is unset on the seeded entries, so "Other Projects"
    // falls back to the rest of the catalogue of projects.
    project.relatedProjects.length > 0
      ? Promise.resolve(project.relatedProjects)
      : getMetaobjects(METAOBJECT_TYPES.project, { first: 50 })
          .then((page) =>
            sortProjects(page.items.map(normalizeProjectCard))
              .filter((item) => item.handle !== project.handle)
              .slice(0, 3),
          )
          .catch(() => []),
  ]);

  const meta = [
    { label: "location", value: project.location },
    { label: "year", value: project.year },
    { label: "creative lead", value: project.creativeLead },
    { label: "collaborators", value: project.collaborators },
    { label: "photography", value: project.photography },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <PageShell surface="black">
      <ProjectJsonLd project={project} />

      {project.heroImage && (
        <div className="relative aspect-[16/10] w-full overflow-hidden lg:aspect-[16/8]">
          <Image
            src={cdnImage(project.heroImage.url, 2400)}
            alt={project.heroImage.altText ?? project.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </div>
      )}

      <Container className="py-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">{project.title}</h1>
          {project.subtitle && <p className="text-h2 mt-4 text-muted">{project.subtitle}</p>}
        </header>

        <div className="mt-14 grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-20">
          {meta.length > 0 && (
            <dl className="flex flex-col gap-6">
              {meta.map((row) => (
                <MetaRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          )}

          {project.bodyHtml && (
            <div
              className="sb-prose max-w-[38rem]"
              dangerouslySetInnerHTML={{ __html: project.bodyHtml }}
            />
          )}
        </div>

        {project.gallery.length > 0 && (
          <div className="mt-16">
            <ProjectGallery images={project.gallery} title={project.title} />
          </div>
        )}
      </Container>

      {featured.length > 0 && <ProductRail title="Featured Items" products={featured} viewAllHref="/shop" />}

      {others.length > 0 && (
        <Container className="pb-section">
          <h2 className="text-h2 mb-8">Other Projects</h2>
          <ul className="grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => (
              <li key={other.handle}>
                <ProjectCard project={other} view="m" />
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container className="pb-section">
        <GoBack fallbackHref="/projects" />
      </Container>
    </PageShell>
  );
}
