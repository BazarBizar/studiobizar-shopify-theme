import Image from "next/image";

import { Container } from "@/components/ui/container";
import { cdnImage } from "@/lib/shopify/transforms";
import type { CaptionedImage } from "@/lib/shopify/entities";

/**
 * The three-up row of captioned photographs that closes Our Story and Service.
 * Captions sit at x=20 / 588 / 1155 in the designs — three ~556px columns.
 */
export function CaptionedRow({ images }: { images: CaptionedImage[] }) {
  const usable = images.filter((item) => item.image).slice(0, 3);
  if (usable.length === 0) return null;

  return (
    <Container className="pb-section">
      <ul className="grid gap-grid-gap sm:grid-cols-2 lg:grid-cols-3">
        {usable.map((item) => (
          <li key={item.handle}>
            <figure>
              <div className="relative aspect-[3/4] overflow-hidden bg-foreground/10">
                <Image
                  src={cdnImage(item.image!.url, 1100)}
                  alt={item.image!.altText ?? item.caption ?? ""}
                  fill
                  className="object-cover"
                  sizes="(max-width: 749px) 100vw, 33vw"
                />
              </div>
              {item.caption && (
                <figcaption className="text-secondary mt-3">{item.caption}</figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </Container>
  );
}
