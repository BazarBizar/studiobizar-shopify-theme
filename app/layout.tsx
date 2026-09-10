import type { Metadata } from "next";
import "./globals.css";

/**
 * TYPEFACE — Helvetica Neue.
 *
 * It is a licensed Linotype/Monotype face, so there is nothing to fetch from a
 * font CDN and `next/font/google` does not apply. The family is declared as a
 * stack in `globals.css` (`--font-sb-heading` / `--font-sb-body`), which renders
 * natively on macOS and iOS and falls back to Helvetica → Arial elsewhere.
 *
 * To render it identically on Windows and Android, license the webfont and drop
 * the .woff2 files into `app/fonts/`, then:
 *
 *   import localFont from "next/font/local";
 *
 *   const helvetica = localFont({
 *     src: [
 *       { path: "./fonts/HelveticaNeue-Roman.woff2", weight: "400", style: "normal" },
 *       { path: "./fonts/HelveticaNeue-Medium.woff2", weight: "500", style: "normal" },
 *     ],
 *     variable: "--font-sb-body",
 *     display: "swap",
 *   });
 *
 * and add `helvetica.variable` to the <html> className. The fallback chain in
 * globals.css stays as it is, so nothing else changes.
 */

export const metadata: Metadata = {
  title: {
    default: "Studio Bizar",
    template: "%s · Studio Bizar",
  },
  description: "Designed for life, inspired by the world.",
};

/**
 * Root layout deliberately holds nothing but the document, the global stylesheet
 * and the default metadata. Client providers belong to a route group — see
 * `app/(storefront)/layout.tsx` — so neither half of the app pays for the
 * other's runtime.
 *
 * The `body` classes stay here because `<body>` can only be rendered once, at
 * the root. `globals.css` already paints the body from `--sb-*` in its base
 * layer, so `bg-background text-foreground` is belt-and-braces; `flex flex-col`
 * is what lets the storefront footer sit at the bottom, and the admin shell
 * opts into the same column with `flex-1`.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-surface="light" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
