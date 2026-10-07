import { PlusIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { PageHeader } from "@/components/admin/page-header";
import { PagesTable } from "@/components/admin/pages-table/pages-table";
import { Button } from "@/components/admin/ui/button";
import { listPagesWithContent } from "@/lib/admin/page-builder";
import { routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Pages" };

/**
 * Website → Pages. The one place a page is managed: each row opens on the page's
 * Content tab (the page builder) or its Settings tab. A static segment, so it wins
 * over `/admin/[slug]`; a metaobject type named `pages` would be shadowed, and
 * `reservedSlug()` says so in the sidebar.
 */
export default async function PagesScreen() {
  const pages = await listPagesWithContent();
  const waiting = pages.filter((page) => page.status === "changes" || page.status === "draft").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages"
        description="Every page on the site. Content is what a page shows; Settings are its title, address, visibility and search listing."
        meta={`${pages.length} pages${waiting ? ` · ${waiting} not published` : ""}`}
        actions={
          <Button asChild size="sm">
            <AppLink href="/admin/pages/new">
              <PlusIcon />
              New page
            </AppLink>
          </Button>
        }
      />

      <PagesTable pages={pages} routeFor={routeForPageHandle} />
    </div>
  );
}
