import Image from "next/image";
import Link from "next/link";

import { cdnImage } from "@/lib/shopify/transforms";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { SectionHeader } from "./shared";

export type Logo = { id: string; image: ShopifyImage | null; name: string; href: string };

/** A share of the row per logo. A wrapping, centred row rather than a grid: a short last row sits in the middle, not against the left edge. */
const COLUMNS = {
  "3": "basis-1/2 sm:basis-1/3",
  "4": "basis-1/2 sm:basis-1/4",
  "5": "basis-1/3 sm:basis-1/5",
  "6": "basis-1/3 sm:basis-1/6",
} as const;

const HEIGHT = { small: "h-8 sm:h-10", medium: "h-10 sm:h-14", large: "h-14 sm:h-20" } as const;

/** Logos in an even row, scaled to one height so none dominates. */
export function LogoList({
  title,
  intro,
  headingAlign,
  logos,
  columns,
  size,
  muted,
  placeholder,
}: {
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  logos: Logo[];
  columns: keyof typeof COLUMNS;
  size: keyof typeof HEIGHT;
  muted: boolean;
  placeholder?: boolean;
}) {
  const shown = logos.filter((logo) => logo.image || placeholder);
  if (shown.length === 0) return null;

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />
      <ul className="-mx-4 flex flex-wrap items-center justify-center gap-y-10">
        {shown.map((logo) => {
          const mark = logo.image ? (
            <span className={cn("relative block w-full", HEIGHT[size])}>
              <Image
                src={cdnImage(logo.image.url)}
                alt={logo.name || logo.image.altText || ""}
                fill
                sizes="12rem"
                className={cn(
                  "object-contain transition-[filter,opacity] duration-300",
                  muted && "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0",
                )}
              />
            </span>
          ) : (
            <span aria-hidden className={cn("bg-foreground/10 block w-full", HEIGHT[size])} />
          );

          return (
            <li key={logo.id} className={cn("group flex justify-center px-4 sm:px-6", COLUMNS[columns])}>
              {logo.href ? (
                <Link
                  href={logo.href}
                  className="block w-full"
                  {...(/^https?:\/\//i.test(logo.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {mark}
                </Link>
              ) : (
                mark
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
