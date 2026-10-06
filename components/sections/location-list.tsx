import Image from "next/image";

import type { Location } from "@/lib/shopify/entities";
import { cdnImage } from "@/lib/shopify/transforms";
import { cn } from "@/lib/utils/cn";

/**
 * The two-up list of showrooms and workshops from Our Locations — photograph,
 * kind, name, address, phone, email, hours and a map link, each line only when
 * the entry has it.
 *
 * `headingLevel` is `h2` on Our Locations, where the names are the page's own
 * second level; under a section heading of its own they step down to `h3`.
 */
export function LocationList({
  locations,
  className,
  headingLevel: Heading = "h2",
}: {
  locations: Location[];
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <ul className={cn(className, "grid gap-x-16 gap-y-16 lg:grid-cols-2")}>
      {locations.map((location) => (
        <li key={location.handle}>
          <article>
            {location.image && (
              <div className="relative aspect-3/2 w-full overflow-hidden bg-foreground/5">
                <Image
                  src={cdnImage(location.image.url)}
                  alt={location.image.altText ?? location.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1023px) 100vw, 50vw"
                />
              </div>
            )}

            <div className="mt-5">
              {location.kind && (
                <p className="text-tertiary text-muted uppercase tracking-[0.06em]">{location.kind}</p>
              )}
              <Heading className="text-h3 mt-1">{location.name}</Heading>

              {location.address && (
                <p className="text-secondary mt-3 whitespace-pre-line">{location.address}</p>
              )}

              <dl className="text-secondary mt-3 flex flex-col gap-1">
                {location.phone && (
                  <div className="flex gap-2">
                    <dt className="text-muted">Phone</dt>
                    <dd>
                      <a href={`tel:${location.phone.replace(/\s+/g, "")}`} className="sb-underline">
                        {location.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {location.email && (
                  <div className="flex gap-2">
                    <dt className="text-muted">Email</dt>
                    <dd>
                      <a href={`mailto:${location.email}`} className="sb-underline">
                        {location.email}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              {location.hours && (
                <p className="text-tertiary mt-3 whitespace-pre-line text-muted">{location.hours}</p>
              )}

              {location.mapUrl && (
                <a
                  href={location.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button sb-underline mt-4 inline-block uppercase tracking-[0.06em]"
                >
                  View on map
                </a>
              )}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
