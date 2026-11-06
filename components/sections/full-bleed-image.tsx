import Image from "next/image";

import { isCropped, photoFrameStyle } from "@/lib/page-builder/image-crop";
import { cdnImage } from "@/lib/shopify/transforms";
import { cn } from "@/lib/utils/cn";
import type { ShopifyImage } from "@/lib/shopify/types";

/** One photograph edge to edge — the landing page's story image. */
export function FullBleedImage({ image, alt }: { image: ShopifyImage; alt?: string }) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", !isCropped(image) && "aspect-[16/10] lg:aspect-[16/7]")}
      // A cropped photo keeps the crop's shape, on every screen.
      style={photoFrameStyle(image, isCropped(image))}
    >
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
