import { InquiryDrawer } from "@/components/inquiry/inquiry-drawer";
import { BackToTop } from "@/components/layout/back-to-top";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SearchOverlay } from "@/components/search/search-overlay";
import { designStyle } from "@/lib/page-builder/design";
import { getThemeLayout } from "@/lib/shopify";
import type { ThemeLayoutContent } from "@/lib/theme-builder/layout";

/** The grounds the designs actually use. See `globals.css` section H. */
export type Surface = "light" | "dark" | "olive" | "blue" | "mocha" | "black";

/**
 * Every page composes its own shell rather than inheriting one from the root
 * layout, because the ground changes per page — Shop All is earth, Landing is
 * dark wood, Contact is mocha, Projects Detail is off-black — and the footer
 * changes with it. Doing this in a layout would need the child to reach
 * upwards, which App Router does not allow.
 */
export async function PageShell({
  surface = "light",
  footerSurface = "olive",
  theme,
  children,
}: {
  surface?: Surface;
  footerSurface?: Surface;
  /**
   * A header and footer layout to draw instead of the published one — the Theme
   * Builder's preview passes its draft. Left out everywhere else.
   */
  theme?: ThemeLayoutContent | null;
  children: React.ReactNode;
}) {
  // Read once here and handed down: the published layout — or the preview's draft —
  // carries the header, the footer and the site style. null: the original ones.
  const layout = theme === undefined ? await getThemeLayout() : theme;
  // Site style (Theme Builder → Site style): fonts and sizes for every page, as the
  // same custom properties a section's design uses — a section's own still wins.
  const site = designStyle(layout?.global.design);

  return (
    <div
      data-surface={surface}
      {...site.attrs}
      style={Object.keys(site.style).length ? (site.style as React.CSSProperties) : undefined}
      className="flex min-h-full flex-col bg-background text-foreground"
    >
      <Header theme={layout} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer surface={footerSurface} theme={layout} />
      <BackToTop />
      <InquiryDrawer />
      <SearchOverlay />
    </div>
  );
}
