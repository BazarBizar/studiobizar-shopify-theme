import { PageBarMemoryProvider } from "@/components/admin/pages-table/page-bar-memory";

/**
 * Shared by a page's Content and Settings tabs. It fetches nothing — it only
 * remembers the page's bar, so the bar stays put while the other tab loads.
 */
export default function PageLayout({ children }: LayoutProps<"/admin/pages/[id]">) {
  return <PageBarMemoryProvider>{children}</PageBarMemoryProvider>;
}
