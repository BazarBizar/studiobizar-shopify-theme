import { notFound } from "next/navigation";

import { AppLink } from "@/components/admin/app-link";
import { ConvertPage } from "@/components/admin/page-builder/convert-page";
import { PageBuilder } from "@/components/admin/page-builder/page-builder";
import { PageEditorBar } from "@/components/admin/pages-table/page-editor-bar";
import { Button } from "@/components/admin/ui/button";
import { listCollections } from "@/lib/admin/collections";
import { getExampleMedia } from "@/lib/admin/example-media";
import { getThemeState } from "@/lib/admin/theme-builder";
import { linkTargetsFrom } from "@/lib/admin/link-targets";
import { listAllEntries } from "@/lib/admin/metaobjects";
import { BuilderError, getBuilderState } from "@/lib/admin/page-builder";
import { listPages, pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
import { routeForPageHandle } from "@/lib/routes";

export const metadata = { title: "Content" };

/**
 * Pages → a page → Content: the page builder. Reads the page's documents and the
 * collection list the pickers offer, then hands both to the client editor. The
 * page's Settings are the sibling tab, at /admin/pages/<id>.
 *
 * `key` is the draft revision: after a discard, a restore or "load latest", the
 * refreshed server render carries a newer revision and mounts a fresh editor,
 * rather than one that would have to reconcile its state with a document it did
 * not write.
 */
export default async function PageContentScreen({ params }: PageProps<"/admin/pages/[id]/content">) {
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
            <AppLink href={`/admin/pages/${id}`}>Open the page’s settings</AppLink>
          </Button>
        </div>
      );
    }
    throw error;
  }

  // MVP-2: a hand-built page with a migration, not yet moved — offer the move
  // rather than an empty editor whose first autosave would replace its content.
  if (state.migrated && !state.exists) {
    return (
      <>
        <PageEditorBar
          className="-mx-4 -mt-4 md:-mx-6 md:-mt-6"
          title={state.page.title}
          path={routeForPageHandle(state.page.handle)}
          param={id}
          active="content"
          isPublished={state.page.isPublished}
          content="setup"
        />
        <ConvertPage
          pageId={state.page.id}
          title={state.page.title}
          route={routeForPageHandle(state.page.handle)}
        />
      </>
    );
  }

  const [collections, pages, faqEntries] = await Promise.all([
    listCollections(),
    listPages(),
    listAllEntries("faq_item").catch(() => []),
  ]);
  // What a newly added section is filled with, so it never arrives empty; and the
  // site's saved colours (Header & footer → Site style), for every colour picker.
  const [examples, savedColours] = await Promise.all([
    getExampleMedia(collections),
    getThemeState()
      .then((theme) => theme.draft.global.colors)
      .catch(() => []),
  ]);

  /** Where a button can point, offered by the link picker. */
  const linkTargets = linkTargetsFrom(pages, collections);

  /** The categories the FAQ entries use, in first-seen order. */
  const faqCategories = [
    ...new Set(
      faqEntries
        .map((entry) => entry.fields.find((field) => field.key === "category")?.value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

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
      lookups={{ linkTargets, faqCategories, examples, savedColours }}
      publicPath={routeForPageHandle(state.page.handle)}
    />
  );
}
