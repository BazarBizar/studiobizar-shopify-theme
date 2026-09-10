import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectControls } from "@/components/project/project-controls";
import { Container } from "@/components/ui/container";
import { METAOBJECT_TYPES, getMetaobjects, getPage } from "@/lib/shopify";
import { normalizeProjectCard, sortProjects } from "@/lib/shopify/entities";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Realised interiors furnished by Studio Bizar — residential, hospitality and commercial, across Europe and beyond.",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const view = params.view === "l" ? "l" : "m";

  const [page, intro] = await Promise.all([
    getMetaobjects(METAOBJECT_TYPES.project, { first: 200 }),
    getPage("projects").catch(() => null),
  ]);

  const all = sortProjects(page.items.map(normalizeProjectCard));

  // `metaobjects` takes no query argument, so the category filter runs here.
  const counts = all.reduce<Record<string, number>>((acc, project) => {
    if (project.category) acc[project.category] = (acc[project.category] ?? 0) + 1;
    return acc;
  }, {});

  const projects = category ? all.filter((project) => project.category === category) : all;

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className="text-h1">Projects</h1>
          {intro?.bodySummary && <p className="text-body mt-6">{intro.bodySummary}</p>}
        </header>

        <div className="mt-12">
          <ProjectControls counts={counts} />
        </div>

        {projects.length === 0 ? (
          <p className="text-body py-16 text-muted">
            No projects in this category yet.
          </p>
        ) : (
          <ul
            className={
              view === "l"
                ? "mt-10 flex flex-col gap-16"
                : "mt-10 grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {projects.map((project, index) => (
              <li key={project.handle}>
                <ProjectCard project={project} view={view} priority={index < 3} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
