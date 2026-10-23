import Image from "next/image";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";

/** One photograph edge to edge — the landing page's story image. */
export function FullBleedImage({ image, alt }: { image: ShopifyImage; alt?: string }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden lg:aspect-[16/7]">
      <Image
        src={cdnImage(image.url)}
        alt={alt ?? image.altText ?? ""}
        fill
        className="object-cover"
        sizes="100vw"
      />
    </div>
  );
}
