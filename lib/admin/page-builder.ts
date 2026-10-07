import "server-only";

import {
  BUILDER_METAFIELDS,
  DOCUMENT_VERSION,
  MAX_DOCUMENT_BYTES,
  parsePageDocument,
  publishProblems,
  sameContent,
  type DocumentContent,
  type PageDocument,
  type PublishProblem,
} from "@/lib/page-builder/document";
import { builderHandleProblem, isBuilderEditable, isBuilderHandle } from "@/lib/page-builder/handles";
import { migrateToDocument, pageMigration } from "@/lib/page-builder/migrations";
import { documentFromTemplate, type PageTemplateId } from "@/lib/page-builder/templates";
import { getLivePageBuilderDocument } from "@/lib/shopify";
import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";

import type { CaptionedImageValue, ImageRef, ResourceRef } from "@/lib/page-builder/fields";

import { getCollection } from "./collections";
import { resolveFiles } from "./media";
import { getEntry, type Entry } from "./metaobjects";
import { OPERATIONS } from "./operations";
import { getPage, PageNotFoundError, type PageDetail } from "./pages";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * The page builder's server half: reading a page's three documents and the four
 * things that change them. Every write is ONE `pageUpdate`, so publishing cannot
 * leave the live and previous copies half-swapped.
 *
 * CONFLICTS. A save names the draft revision it was made from. If the stored
 * draft has moved on — a second tab, a colleague — the save is refused rather
 * than silently overwriting their work. This is read-then-write, not a
 * transaction; with a handful of staff the window is milliseconds, and the
 * failure it guards against (two people editing one page for an afternoon) is
 * the one that actually happens.
 */

export type BuilderErrorCode = "CONFLICT" | "NOT_ALLOWED" | "NOT_READY" | "NOT_FOUND" | "TOO_LARGE";

export class BuilderError extends Error {
  readonly code: BuilderErrorCode;
  readonly problems: PublishProblem[];

  constructor(code: BuilderErrorCode, message: string, problems: PublishProblem[] = []) {
    super(message);
    this.name = "BuilderError";
    this.code = code;
    this.problems = problems;
  }
}

export type BuilderState = {
  page: Pick<PageDetail, "id" | "title" | "handle" | "isPublished" | "updatedAt">;
  /** What the editor opens. Falls back to the published copy, then to empty. */
  draft: PageDocument;
  /** null until the first publish. */
  published: PageDocument | null;
  canRollback: boolean;
  hasUnpublishedChanges: boolean;
  /** Sections the stored draft held that could not be read — shown, not hidden. */
  dropped: number;
  /** The live document exists but is unreadable; the storefront shows the fallback. */
  publishedInvalid: boolean;
  /** The page has a builder document at all. False for a hand-built page not yet converted. */
  exists: boolean;
  /** A hand-built page with a migration: converted in place, keeps its own route. */
  migrated: boolean;
};

function valueOf(page: PageDetail, key: string): string | null {
  return page.metafields.find((field) => field.key === key)?.value ?? null;
}

function stateFrom(page: PageDetail): BuilderState {
  const draft = parsePageDocument(valueOf(page, BUILDER_METAFIELDS.draft));
  const published = parsePageDocument(valueOf(page, BUILDER_METAFIELDS.published));
  const previous = parsePageDocument(valueOf(page, BUILDER_METAFIELDS.previous));

  const publishedDoc = published.ok ? published.doc : null;
  const draftDoc = draft.ok ? draft.doc : (publishedDoc ?? documentFromTemplate("blank"));

  return {
    page: {
      id: page.id,
      title: page.title,
      handle: page.handle,
      isPublished: page.isPublished,
      updatedAt: page.updatedAt,
    },
    draft: draftDoc,
    published: publishedDoc,
    canRollback: previous.ok,
    hasUnpublishedChanges: !sameContent(draftDoc, publishedDoc),
    dropped: draft.ok ? draft.dropped : 0,
    publishedInvalid: !published.ok && published.reason === "invalid",
    exists: page.builder,
    migrated: pageMigration(page.handle) !== null,
  };
}

/**
 * Throws NOT_ALLOWED for a page whose route is code and has no migration yet —
 * see `lib/page-builder/migrations.ts` for the ones that do.
 */
export async function getBuilderState(pageId: string): Promise<BuilderState> {
  const page = await getPage(pageId);
  if (!isBuilderEditable(page.handle)) {
    throw new BuilderError(
      "NOT_ALLOWED",
      `“${page.handle}” has a layout of its own in the storefront code and cannot be edited with the page builder yet.`,
    );
  }
  return stateFrom(page);
}

function serialize(doc: PageDocument): string {
  const json = JSON.stringify(doc);
  if (new TextEncoder().encode(json).byteLength > MAX_DOCUMENT_BYTES) {
    throw new BuilderError("TOO_LARGE", "This page has grown too large to save. Remove a few sections.");
  }
  return json;
}

const jsonField = (key: string, doc: PageDocument) => ({
  namespace: METAFIELD_NAMESPACE,
  key,
  type: "json",
  value: serialize(doc),
});

type PageUpdateResult = {
  pageUpdate: {
    page: { id: string; handle: string; updatedAt: string } | null;
    userErrors: { field?: string[] | null; message: string }[];
  };
};

async function writePage(id: string, page: Record<string, unknown>) {
  const data = await adminGraphQL<PageUpdateResult>("pageUpdate", OPERATIONS.pageUpdate.document, { id, page });
  assertNoUserErrors(data.pageUpdate.userErrors);
  if (!data.pageUpdate.page) throw new PageNotFoundError();
  return data.pageUpdate.page;
}

function assertRevision(state: BuilderState, baseRevision: number) {
  if (state.draft.meta.revision !== baseRevision) {
    throw new BuilderError(
      "CONFLICT",
      `This page was saved ${state.draft.meta.savedBy ? `by ${state.draft.meta.savedBy} ` : ""}since you opened it. Reload to see the latest version.`,
    );
  }
}

const now = () => new Date().toISOString();

/* -------------------------------------------------------------------------- *
 * Draft
 * -------------------------------------------------------------------------- */

export async function saveDraft(pageId: string, content: DocumentContent, baseRevision: number, actor: string) {
  const state = await getBuilderState(pageId);
  // A hand-built page starts from its own content (`convertToBuilder`), never
  // from whatever a first save happens to send.
  if (state.migrated && !state.exists) {
    throw new BuilderError("NOT_ALLOWED", "Move this page to the page builder first.");
  }
  assertRevision(state, baseRevision);

  const next: PageDocument = {
    version: DOCUMENT_VERSION,
    page: content.page,
    sections: content.sections,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };

  await writePage(pageId, { metafields: [jsonField(BUILDER_METAFIELDS.draft, next)] });

  return {
    revision: next.meta.revision,
    savedAt: next.meta.savedAt,
    hasUnpublishedChanges: !sameContent(next, state.published),
  };
}

/** Throws the draft away: the working copy becomes the live one again. */
export async function discardDraft(pageId: string, baseRevision: number, actor: string) {
  const state = await getBuilderState(pageId);
  assertRevision(state, baseRevision);
  if (!state.published) throw new BuilderError("NOT_ALLOWED", "There is no published version to go back to.");

  const next: PageDocument = {
    ...state.published,
    meta: { ...state.published.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };

  await writePage(pageId, { metafields: [jsonField(BUILDER_METAFIELDS.draft, next)] });
  return { revision: next.meta.revision };
}

/* -------------------------------------------------------------------------- *
 * Publish and rollback
 * -------------------------------------------------------------------------- */

/**
 * Content only. The page's SEO, title, address and visibility belong to the
 * Shopify page and are set on the Pages screen; publishing never touches them —
 * apart from a page's very first publish, which makes it visible.
 */
async function goLive(pageId: string, state: BuilderState, live: PageDocument, draftRevision: number) {
  const draft: PageDocument = { ...live, meta: { ...live.meta, revision: draftRevision } };

  await writePage(pageId, {
    // A first publish also makes the page visible; after that, visibility is the
    // operator's to set and publishing content never overrides it.
    ...(state.published ? {} : { isPublished: true }),
    metafields: [
      jsonField(BUILDER_METAFIELDS.published, live),
      jsonField(BUILDER_METAFIELDS.draft, draft),
      ...(state.published ? [jsonField(BUILDER_METAFIELDS.previous, state.published)] : []),
    ],
  });
}

export async function publish(pageId: string, baseRevision: number, actor: string) {
  const state = await getBuilderState(pageId);
  assertRevision(state, baseRevision);

  const problems = publishProblems(state.draft);
  if (problems.length) {
    throw new BuilderError("NOT_READY", "Some sections are missing required content.", problems);
  }

  const live: PageDocument = {
    ...state.draft,
    meta: { ...state.draft.meta, publishedAt: now(), publishedBy: actor },
  };

  await goLive(pageId, state, live, baseRevision + 1);
  return { revision: baseRevision + 1, publishedAt: live.meta.publishedAt!, handle: state.page.handle };
}

/**
 * Loads the version that was live before the last publish INTO THE DRAFT. Nothing
 * changes on the site: the operator looks at it in the preview and publishes it
 * when it is right — the same path every other change takes, so "restore" never
 * puts something live the operator has not seen.
 */
export async function rollback(pageId: string, baseRevision: number, actor: string) {
  const page = await getPage(pageId);
  if (!isBuilderEditable(page.handle)) throw new BuilderError("NOT_ALLOWED", "Not a page builder page.");

  const state = stateFrom(page);
  assertRevision(state, baseRevision);

  const previous = parsePageDocument(valueOf(page, BUILDER_METAFIELDS.previous));
  if (!previous.ok) throw new BuilderError("NOT_ALLOWED", "There is no earlier version to load.");

  const next: PageDocument = {
    ...state.draft,
    page: previous.doc.page,
    sections: previous.doc.sections,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };

  await writePage(pageId, { metafields: [jsonField(BUILDER_METAFIELDS.draft, next)] });
  return { revision: next.meta.revision };
}

/* -------------------------------------------------------------------------- *
 * Create and delete
 * -------------------------------------------------------------------------- */

/**
 * A new builder page, hidden until its first publish. The handle is checked
 * against everything `/<handle>` could collide with BEFORE Shopify is asked, and
 * Shopify's own uniqueness check catches the rest (an existing page's handle).
 */
async function createWithDocument(title: string, handle: string, doc: PageDocument, actor: string) {
  const problem = builderHandleProblem(handle);
  if (problem) throw new BuilderError("NOT_ALLOWED", problem);

  const first: PageDocument = {
    ...doc,
    meta: { revision: 1, savedAt: now(), savedBy: actor, publishedAt: null, publishedBy: null },
  };

  const data = await adminGraphQL<{
    pageCreate: {
      page: { id: string; title: string; handle: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("pageCreate", OPERATIONS.pageCreate.document, {
    page: {
      title,
      handle,
      body: "",
      isPublished: false,
      metafields: [jsonField(BUILDER_METAFIELDS.draft, first)],
    },
  });

  assertNoUserErrors(data.pageCreate.userErrors);
  if (!data.pageCreate.page) throw new BuilderError("NOT_FOUND", "Shopify did not return the new page.");

  return data.pageCreate.page;
}

export async function createBuilderPage(
  input: { title: string; handle: string; template: PageTemplateId },
  actor: string,
) {
  return createWithDocument(input.title, input.handle, documentFromTemplate(input.template), actor);
}

/**
 * A copy of a builder page, as a new hidden page with its own address — the
 * starting point for next season's campaign.
 *
 * It copies the source's DRAFT, the working copy the operator sees in the
 * builder, not its published version: duplicating is "start from what I am
 * looking at". The copy has no published version and no history of its own.
 * Section ids are kept — they only need to be unique within one document.
 */
export async function duplicateBuilderPage(
  sourceId: string,
  input: { title: string; handle: string },
  actor: string,
) {
  const source = await getBuilderState(sourceId);
  return createWithDocument(input.title, input.handle, source.draft, actor);
}

/**
 * MVP-2: moves a hand-built page onto the builder — as a DRAFT made from the
 * content it shows today. Nothing changes on the storefront until that draft is
 * published; the page's route renders its own JSX until then.
 *
 * Refused for a page with no migration, and for one already converted: running it
 * twice would replace whatever the operator has done in the builder since.
 */
/**
 * A `captioned_image` entry as the snapshot the builder stores — the same image,
 * alt text and caption `normalizeCaptionedImage` gives the hand-built route.
 * null for an entry of another type or with no image, kept in place so a page that
 * takes a slice of the list by position takes the same slice.
 */
function captionedFromEntry(entry: Entry | null): CaptionedImageValue | null {
  if (!entry || entry.type !== "captioned_image") return null;

  const field = (key: string) => entry.fields.find((candidate) => candidate.key === key);
  const media = field("image")?.reference;
  const url = media?.image?.url;
  if (!media?.id || !url || !/^https:\/\/cdn\.shopify\.com\//.test(url)) return null;

  const altText = field("alt_text")?.value?.trim() || media.image?.altText || media.alt || null;

  return {
    image: { id: media.id, url, altText, width: media.image?.width ?? null, height: media.image?.height ?? null },
    caption: field("caption")?.value ?? "",
  };
}

/** Every list-of-entries metafield on the page, resolved for the migration. */
async function resolveImageLists(page: PageDetail): Promise<Record<string, (CaptionedImageValue | null)[]>> {
  const lists = page.metafields.filter((field) => field.type === "list.metaobject_reference");

  const resolved = await Promise.all(
    lists.map(async (field) => {
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(field.value) as unknown;
        ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
      } catch {
        ids = [];
      }
      const entries = await Promise.all(ids.map((id) => getEntry(id).catch(() => null)));
      return [field.key, entries.map(captionedFromEntry)] as const;
    }),
  );

  return Object.fromEntries(resolved);
}

/**
 * The draft a page would be converted to, without writing it — what
 * `convertToBuilder` saves, and what the parity check renders beside the
 * hand-built route to prove they match.
 */
export async function migrationDraftFor(page: PageDetail): Promise<DocumentContent> {
  const migration = pageMigration(page.handle);
  if (!migration) throw new BuilderError("NOT_ALLOWED", "This page cannot be moved to the page builder yet.");

  return migrateToDocument(migration, {
    metafields: Object.fromEntries(page.metafields.map((field) => [field.key, field.value])),
    images: await resolveImageLists(page),
    collections: await resolveCollections(page),
    files: await resolveImageFiles(page),
    bodySummary: page.bodySummary,
  });
}

/** Every `collection_reference` metafield, as the `{ id, handle, title }` the pickers store. */
async function resolveCollections(page: PageDetail): Promise<Record<string, ResourceRef | null>> {
  const refs = page.metafields.filter((field) => field.type === "collection_reference");
  const resolved = await Promise.all(
    refs.map(async (field) => {
      const collection = await getCollection(field.value).catch(() => null);
      return [field.key, collection ? { id: collection.id, handle: collection.handle, title: collection.title } : null] as const;
    }),
  );
  return Object.fromEntries(resolved);
}

/** Every `file_reference` metafield that is an image on Shopify's CDN, as an image snapshot. */
async function resolveImageFiles(page: PageDetail): Promise<Record<string, ImageRef | null>> {
  const refs = page.metafields.filter((field) => field.type === "file_reference");
  const files = await resolveFiles(refs.map((field) => field.value)).catch(() => []);
  const byId = new Map(files.map((file) => [file.id, file]));

  return Object.fromEntries(
    refs.map((field) => {
      const file = byId.get(field.value);
      const image =
        file?.kind === "MediaImage" && file.url && /^https:\/\/cdn\.shopify\.com\//.test(file.url)
          ? { id: file.id, url: file.url, altText: file.alt, width: file.width, height: file.height }
          : null;
      return [field.key, image];
    }),
  );
}

export async function convertToBuilder(pageId: string, actor: string) {
  const page = await getPage(pageId);
  if (page.builder) throw new BuilderError("NOT_ALLOWED", "This page is already on the page builder.");

  const content = await migrationDraftFor(page);

  const first: PageDocument = {
    version: DOCUMENT_VERSION,
    ...content,
    meta: { revision: 1, savedAt: now(), savedBy: actor, publishedAt: null, publishedBy: null },
  };

  await writePage(pageId, { metafields: [jsonField(BUILDER_METAFIELDS.draft, first)] });
  return { revision: 1 };
}

/**
 * Deletes a builder page. The decision is made from the STORE, not the request:
 * the page is re-read and must have a builder-only handle and a builder document.
 * `home`, `our-story` and every schema-push page fail both tests.
 */
export async function deleteBuilderPage(pageId: string) {
  const page = await getPage(pageId);

  if (!isBuilderHandle(page.handle) || !page.builder) {
    throw new BuilderError("NOT_ALLOWED", "Only pages made with the page builder can be deleted here.");
  }

  const data = await adminGraphQL<{
    pageDelete: { deletedPageId: string | null; userErrors: { field?: string[] | null; message: string }[] };
  }>("pageDelete", OPERATIONS.pageDelete.document, { id: pageId });

  assertNoUserErrors(data.pageDelete.userErrors);
  return { id: data.pageDelete.deletedPageId ?? pageId, handle: page.handle };
}

/* -------------------------------------------------------------------------- *
 * Waiting for the storefront
 * -------------------------------------------------------------------------- */

/**
 * WHY A PUBLISH WAITS. The Storefront API keeps serving its cached response for
 * a while after an Admin write — measured on this store at 21–29 seconds, for a
 * changed document and for a page that was looked up while still hidden. Next's
 * cache, dropped at the moment of publishing, would refill from that stale
 * response and keep it for the whole ISR window: an hour of the old page, or of a
 * 404 for a page that is live.
 *
 * So after a write the route polls the Storefront API — uncached — until it
 * serves what was written, then drops Next's cache again. The `publishedAt` that
 * every publish and rollback stamps identifies the version exactly.
 *
 * Returns false on timeout. The caller still revalidates then, and the ISR window
 * catches up on its own.
 */
export async function waitForStorefront(
  handle: string,
  expect: { publishedAt: string } | { gone: true },
  { timeoutMs = 75_000, intervalMs = 3_000 } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const live = await getLivePageBuilderDocument(handle);
      if ("gone" in expect ? !live.found : stampOf(live.value) === expect.publishedAt) return true;
    } catch {
      // A transient Storefront failure is one missed poll, not a failed publish.
    }

    if (Date.now() + intervalMs > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function stampOf(raw: string | null): string | null {
  const parsed = parsePageDocument(raw);
  return parsed.ok ? parsed.doc.meta.publishedAt : null;
}

/* -------------------------------------------------------------------------- *
 * The Pages list
 * -------------------------------------------------------------------------- */

/**
 * Where a page's CONTENT stands — a separate question from whether the page is
 * visible on the site, which is Shopify's own switch (`isPublished`).
 *
 *   published   what the builder last published is what the page shows
 *   changes     published, and edited since
 *   draft       built but never published
 *   setup       a site page that can move onto the builder and has not yet
 *   fixed       drawn by its route's code; no builder (the legal pages)
 */
export type ContentStatus = "published" | "changes" | "draft" | "setup" | "fixed";

export type PageRow = {
  id: string;
  title: string;
  handle: string;
  isPublished: boolean;
  status: ContentStatus;
  /** The builder can edit this page (`isBuilderEditable`). */
  editable: boolean;
  /** Made with the builder at `/<handle>` — the only kind that can be deleted. */
  deletable: boolean;
  sections: number;
  savedAt: string | null;
  savedBy: string | null;
};

const STATUS_ORDER: Record<ContentStatus, number> = { changes: 0, draft: 1, setup: 2, published: 3, fixed: 4 };

/**
 * Every page, with where its content stands. Work still to do comes first —
 * unpublished changes, then drafts — then what is up to date, then the pages
 * whose layout is code.
 */
export async function listPagesWithContent(): Promise<PageRow[]> {
  type Raw = {
    id: string;
    title: string;
    handle: string;
    isPublished: boolean;
    updatedAt: string;
    draft: { value: string } | null;
    live: { value: string } | null;
  };

  const all: Raw[] = [];
  let after: string | null = null;
  do {
    const data: { pages: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Raw[] } } =
      await adminGraphQL("pagesBuilderStatus", OPERATIONS.pagesBuilderStatus.document, { first: 50, after });
    all.push(...data.pages.nodes);
    after = data.pages.pageInfo.hasNextPage ? data.pages.pageInfo.endCursor : null;
  } while (after);

  return all
    .map((page): PageRow => {
      const draft = parsePageDocument(page.draft?.value);
      const live = parsePageDocument(page.live?.value);
      const draftDoc = draft.ok ? draft.doc : live.ok ? live.doc : null;
      const liveDoc = live.ok ? live.doc : null;
      const editable = isBuilderEditable(page.handle);

      const status: ContentStatus = !editable
        ? "fixed"
        : !draftDoc
          ? pageMigration(page.handle)
            ? "setup"
            : "draft"
          : !liveDoc
            ? "draft"
            : sameContent(draftDoc, liveDoc)
              ? "published"
              : "changes";

      return {
        id: page.id,
        title: page.title,
        handle: page.handle,
        isPublished: page.isPublished,
        status,
        editable,
        deletable: isBuilderHandle(page.handle) && Boolean(page.draft || page.live),
        sections: draftDoc?.sections.length ?? 0,
        savedAt: draftDoc?.meta.savedAt ?? null,
        savedBy: draftDoc?.meta.savedBy ?? null,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title));
}
