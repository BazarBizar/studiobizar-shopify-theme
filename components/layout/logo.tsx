import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The logo. By default the lockup extracted from the Figma PDFs as vector paths
 * (`mark` is the stone glyph alone, 15×15; `full` the lockup with the wordmark,
 * 183.5×20), drawn as a CSS mask so it recolours with the surface.
 *
 * The artwork itself comes from custom properties (`styles/sb-logo.css`): a logo
 * uploaded under Site-wide → Logo, icon & SEO replaces it through
 * `<SiteIdentityStyle>`, without this component — which client components render
 * too — having to fetch anything.
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
  const image = <span aria-hidden data-variant={variant} className={cn("sb-logo", className)} />;

  if (!href) return image;

  return (
    <Link href={href} className="inline-block shrink-0" aria-label="Home">
      {image}
    </Link>
  );
}
