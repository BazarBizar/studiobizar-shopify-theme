import { notFound } from "next/navigation";

import { LayoutTemplateIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { DetailHeader } from "@/components/admin/detail-header";
import { PageEditor } from "@/components/admin/pages-table/page-editor";
import { Button } from "@/components/admin/ui/button";
import { buildPageMetafieldSpecs } from "@/lib/admin/page-specs";
import { getPage, pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
import { isBuilderHandle } from "@/lib/page-builder/handles";
import { routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Page" };

export default async function PageDetail({ params }: PageProps<"/admin/pages/[id]">) {
  const { id } = await params;

  const gid = pageIdFromParam(id);
  if (!gid) notFound();

  let page;
  try {
    page = await getPage(gid);
  } catch (error) {
    // A page deleted in Shopify since the list was rendered is a 404 here, not a
    // crash — the operator came from a link that was true a moment ago.
    if (error instanceof PageNotFoundError) notFound();
    throw error;
  }

  const specs = await buildPageMetafieldSpecs(page.metafields);

  const publicPath = routeForPageHandle(page.handle);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/admin/pages"
        backLabel="Pages"
        title={page.title}
        meta={page.handle}
      />

      {/* The page's sections are edited in the builder; this screen keeps the
          page record itself — title, handle, visibility. A page whose route is
          code (home, our-story) has no builder until MVP-2 converts it. */}
      {isBuilderHandle(page.handle) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {page.builder ? "Built with the page builder" : "This page can use the page builder"}
            </p>
            <p className="text-muted-foreground text-xs">
              {page.builder
                ? "Its sections, images and products are edited there. Title, address and visibility stay here."
                : "Add sections from the site’s design to give it a layout of its own."}
            </p>
          </div>
          <Button asChild size="sm">
            <AppLink href={`/admin/pages/${id}/builder`}>
              <LayoutTemplateIcon />
              Open page builder
            </AppLink>
          </Button>
        </div>
      )}

      <PageEditor
        page={{
          id: page.id,
          title: page.title,
          handle: page.handle,
          body: page.body,
          isPublished: page.isPublished,
        }}
        specs={specs}
        publicPath={publicPath}
      />
    </div>
  );
}
