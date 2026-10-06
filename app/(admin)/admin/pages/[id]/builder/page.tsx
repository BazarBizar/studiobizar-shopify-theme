import { notFound } from "next/navigation";

import { AppLink } from "@/components/admin/app-link";
import { PageBuilder } from "@/components/admin/page-builder/page-builder";
import { Button } from "@/components/admin/ui/button";
import { listCollections } from "@/lib/admin/collections";
import { BuilderError, getBuilderState } from "@/lib/admin/page-builder";
import { pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
import { routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Page builder" };

/**
 * The page builder for one page. Reads the page's documents and the collection
 * list the pickers offer, then hands both to the client editor.
 *
 * `key` is the draft revision: after a discard, a restore or "load latest", the
 * refreshed server render carries a newer revision and mounts a fresh editor,
 * rather than one that would have to reconcile its state with a document it did
 * not write.
 */
export default async function PageBuilderScreen({ params }: PageProps<"/admin/pages/[id]/builder">) {
  const { id } = await params;

  const gid = pageIdFromParam(id);
  if (!gid) notFound();

  let state;
  try {
    state = await getBuilderState(gid);
  } catch (error) {
    if (error instanceof PageNotFoundError) notFound();
    if (error instanceof BuilderError) {
      return (
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="text-lg font-semibold">This page has its own layout</h1>
          <p className="text-muted-foreground text-sm">{error.message}</p>
          <Button asChild variant="outline">
            <AppLink href={`/admin/pages/${id}`}>Back to the page</AppLink>
          </Button>
        </div>
      );
    }
    throw error;
  }

  const collections = await listCollections();

  return (
    <PageBuilder
      key={state.draft.meta.revision}
      page={{
        id: state.page.id,
        param: id,
        title: state.page.title,
        handle: state.page.handle,
        isPublished: state.page.isPublished,
      }}
      initial={{
        content: { page: state.draft.page, sections: state.draft.sections },
        revision: state.draft.meta.revision,
        hasPublished: state.published !== null,
        hasUnpublishedChanges: state.hasUnpublishedChanges,
        canRollback: state.canRollback,
        dropped: state.dropped,
        publishedInvalid: state.publishedInvalid,
      }}
      collections={collections
        .filter((collection) => collection.handle !== "frontpage")
        .map((collection) => ({
          id: collection.id,
          handle: collection.handle,
          title: collection.title,
          thumbnail: collection.image?.url ?? null,
        }))}
      publicPath={routeForPageHandle(state.page.handle)}
    />
  );
}
