import "server-only";

import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";
import {
  defaultLayoutContent,
  EMPTY_META,
  MAX_THEME_BYTES,
  parseThemeLayout,
  sameThemeContent,
  THEME_LAYOUT_VERSION,
  type ThemeLayout,
  type ThemeLayoutContent,
} from "@/lib/theme-builder/layout";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * The Theme Builder's server half — the header and footer layout's three copies on the
 * shop, and the four things that change them. The same contract as the page builder
 * (`lib/admin/page-builder.ts`):
 *
 *  - every write is ONE `metafieldsSet`, all or nothing;
 *  - a save names the draft revision it was made from, and is refused as a CONFLICT
 *    when the stored draft has moved on (a second tab, a colleague);
 *  - only Publish changes what visitors see, and the copy it replaces is kept for a
 *    one-step rollback.
 *
 * Until the first publish, `published` is null and the storefront draws its original
 * header and footer; the editor opens on `DEFAULT_LAYOUT`, which reproduces them.
 */

export const THEME_METAFIELDS = {
  published: "theme_layout",
  draft: "theme_layout_draft",
  previous: "theme_layout_previous",
} as const;

export type ThemeErrorCode = "CONFLICT" | "TOO_LARGE" | "NOT_READY";

export class ThemeBuilderError extends Error {
  readonly code: ThemeErrorCode;
  constructor(code: ThemeErrorCode, message: string) {
    super(message);
    this.name = "ThemeBuilderError";
    this.code = code;
  }
}

export type ThemeState = {
  shopId: string;
  /** What the editor opens: the draft, else the published copy, else the original. */
  draft: ThemeLayout;
  /** null until the first publish — the storefront shows its original header and footer. */
  published: ThemeLayout | null;
  canRollback: boolean;
  hasUnpublishedChanges: boolean;
  /** The live copy exists but cannot be read; the storefront falls back to the original. */
  publishedInvalid: boolean;
};

type Raw = {
  shop: {
    id: string;
    published: { value: string } | null;
    draft: { value: string } | null;
    previous: { value: string } | null;
  };
};

const now = () => new Date().toISOString();

export async function getThemeState(): Promise<ThemeState> {
  const data = await adminGraphQL<Raw>("themeLayout", OPERATIONS.themeLayout.document, {});
  const published = parseThemeLayout(data.shop.published?.value);
  const draft = parseThemeLayout(data.shop.draft?.value);
  const previous = parseThemeLayout(data.shop.previous?.value);

  const publishedLayout = published.ok ? published.layout : null;
  const draftLayout: ThemeLayout = draft.ok
    ? draft.layout
    : (publishedLayout ?? { version: THEME_LAYOUT_VERSION, ...defaultLayoutContent(), meta: EMPTY_META });

  return {
    shopId: data.shop.id,
    draft: draftLayout,
    published: publishedLayout,
    canRollback: previous.ok,
    // Never published counts as "changes": the original is not a stored layout.
    hasUnpublishedChanges: !publishedLayout || !sameThemeContent(draftLayout, publishedLayout),
    publishedInvalid: !published.ok && published.reason === "invalid",
  };
}

function serialize(layout: ThemeLayout): string {
  const json = JSON.stringify(layout);
  if (new TextEncoder().encode(json).byteLength > MAX_THEME_BYTES) {
    throw new ThemeBuilderError("TOO_LARGE", "The header and footer have grown too large to save. Remove a few elements.");
  }
  return json;
}

async function write(shopId: string, copies: Partial<Record<keyof typeof THEME_METAFIELDS, ThemeLayout>>) {
  const metafields = Object.entries(copies).map(([copy, layout]) => ({
    ownerId: shopId,
    namespace: METAFIELD_NAMESPACE,
    key: THEME_METAFIELDS[copy as keyof typeof THEME_METAFIELDS],
    type: "json",
    value: serialize(layout!),
  }));
  const data = await adminGraphQL<{
    metafieldsSet: { userErrors: { field?: string[] | null; message: string }[] };
  }>("themeLayoutSet", OPERATIONS.themeLayoutSet.document, { metafields });
  assertNoUserErrors(data.metafieldsSet.userErrors);
}

function assertRevision(state: ThemeState, baseRevision: number) {
  if (state.draft.meta.revision !== baseRevision) {
    throw new ThemeBuilderError(
      "CONFLICT",
      `The header and footer were saved ${state.draft.meta.savedBy ? `by ${state.draft.meta.savedBy} ` : ""}since you opened them. Reload to see the latest version.`,
    );
  }
}

/** Autosave. The content was validated by the route; only the draft changes. */
export async function saveThemeDraft(content: ThemeLayoutContent, baseRevision: number, actor: string) {
  const state = await getThemeState();
  assertRevision(state, baseRevision);
  const next: ThemeLayout = {
    version: THEME_LAYOUT_VERSION,
    ...content,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };
  await write(state.shopId, { draft: next });
  return { revision: next.meta.revision, savedAt: next.meta.savedAt };
}

/** The draft goes live; what it replaces is kept for rollback. */
export async function publishTheme(baseRevision: number, actor: string) {
  const state = await getThemeState();
  assertRevision(state, baseRevision);
  const at = now();
  const live: ThemeLayout = { ...state.draft, meta: { ...state.draft.meta, publishedAt: at, publishedBy: actor } };
  const draft: ThemeLayout = { ...live, meta: { ...live.meta, revision: baseRevision + 1 } };
  await write(state.shopId, {
    published: live,
    draft,
    ...(state.published ? { previous: state.published } : {}),
  });
  return { revision: draft.meta.revision, publishedAt: at };
}

/** The draft goes back to what is live (or to the original, before any publish). */
export async function discardThemeDraft(baseRevision: number, actor: string) {
  const state = await getThemeState();
  assertRevision(state, baseRevision);
  const base = state.published ?? { version: THEME_LAYOUT_VERSION, ...defaultLayoutContent(), meta: EMPTY_META };
  const next: ThemeLayout = { ...base, meta: { ...base.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor } };
  await write(state.shopId, { draft: next });
  return { revision: next.meta.revision };
}

/** The version the last publish replaced becomes the DRAFT — live only after Publish. */
export async function rollbackTheme(baseRevision: number, actor: string) {
  const data = await adminGraphQL<Raw>("themeLayout", OPERATIONS.themeLayout.document, {});
  const previous = parseThemeLayout(data.shop.previous?.value);
  if (!previous.ok) throw new ThemeBuilderError("NOT_READY", "There is no earlier version to go back to.");
  const state = await getThemeState();
  assertRevision(state, baseRevision);
  const next: ThemeLayout = {
    ...previous.layout,
    meta: { ...state.draft.meta, revision: baseRevision + 1, savedAt: now(), savedBy: actor },
  };
  await write(state.shopId, { draft: next });
  return { revision: next.meta.revision };
}
