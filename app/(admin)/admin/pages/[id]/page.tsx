import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/admin/detail-header";
import { PageEditor } from "@/components/admin/pages-table/page-editor";
import { buildPageMetafieldSpecs } from "@/lib/admin/page-specs";
import { getPage, pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
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
