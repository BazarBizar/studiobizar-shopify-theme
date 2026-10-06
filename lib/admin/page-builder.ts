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
import { builderHandleProblem, isBuilderHandle } from "@/lib/page-builder/handles";
import { documentFromTemplate, type PageTemplateId } from "@/lib/page-builder/templates";
import { getLivePageBuilderDocument } from "@/lib/shopify";
import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";

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
  };
}

/** Throws NOT_ALLOWED for a page whose route is code — those are MVP-2's to convert. */
export async function getBuilderState(pageId: string): Promise<BuilderState> {
  const page = await getPage(pageId);
  if (!isBuilderHandle(page.handle)) {
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
 * The page's SEO lives in Shopify's own `global.title_tag` / `description_tag`,
 * which is what `page.seo` reads on the storefront and what a Liquid theme would
 * read too. They are written AT PUBLISH from the document, so a draft's new title
 * never reaches search results before the page it describes does.
 */
async function seoWrites(pageId: string, doc: PageDocument) {
  const set: { namespace: string; key: string; type: string; value: string }[] = [];
  const clear: string[] = [];

  for (const [key, value] of [
    ["title_tag", doc.page.seoTitle],
    ["description_tag", doc.page.seoDescription],
  ] as const) {
    if (value.trim()) set.push({ namespace: "global", key, type: "single_line_text_field", value: value.trim() });
    else clear.push(key);
  }

  const clearAfter = async () => {
    if (!clear.length) return;
    const data = await adminGraphQL<{
      metafieldsDelete: { userErrors: { field?: string[] | null; message: string }[] };
    }>("metafieldsDelete", OPERATIONS.metafieldsDelete.document, {
      metafields: clear.map((key) => ({ ownerId: pageId, namespace: "global", key })),
    });
    assertNoUserErrors(data.metafieldsDelete.userErrors);
  };

  return { set, clearAfter };
}

async function goLive(pageId: string, state: BuilderState, live: PageDocument, draftRevision: number) {
  const draft: PageDocument = { ...live, meta: { ...live.meta, revision: draftRevision } };
  const seo = await seoWrites(pageId, live);

  await writePage(pageId, {
    // A first publish also makes the page visible; after that, visibility is the
    // operator's to set and publishing content never overrides it.
    ...(state.published ? {} : { isPublished: true }),
    metafields: [
      jsonField(BUILDER_METAFIELDS.published, live),
      jsonField(BUILDER_METAFIELDS.draft, draft),
      ...(state.published ? [jsonField(BUILDER_METAFIELDS.previous, state.published)] : []),
      ...seo.set,
    ],
  });

  // Separate because a metafield is cleared by deleting it, not by writing "".
  // Running after the publish means a failure here leaves an old SEO line, never
  // an unpublished page.
  await seo.clearAfter().catch(() => undefined);
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

/** Swaps the live and previous versions — rolling back twice is a redo. */
export async function rollback(pageId: string, baseRevision: number, actor: string) {
  const page = await getPage(pageId);
  if (!isBuilderHandle(page.handle)) throw new BuilderError("NOT_ALLOWED", "Not a page builder page.");

  const state = stateFrom(page);
  assertRevision(state, baseRevision);

  const previous = parsePageDocument(valueOf(page, BUILDER_METAFIELDS.previous));
  if (!previous.ok || !state.published) {
    throw new BuilderError("NOT_ALLOWED", "There is no earlier version to restore.");
  }

  const live: PageDocument = {
    ...previous.doc,
    meta: { ...previous.doc.meta, publishedAt: now(), publishedBy: actor },
  };

  await goLive(pageId, state, live, baseRevision + 1);
  return { revision: baseRevision + 1, publishedAt: live.meta.publishedAt!, handle: page.handle };
}

/* -------------------------------------------------------------------------- *
 * Create and delete
 * -------------------------------------------------------------------------- */

/**
 * A new builder page, hidden until its first publish. The handle is checked
 * against everything `/<handle>` could collide with BEFORE Shopify is asked, and
 * Shopify's own uniqueness check catches the rest (an existing page's handle).
 */
export async function createBuilderPage(
  input: { title: string; handle: string; template: PageTemplateId },
  actor: string,
) {
  const problem = builderHandleProblem(input.handle);
  if (problem) throw new BuilderError("NOT_ALLOWED", problem);

  const doc = documentFromTemplate(input.template);
  const first: PageDocument = { ...doc, meta: { ...doc.meta, revision: 1, savedAt: now(), savedBy: actor } };

  const data = await adminGraphQL<{
    pageCreate: {
      page: { id: string; title: string; handle: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("pageCreate", OPERATIONS.pageCreate.document, {
    page: {
      title: input.title,
      handle: input.handle,
      body: "",
      isPublished: false,
      metafields: [jsonField(BUILDER_METAFIELDS.draft, first)],
    },
  });

  assertNoUserErrors(data.pageCreate.userErrors);
  if (!data.pageCreate.page) throw new BuilderError("NOT_FOUND", "Shopify did not return the new page.");

  return data.pageCreate.page;
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
