import { notFound } from "next/navigation";

import { AppLink } from "@/components/admin/app-link";
import { ConvertPage } from "@/components/admin/page-builder/convert-page";
import { PageBuilder } from "@/components/admin/page-builder/page-builder";
import { Button } from "@/components/admin/ui/button";
import { listCollections } from "@/lib/admin/collections";
import { listAllEntries } from "@/lib/admin/metaobjects";
import { BuilderError, getBuilderState } from "@/lib/admin/page-builder";
import { listPages, pageIdFromParam, PageNotFoundError } from "@/lib/admin/pages";
import { ROUTES, routeForPageHandle, shopifyUrlToRoute } from "@/lib/routes";

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
      <ConvertPage
        pageId={state.page.id}
        title={state.page.title}
        route={routeForPageHandle(state.page.handle)}
      />
    );
  }

  const [collections, pages, faqEntries] = await Promise.all([
    listCollections(),
    listPages(),
    listAllEntries("faq_item").catch(() => []),
  ]);

  /** Where a button can point, offered by the link picker. Visible pages only — a link to a hidden one 404s. */
  const linkTargets = [
    ...pages
      .filter((entry) => entry.isPublished)
      .map((entry) => ({ label: entry.title, href: routeForPageHandle(entry.handle), group: "Pages" as const })),
    ...collections
      .filter((collection) => collection.handle !== "frontpage")
      .map((collection) => ({
        label: collection.title,
        href: shopifyUrlToRoute(`/collections/${collection.handle}`),
        group: "Collections" as const,
      })),
    { label: "Shop", href: ROUTES.shop, group: "Site" as const },
    { label: "All collections", href: ROUTES.collections, group: "Site" as const },
    { label: "Projects", href: ROUTES.projects, group: "Site" as const },
    { label: "Designers", href: ROUTES.designers, group: "Site" as const },
    { label: "Contact", href: ROUTES.contact, group: "Site" as const },
  ];

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
      lookups={{ linkTargets, faqCategories }}
      publicPath={routeForPageHandle(state.page.handle)}
    />
  );
}
