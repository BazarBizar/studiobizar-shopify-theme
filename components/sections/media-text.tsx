import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * A tall image beside a column of copy. Shop Detail alternates it — The Idea
 * has the image left, The Designer has it right — and Our Story and Collections
 * Detail reuse the same block.
 */
export function MediaText({
  title,
  html,
  image,
  align = "left",
  link,
}: {
  title: string;
  html?: string;
  image?: ShopifyImage | null;
  /** Which side the image sits on. */
  align?: "left" | "right";
  link?: { href: string; label: string };
}) {
  return (
    <Container className="py-section">
      <div
        className={cn(
          "grid items-center gap-10 lg:grid-cols-2 lg:gap-20",
          align === "right" && "lg:[&>figure]:order-2",
        )}
      >
        {image && (
          <figure className="relative aspect-[2/3] w-full overflow-hidden bg-foreground/5">
            <Image
              src={cdnImage(image.url, 1100)}
              alt={image.altText ?? ""}
              fill
              className="object-cover"
              sizes="(max-width: 1023px) 100vw, 45vw"
            />
          </figure>
        )}

        <div className="max-w-[34rem]">
          <h2 className="text-h2">{title}</h2>
          {html && (
            <div className="sb-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {link && (
            <Link href={link.href} className="text-button sb-underline mt-8 inline-block">
              {link.label}
            </Link>
          )}
        </div>
      </div>
    </Container>
  );
}
