import Image from "next/image";
import Link from "next/link";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ProjectCard as ProjectCardType } from "@/lib/shopify/entities";

/**
 * The two densities from `DESK - Projects Overview (View L/M).pdf`.
 *
 * `l` is one full-bleed project per row on 5:3; `m` is three across on 2:3.
 * Same card, same data — only the media aspect and the type scale change.
 *
 * Both collapse to the 3:4 measured on the 393px frames: one card per row at
 * 353×467, whichever density the desktop view asked for.
 */
export function ProjectCard({
  project,
  view = "m",
  priority = false,
}: {
  project: ProjectCardType;
  view?: "l" | "m";
  priority?: boolean;
}) {
  const image = project.cardImage ?? project.heroImage;
  const large = view === "l";

  return (
    <article>
      <Link href={`/projects/${project.handle}`} className="group block">
        <div
          className={`relative aspect-[3/4] overflow-hidden bg-foreground/5 ${large ? "sm:aspect-[5/3]" : "sm:aspect-[2/3]"}`}
        >
          {image && (
            <Image
              src={cdnImage(image.url)}
              alt={image.altText ?? project.title}
              fill
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.02]"
              sizes={large ? "100vw" : "(max-width: 749px) 100vw, 33vw"}
            />
          )}
        </div>

        <h2 className={`mt-3 ${large ? "text-h2" : "text-h3"}`}>{project.title}</h2>
        {project.location && (
          <p className="text-secondary mt-1 text-muted">{project.location}</p>
        )}
      </Link>
    </article>
  );
}
