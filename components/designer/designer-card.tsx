import Image from "next/image";
import Link from "next/link";

import { cdnImage } from "@/lib/shopify/transforms";
import type { Designer } from "@/lib/shopify/entities";

/**
 * Portrait with the name beneath, on the same 4-up grid as products — the row
 * pitch on `DESK - Our Designers.pdf` is 496, identical to Shop All.
 */
export function DesignerCard({ designer, priority = false }: { designer: Designer; priority?: boolean }) {
  return (
    <article>
      <Link href={`/designers/${designer.handle}`} className="group block">
        <div className="relative aspect-card overflow-hidden bg-foreground/10">
          {designer.portrait && (
            <Image
              src={cdnImage(designer.portrait.url)}
              alt={designer.portrait.altText ?? designer.name}
              fill
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
              sizes="(max-width: 749px) 50vw, 25vw"
            />
          )}
        </div>

        <h2 className="text-secondary mt-3">{designer.name}</h2>
        {designer.studio && designer.studio !== designer.name && (
          <p className="text-tertiary mt-1 text-muted">{designer.studio}</p>
        )}
      </Link>
    </article>
  );
}
