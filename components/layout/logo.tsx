import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * Extracted from the Figma PDFs as vector paths, so the lockup is exact and
 * recolours with the surface. `mark` is the stone glyph alone (15×15), `full`
 * is the lockup with the wordmark (183.5×20).
 */
export function Logo({
  variant = "full",
  className,
  href = "/",
}: {
  variant?: "full" | "mark";
  className?: string;
  href?: string | null;
}) {
  const src = variant === "full" ? "/brand/logo.svg" : "/brand/mark.svg";
  const ratio = variant === "full" ? "183.5 / 20" : "1 / 1";

  // A CSS mask keeps the artwork a single shape that inherits `currentColor`,
  // so the same file works on every surface.
  const image = (
    <span
      aria-hidden
      className={cn("block bg-current", className)}
      style={{
        aspectRatio: ratio,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-block shrink-0" aria-label="Studio Bizar — home">
      {image}
    </Link>
  );
}
