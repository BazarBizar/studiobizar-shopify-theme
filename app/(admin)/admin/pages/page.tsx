import { LayoutTemplateIcon, PlusIcon } from "lucide-react";

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
        description="Every page on the website. “Edit content” changes what the page shows; “Settings” changes its title, web address and whether visitors can see it."
        meta={waiting ? `${waiting} waiting to be published` : undefined}
        actions={
          <Button asChild size="sm">
            <AppLink href="/admin/pages/new">
              <PlusIcon />
              New page
            </AppLink>
          </Button>
        }
      />

      {/* Product, collection, project and designer pages are not pages of their own:
          one template each draws all of them. Said here, where people look for them. */}
      <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">Looking for a product, collection, project or designer page?</span>{" "}
          They share one layout per kind — change it once under Templates and every page of that kind follows. The
          shop, search and list pages are there too.
        </p>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <AppLink href="/admin/templates">
            <LayoutTemplateIcon />
            Open Templates
          </AppLink>
        </Button>
      </div>

      <PagesTable pages={pages} routeFor={routeForPageHandle} />
    </div>
  );
}
