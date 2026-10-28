import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { SITE_URL } from "@/lib/site";

import "./globals.css";

/*
 * The page builder's font choices (`FONTS` in lib/page-builder/design.ts), from the
 * Fontsource packages — self-hosted like Geist, so builds stay offline-capable.
 * These are only @font-face declarations: a browser downloads a font file when a
 * page actually uses that font, so a font nobody picked costs a few lines of CSS.
 */
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/work-sans/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource-variable/syne/index.css";
import "@fontsource-variable/playfair-display/index.css";
import "@fontsource-variable/cormorant-garamond/index.css";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/eb-garamond/index.css";

/**
 * TYPEFACES
 *
 * The storefront is Helvetica Neue — a licensed Linotype face, so there is
 * nothing to fetch and `next/font/google` does not apply. The family is declared
 * as a stack in `globals.css` (`--font-sb-heading` / `--font-sb-body`), which
 * renders natively on macOS and iOS and falls back to Helvetica → Arial
 * elsewhere. To render it identically on Windows and Android, license the webfont,
 * drop the .woff2 files into `app/fonts/`, wire `next/font/local` here, and add
 * the resulting variable to the <html> className. The fallback chain stays as it
 * is, so nothing else changes.
 *
 * The admin panel is Geist, from the `geist` PACKAGE rather than
 * `next/font/google`. The Google loader fetches over the network at BUILD time,
 * so a bad connection fails the build; the package ships bundled woff2 and loads
 * them through `next/font/local`, which keeps builds offline-capable and
 * reproducible. Only `/admin` uses it — `font-sans` is scoped to `[data-admin]`.
 */

export const metadata: Metadata = {
  /**
   * Without this every relative `alternates.canonical` and Open Graph url in the
   * app resolves against localhost, which Next warns about and then ships. It is
   * the one piece of metadata that cannot be set per route.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Studio Bizar",
    template: "%s · Studio Bizar",
  },
  description: "Designed for life, inspired by the world.",
  /**
   * The file lives in `public/`, not `app/`: a favicon in `app/` is file-based
   * metadata, which always wins — so neither the storefront's icon (Site-wide → Logo,
   * icon & SEO) nor the admin's own (Admin appearance) could ever replace it.
   */
  icons: { icon: "/favicon.ico" },
};

/**
 * Root layout deliberately holds nothing but the document, the font variables and
 * the global stylesheet. Client providers belong to a route group — see
 * `app/(storefront)/layout.tsx` and `app/(admin)/admin/layout.tsx` — so neither
 * half of the app pays for the other's runtime.
 *
 * `suppressHydrationWarning` is required because `next-themes` writes the theme
 * class onto <html> before React hydrates, which React would otherwise report as
 * a mismatch.
 *
 * The `body` classes stay here because <body> can only be rendered once, at the
 * root. `globals.css` already paints the body from `--sb-*` in its base layer, so
 * `bg-background text-foreground` is belt-and-braces; `flex flex-col` is what lets
 * the storefront footer sit at the bottom, and the admin shell opts into the same
 * column with `flex-1`.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-surface="light"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
