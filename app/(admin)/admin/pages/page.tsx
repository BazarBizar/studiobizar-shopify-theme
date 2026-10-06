import { PageHeader } from "@/components/admin/page-header";
import { CreatePageDialog } from "@/components/admin/page-builder/create-page-dialog";
import { PagesTable } from "@/components/admin/pages-table/pages-table";
import { listPages } from "@/lib/admin/pages";
import { routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Pages" };

/**
 * Online Store pages. A static segment, so it wins over `/admin/[slug]`; a
 * metaobject type named `pages` would be shadowed, and `reservedSlug()` says so in
 * the sidebar.
 *
 * Fifteen of the twenty-three public routes read one of these, and most of what
 * they render lives in the page's METAFIELDS rather than its body — the landing
 * page's hero slides, New In and Monthly Selection among them.
 */
export default async function PagesScreen() {
  const pages = await listPages();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages"
        description="The copy and content behind the public pages. New pages are built from the site’s own sections with the page builder; pages with a layout of their own in code still come from schema-push."
        meta={`${pages.length} pages`}
        actions={<CreatePageDialog />}
      />

      <PagesTable pages={pages} routeFor={routeForPageHandle} />
    </div>
  );
}
