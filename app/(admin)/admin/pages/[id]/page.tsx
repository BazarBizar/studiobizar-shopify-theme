import { notFound } from "next/navigation";

import { DeletePageCard } from "@/components/admin/pages-table/delete-page-card";
import { PageEditor } from "@/components/admin/pages-table/page-editor";
import { contentStatusFor } from "@/lib/admin/page-builder";
import { buildPageMetafieldSpecs } from "@/lib/admin/page-specs";
import { getPage, pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
import { BUILDER_METAFIELDS } from "@/lib/page-builder/document";
import { isBuilderEditable, isBuilderHandle } from "@/lib/page-builder/handles";
import { pageMigration } from "@/lib/page-builder/migrations";
import { LEGAL_HANDLES, routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Settings" };

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

  /**
   * MVP-2: once a migrated page's builder version is LIVE, its route no longer
   * reads these metafields — editing them here would change nothing a visitor
   * sees, which is worse than not offering them. Before that, they are still what
   * the live page shows, so they stay. A page at a free `/<handle>` is drawn by the
   * builder route alone, which never reads them — so they are never offered there.
   */
  const migration = pageMigration(page.handle);
  const builderLive = page.metafields.some((field) => field.key === BUILDER_METAFIELDS.published);
  const hideMetafields = (migration !== null && builderLive) || (migration === null && isBuilderHandle(page.handle));
  const specs = hideMetafields ? [] : await buildPageMetafieldSpecs(page.metafields);

  const publicPath = routeForPageHandle(page.handle);
  const stored = (key: string) => page.metafields.find((field) => field.key === key)?.value;
  const content = contentStatusFor(page.handle, stored(BUILDER_METAFIELDS.draft), stored(BUILDER_METAFIELDS.published));

  return (
    <div className="space-y-6">
      <PageEditor
        page={{
          id: page.id,
          title: page.title,
          handle: page.handle,
          body: page.body,
          isPublished: page.isPublished,
          // The builder draws this page; its Shopify body is not shown anywhere.
          contentInBuilder: page.builder,
          // Only where the route reads Shopify's SEO fields — see `EditablePage.seo`.
          ...(isBuilderEditable(page.handle) || (LEGAL_HANDLES as readonly string[]).includes(page.handle)
            ? { seo: { title: page.seoTitle ?? "", description: page.seoDescription ?? "" } }
            : {}),
        }}
        specs={specs}
        publicPath={publicPath}
        content={content}
        tabsParam={isBuilderEditable(page.handle) ? id : undefined}
        notice={
          // A site page not yet moved onto the builder still shows the content its
          // metafields hold, edited below; the Content tab is where it moves.
          migration && !page.builder ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
              This page still uses its original layout. Its content can move onto the page builder from the Content
              tab — until then it is edited below.
            </p>
          ) : null
        }
      />

      {/* A page made with the page builder can be deleted here; a site page whose
          route is code cannot, and is not offered it. */}
      {isBuilderHandle(page.handle) && page.builder && (
        <DeletePageCard pageId={page.id} title={page.title} publicPath={publicPath} />
      )}
    </div>
  );
}
