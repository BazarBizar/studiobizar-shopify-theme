import { InquiryDrawer } from "@/components/inquiry/inquiry-drawer";
import { BackToTop } from "@/components/layout/back-to-top";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/** The grounds the designs actually use. See `globals.css` section H. */
export type Surface = "light" | "dark" | "olive" | "blue" | "mocha" | "black";

/**
 * Every page composes its own shell rather than inheriting one from the root
 * layout, because the ground changes per page — Shop All is earth, Landing is
 * dark wood, Contact is mocha, Projects Detail is off-black — and the footer
 * changes with it. Doing this in a layout would need the child to reach
 * upwards, which App Router does not allow.
 */
export function PageShell({
  surface = "light",
  footerSurface = "olive",
  children,
}: {
  surface?: Surface;
  footerSurface?: Surface;
  children: React.ReactNode;
}) {
  return (
    <div data-surface={surface} className="flex min-h-full flex-col bg-background text-foreground">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer surface={footerSurface} />
      <BackToTop />
      <InquiryDrawer />
    </div>
  );
}
