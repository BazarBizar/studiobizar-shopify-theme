import { ProjectCard } from "@/components/project/project-card";
import { RowHeading } from "@/components/sections/row-heading";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import type { CarouselView } from "@/lib/page-builder/carousel-view";
import type { ProjectCard as ProjectCardType } from "@/lib/shopify/entities";

/**
 * Project cards in a row that scrolls — the same cards as "Selected Projects", three
 * across on desktop with the arrows, and the next one peeking in on a phone. The
 * builder's carousel settings (items across, how far an arrow moves) arrive as `view`;
 * `more` is the button beside the heading.
 */
export function ProjectCarousel({
  title,
  projects,
  view,
  more,
}: {
  title: string;
  projects: ProjectCardType[];
  view: CarouselView;
  more?: { href: string; label: string };
}) {
  if (projects.length === 0) return null;

  return (
    <Container className="pb-section">
      <RowHeading title={title} href={more?.href} label={more?.label} />
      <Carousel
        ariaLabel={title}
        slideClassName="w-[87%] sm:w-[calc(50%-0.3125rem)] lg:w-[calc(33.333%-0.42rem)]"
        perView={view.perView}
        step={view.step}
      >
        {projects.map((project) => (
          <ProjectCard key={project.handle} project={project} view="m" />
        ))}
      </Carousel>
    </Container>
  );
}
