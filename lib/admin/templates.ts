import "server-only";

import {
  DOCUMENT_VERSION,
  MAX_DOCUMENT_BYTES,
  misplacedSections,
  parsePageDocument,
  publishProblems,
  sameContent,
  type DocumentContent,
  type DocumentMeta,
  type PageDocument,
  type PublishProblem,
} from "@/lib/page-builder/document";
import { defaultTemplateContent } from "@/lib/page-builder/template-defaults";
import { TEMPLATE_KINDS, TEMPLATES, templateMetafields, type TemplateKind } from "@/lib/page-builder/template-kinds";
import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";

import { OPERATIONS } from "./operations";
import { ensureShopJsonDefinition } from "./shop-json";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Website → Templates, the server half: one template's three copies on the shop and
 * the four things that change them — the page builder's contract
 * (`lib/admin/page-builder.ts`) and the Theme Builder's storage
 * (`lib/admin/theme-builder.ts`):
 *
 *  - every write is ONE `metafieldsSet`, all or nothing;
 *  - a save names the draft revision it was made from and is refused as a CONFLICT
 *    when the stored draft has moved on;
 *  - only Publish changes what visitors see; what it replaces is kept for a one-step
 *    rollback ("Load previously published version").
 *
 * Until the first publish there is no published copy and the route draws the layout
 * in its code; the editor opens on `defaultTemplateContent`, which reproduces it.
 * The published copy's definition (storefront access PUBLIC_READ) is made on the first
 * publish when the store has none, so nobody has to run a setup script.
 */

export type TemplateErrorCode = "CONFLICT" | "NOT_ALLOWED" | "NOT_READY" | "TOO_LARGE";

export class TemplateError extends Error {
  readonly code: TemplateErrorCode;
  readonly problems: PublishProblem[];
  constructor(code: TemplateErrorCode, message: string, problems: PublishProblem[] = []) {
    super(message);
    this.name = "TemplateError";
    this.code = code;
    this.problems = problems;
  }
}

export type TemplateState = {
  kind: TemplateKind;
  shopId: string;
  /** What the editor opens: the draft, else the published copy, else the page as it is. */
  draft: PageDocument;
  /** null until the first publish — the route draws the layout in its code. */
  published: PageDocument | null;
  canRollback: boolean;
  hasUnpublishedChanges: boolean;
  dropped: number;
  /** The live copy exists but cannot be read; the route falls back to its own layout. */
  publishedInvalid: boolean;
  hasDefinition: boolean;
};

const EMPTY_META: DocumentMeta = { revision: 0, savedAt: null, savedBy: null, publishedAt: null, publishedBy: null };

const now = () => new Date().toISOString();

function original(kind: TemplateKind): PageDocument {
  return { version: DOCUMENT_VERSION, ...defaultTemplateContent(kind), meta: { ...EMPTY_META } };
}

type Raw = {
  shop: {
    id: string;
    published: { value: string } | null;
    draft: { value: string } | null;
    previous: { value: string } | null;
  };
  metafieldDefinitions: { nodes: { id: string }[] };
};

async function read(kind: TemplateKind): Promise<{ raw: Raw; state: TemplateState }> {
  const raw = await adminGraphQL<Raw>("templateDocuments", OPERATIONS.templateDocuments.document, templateMetafields(kind));
  const published = parsePageDocument(raw.shop.published?.value);
  const draft = parsePageDocument(raw.shop.draft?.value);
  const previous = parsePageDocument(raw.shop.previous?.value);

  const publishedDoc = published.ok ? published.doc : null;
  const draftDoc = draft.ok ? draft.doc : (publishedDoc ?? original(kind));

  return {
    raw,
    state: {
      kind,
      shopId: raw.shop.id,
      draft: draftDoc,
      published: publishedDoc,
      canRollback: previous.ok,
      // Never published counts as "changes": the page as it is is not a stored template.
      hasUnpublishedChanges: !publishedDoc || !sameContent(draftDoc, publishedDoc),
      dropped: draft.ok ? draft.dropped : 0,
      publishedInvalid: !published.ok && published.reason === "invalid",
      hasDefinition: raw.metafieldDefinitions.nodes.length > 0,
    },
  };
}

export async function getTemplateState(kind: TemplateKind): Promise<TemplateState> {
  return (await read(kind)).state;
}

function serialize(doc: PageDocument): string {
  const json = JSON.stringify(doc);
  if (new TextEncoder().encode(json).byteLength > MAX_DOCUMENT_BYTES) {
    throw new TemplateError("TOO_LARGE", "This template has grown too large to save. Remove a few sections.");
  }
  return json;
}

async function write(kind: TemplateKind, shopId: string, copies: Partial<Record<"published" | "draft" | "previous", PageDocument>>) {
  const keys = templateMetafields(kind);
  const metafields = Object.entries(copies).map(([copy, doc]) => ({
    ownerId: shopId,
    namespace: METAFIELD_NAMESPACE,
    key: keys[copy as keyof typeof keys],
    type: "json",
    value: serialize(doc!),
  }));
  const data = await adminGraphQL<{ metafieldsSet: { userErrors: { field?: string[] | null; message: string }[] } }>(
    "templateSet",
    OPERATIONS.templateSet.document,
    { metafields },
  );
  assertNoUserErrors(data.metafieldsSet.userErrors);
}

function assertRevision(state: TemplateState, baseRevision: number) {
  if (state.draft.meta.revision !== baseRevision) {
    throw new TemplateError(
      "CONFLICT",
      `This template was saved ${state.draft.meta.savedBy ? `by ${state.draft.meta.savedBy} ` : ""}since you opened it. Reload to see the latest version.`,
    );
  }
}

/** A template's own sections belong in it and nowhere else — refused here, whatever was sent. */
function assertPlacement(kind: TemplateKind, content: DocumentContent) {
  const misplaced = misplacedSections(content.sections, kind);
  if (misplaced.length) {
    throw new TemplateError(
      "NOT_ALLOWED",
      `${misplaced.join(", ")} cannot be used on the ${TEMPLATES[kind].label.toLowerCase()} — it shows another kind of page's content.`,
    );
  }
}

/* -------------------------------------------------------------------------- *
 * Draft, publish, discard, rollback
 * -------------------------------------------------------------------------- */

export async function saveTemplateDraft(kind: TemplateKind, content: DocumentContent, baseRevision: number, actor: string) {
  assertPlacement(kind, content);
  const { state } = await read(kind);
  assertRevision(state, baseRevision);

  const next: PageDocument = {
    version: DOCUMENT_VERSION,
    page: content.page,
    sections: content.sections,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };
  await write(kind, state.shopId, { draft: next });

  return {
    revision: next.meta.revision,
    savedAt: next.meta.savedAt,
    hasUnpublishedChanges: !state.published || !sameContent(next, state.published),
  };
}

export async function publishTemplate(kind: TemplateKind, baseRevision: number, actor: string) {
  const { state } = await read(kind);
  assertRevision(state, baseRevision);
  assertPlacement(kind, state.draft);

  const problems = publishProblems(state.draft);
  if (problems.length) throw new TemplateError("NOT_READY", "Some sections are missing required content.", problems);

  // The first publish opens the copy to the storefront — a definition with PUBLIC_READ.
  if (!state.hasDefinition) {
    await ensureShopJsonDefinition({
      key: templateMetafields(kind).published,
      name: `Template — ${TEMPLATES[kind].label}`,
      description: `The layout of ${TEMPLATES[kind].path}, managed under Website → Templates in the admin panel. Do not edit by hand.`,
    });
  }

  const at = now();
  const live: PageDocument = { ...state.draft, meta: { ...state.draft.meta, publishedAt: at, publishedBy: actor } };
  const draft: PageDocument = { ...live, meta: { ...live.meta, revision: baseRevision + 1 } };
  await write(kind, state.shopId, { published: live, draft, ...(state.published ? { previous: state.published } : {}) });

  return { revision: draft.meta.revision, publishedAt: at };
}

/** The draft goes back to what is live — or, before any publish, to the page as it is. */
export async function discardTemplateDraft(kind: TemplateKind, baseRevision: number, actor: string) {
  const { state } = await read(kind);
  assertRevision(state, baseRevision);
  const base = state.published ?? original(kind);
  const next: PageDocument = { ...base, meta: { ...base.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor } };
  await write(kind, state.shopId, { draft: next });
  return { revision: next.meta.revision };
}

/** The version the last publish replaced becomes the DRAFT — live only after Publish. */
export async function rollbackTemplate(kind: TemplateKind, baseRevision: number, actor: string) {
  const { raw, state } = await read(kind);
  assertRevision(state, baseRevision);
  const previous = parsePageDocument(raw.shop.previous?.value);
  if (!previous.ok) throw new TemplateError("NOT_ALLOWED", "There is no earlier version to load.");
  const next: PageDocument = {
    ...state.draft,
    page: previous.doc.page,
    sections: previous.doc.sections,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };
  await write(kind, state.shopId, { draft: next });
  return { revision: next.meta.revision };
}

/**
 * Stops using the template: the published copy is cleared, so the pages go back to the
 * layout in the site's code. The draft and the cleared version are kept — "Load
 * previously published version" brings it back.
 */
export async function unpublishTemplate(kind: TemplateKind, baseRevision: number, actor: string) {
  const { state } = await read(kind);
  assertRevision(state, baseRevision);
  if (!state.published) throw new TemplateError("NOT_ALLOWED", "This template is not in use.");
  const keys = templateMetafields(kind);
  const draft: PageDocument = { ...state.draft, meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor } };
  await write(kind, state.shopId, { draft, previous: state.published });
  const data = await adminGraphQL<{ metafieldsDelete: { userErrors: { field?: string[] | null; message: string }[] } }>(
    "templateClear",
    OPERATIONS.templateClear.document,
    { metafields: [{ ownerId: state.shopId, namespace: METAFIELD_NAMESPACE, key: keys.published }] },
  );
  assertNoUserErrors(data.metafieldsDelete.userErrors);
  return { revision: draft.meta.revision };
}

/* -------------------------------------------------------------------------- *
 * The list
 * -------------------------------------------------------------------------- */

/** Where a template stands: the page's own layout, in use, or in use with changes waiting. */
export type TemplateStatus = "original" | "draft" | "published" | "changes";

export type TemplateRow = {
  kind: TemplateKind;
  status: TemplateStatus;
  sections: number;
  savedAt: string | null;
  savedBy: string | null;
};

export async function listTemplates(): Promise<TemplateRow[]> {
  const keys = TEMPLATE_KINDS.flatMap((kind) => {
    const fields = templateMetafields(kind);
    return [`${METAFIELD_NAMESPACE}.${fields.published}`, `${METAFIELD_NAMESPACE}.${fields.draft}`];
  });
  const data = await adminGraphQL<{ shop: { metafields: { nodes: { key: string; value: string }[] } } }>(
    "templateList",
    OPERATIONS.templateList.document,
    { keys },
  );
  const values = new Map(data.shop.metafields.nodes.map((node) => [node.key, node.value]));

  return TEMPLATE_KINDS.map((kind) => {
    const fields = templateMetafields(kind);
    const live = parsePageDocument(values.get(fields.published));
    const draft = parsePageDocument(values.get(fields.draft));
    const liveDoc = live.ok ? live.doc : null;
    const draftDoc = draft.ok ? draft.doc : liveDoc;

    const status: TemplateStatus = liveDoc
      ? draftDoc && !sameContent(draftDoc, liveDoc)
        ? "changes"
        : "published"
      : draftDoc
        ? "draft"
        : "original";

    return {
      kind,
      status,
      sections: (draftDoc ?? original(kind)).sections.length,
      savedAt: draftDoc?.meta.savedAt ?? null,
      savedBy: draftDoc?.meta.savedBy ?? null,
    };
  });
}
