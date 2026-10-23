import { ProjectCard } from "@/components/project/project-card";
import { RowHeading } from "@/components/sections/row-heading";
import { Container } from "@/components/ui/container";
import type { ProjectCard as ProjectCardType } from "@/lib/shopify/entities";

/**
 * A heading and a row of project cards — "Selected Projects" on the landing page.
 * `m` is three across, `l` one full-bleed project per row, the same two densities
 * `/projects` offers. `children` sits under the cards inside the same band.
 */
export function ProjectCards({
  title,
  href,
  projects,
  view = "m",
  children,
}: {
  title: string;
  href?: string;
  projects: ProjectCardType[];
  view?: "l" | "m";
  children?: React.ReactNode;
}) {
  if (projects.length === 0) return null;

  return (
    <Container className="pb-section">
      <RowHeading title={title} href={href} />
      <ul
        className={
          view === "l"
            ? "flex flex-col gap-16"
            : "grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {projects.map((project) => (
          <li key={project.handle}>
            <ProjectCard project={project} view={view} />
          </li>
        ))}
      </ul>

      {children}
    </Container>
  );
}
