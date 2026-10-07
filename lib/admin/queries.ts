"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

/**
 * Client hooks for the admin read endpoints.
 *
 * Every request names an OPERATION and passes parameters — never a GraphQL
 * document. The server maps the name to a document from the allowlist in
 * `lib/admin/operations.ts`. Nothing here can widen what the panel is able to ask
 * Shopify for.
 *
 * `"use client"` and no `server-only`: this is the browser half. It holds no
 * credentials — the session cookie travels automatically and the Admin API token
 * never leaves the server.
 */

export type PickerFile = {
  id: string;
  kind: string;
  alt: string | null;
  thumbnail: string | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  /** `READY` once Shopify has finished processing; anything else has no preview yet. */
  status: string | null;
  /** Filled by the listing only — a resolved or freshly uploaded file leaves these null. */
  filename: string | null;
  /** Original upload size in bytes. */
  size: number | null;
  /** Seconds, videos only. */
  duration: number | null;
  createdAt: string | null;
};

export type FileKind = "image" | "video" | "model3d" | "file" | "any";

/** Every value is a sort Shopify performs across the whole library — see the files route. */
export type FileSort = "newest" | "oldest" | "largest" | "smallest" | "name";

export type PickerEntry = {
  id: string;
  handle: string;
  label: string;
  thumbnail: string | null;
};

type ApiError = { code?: string; message?: string };

/**
 * A failed request, with the server's code and body kept for callers that act on
 * them — the page builder tells a conflict from a publish blocked by empty
 * fields. Still an `Error`, so every existing `catch` reads `.message` as before.
 */
export class RequestError extends Error {
  readonly code: string | null;
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(message: string, status: number, detail: Record<string, unknown> | null) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = typeof detail?.code === "string" ? detail.code : null;
    this.detail = detail ?? {};
  }
}

/**
 * `same-origin` is explicit rather than relied upon: the write endpoints reject a
 * cross-origin request outright, and a read that quietly sent credentials
 * elsewhere would be the one place that behaved differently.
 */
async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as (ApiError & Record<string, unknown>) | null;
    // The server has already stripped anything sensitive; this is the safe message.
    throw new RequestError(detail?.message ?? `Request failed (${response.status})`, response.status, detail);
  }

  return (await response.json()) as T;
}

type FilePage = { files: PickerFile[]; hasNextPage: boolean; endCursor: string | null };

/**
 * Paged file listing for the media picker.
 *
 * Infinite rather than a single page because this store holds over five thousand
 * images: any fixed `first` is either too small to browse or too large to load.
 */
export function useFiles({
  kind,
  search,
  sort = "newest",
  enabled,
}: {
  kind: FileKind;
  search: string;
  sort?: FileSort;
  enabled: boolean;
}) {
  return useInfiniteQuery({
    queryKey: ["admin", "files", kind, search, sort],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      post<FilePage>("/api/admin/files", {
        operation: "files",
        first: 50,
        after: pageParam,
        kind,
        sort,
        search: search || null,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.endCursor : undefined),
  });
}

/** Resolves stored gids to previews — one request for every field on a form. */
export function useResolvedFiles(ids: string[], enabled = true) {
  const key = [...ids].sort().join(",");

  return useQuery({
    queryKey: ["admin", "files", "resolve", key],
    enabled: enabled && ids.length > 0,
    queryFn: () => post<{ files: PickerFile[] }>("/api/admin/files/resolve", {
      operation: "nodes",
      ids,
    }),
  });
}

export type UploadedFile = { file: PickerFile; processing: boolean };

/**
 * Uploads through the panel's own API, never straight to Shopify — see the note in
 * `lib/admin/media.ts`. `FormData` here, so no `Content-Type` is set by hand: the
 * browser has to generate the multipart boundary itself.
 */
export async function uploadFileRequest(file: File, alt?: string): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  if (alt) form.append("alt", alt);

  const response = await fetch("/api/admin/files/upload", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(detail?.message ?? `Upload failed (${response.status})`);
  }

  return (await response.json()) as UploadedFile;
}

export function useMetaobjectOptions({
  type,
  enabled,
}: {
  type: string | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["admin", "metaobjects", type],
    enabled: enabled && Boolean(type),
    queryFn: () =>
      post<{ entries: PickerEntry[]; hasNextPage: boolean; endCursor: string | null }>(
        "/api/admin/metaobjects",
        { operation: "metaobjects", type, first: 250 },
      ),
  });
}

export type WriteResult = { id: string; handle: string; type: string };

export async function createEntryRequest(input: {
  type: string;
  fields: { key: string; value: string }[];
}): Promise<WriteResult> {
  return post<WriteResult>("/api/admin/metaobjects/create", {
    operation: "metaobjectCreate",
    ...input,
  });
}

export async function updateEntryRequest(input: {
  id: string;
  fields: { key: string; value: string }[];
}): Promise<WriteResult> {
  return post<WriteResult>("/api/admin/metaobjects/update", {
    operation: "metaobjectUpdate",
    ...input,
  });
}

/**
 * IRREVERSIBLE. Every caller must confirm with the operator first — see
 * `EntryRowActions`, which is the only one today.
 *
 * Only an id crosses the wire. Whether this type may be deleted at all is decided by
 * `assertDeletable` on the server, from the type it reads out of the store.
 */
export async function deleteEntryRequest(input: { id: string }): Promise<WriteResult> {
  return post<WriteResult>("/api/admin/metaobjects/delete", {
    operation: "metaobjectDelete",
    ...input,
  });
}

export type PageWriteResult = { id: string; title: string; handle: string; updatedAt: string };

/**
 * EDIT ONLY. There is no createPageRequest or deletePageRequest, and neither
 * `pageCreate` nor `pageDelete` is in the operation allowlist — pages and their
 * template suffixes are owned by `schema-push`, which is what decides that a
 * handle has a storefront route at all.
 *
 * `clearMetafields` carries the keys the operator emptied. A cleared metafield is
 * DELETED rather than set to "", because an empty value still reads as present to
 * every storefront check that guards a section on it.
 */
export async function updatePageRequest(input: {
  id: string;
  title?: string;
  handle?: string;
  body?: string;
  isPublished?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  metafields?: { key: string; type: string; value: string }[];
  clearMetafields?: string[];
}): Promise<PageWriteResult> {
  return post<PageWriteResult>("/api/admin/pages/update", {
    operation: "pageUpdate",
    ...input,
  });
}

export type MenuItemPayload = {
  id?: string;
  title: string;
  type: string;
  url?: string | null;
  resourceId?: string | null;
  items?: Omit<MenuItemPayload, "items">[];
};

export type MenuWriteResult = { id: string; handle: string; title: string };

/**
 * EDIT ONLY, and it sends the WHOLE tree.
 *
 * `menuUpdate` replaces rather than patches, so an item missing from `items` is
 * deleted. The editor therefore holds the complete list and posts all of it; the
 * route refuses an empty one, which is what stops a truncated payload from
 * quietly emptying the site's navigation.
 */
export async function updateMenuRequest(input: {
  id: string;
  title: string;
  handle: string;
  items: MenuItemPayload[];
}): Promise<MenuWriteResult> {
  return post<MenuWriteResult>("/api/admin/menus/update", {
    operation: "menuUpdate",
    ...input,
  });
}

/**
 * Alt text on an existing file — the one property of a file the panel may change.
 *
 * There is no delete counterpart and will not be one: `fileDelete` is absent from
 * the operation allowlist because Shopify removes a file without checking what
 * references it, which would silently empty every product, metaobject and page
 * metafield pointing at it.
 */
export async function setFileAltRequest(input: {
  id: string;
  alt: string;
}): Promise<{ id: string; alt: string }> {
  return post<{ id: string; alt: string }>("/api/admin/files/alt", {
    operation: "fileAlt",
    ...input,
  });
}

/* -------------------------------------------------------------------------- *
 * Page builder
 * -------------------------------------------------------------------------- */

export type CreatedPage = { id: string; title: string; handle: string };

/** From a template, or as a copy of another builder page (`duplicateOf`). */
export async function createBuilderPageRequest(
  input: { title: string; handle: string } & ({ template: string } | { duplicateOf: string }),
): Promise<CreatedPage> {
  return post<CreatedPage>("/api/admin/pages/create", { operation: "pageCreate", ...input });
}

export async function deletePageRequest(id: string): Promise<{ id: string; handle: string }> {
  return post("/api/admin/pages/delete", { operation: "pageDelete", id });
}

export type BuilderSaveResult = { revision: number; savedAt: string; hasUnpublishedChanges: boolean };

/** The draft content goes in whole; the server validates every section against the registry. */
export async function saveDraftRequest(input: {
  id: string;
  baseRevision: number;
  content: unknown;
}): Promise<BuilderSaveResult> {
  return post<BuilderSaveResult>("/api/admin/pages/builder", { operation: "builderSaveDraft", ...input });
}

/** The draft revision a page is at now — see `/api/admin/pages/revision`. */
export async function draftRevisionRequest(id: string): Promise<{ revision: number }> {
  return post<{ revision: number }>("/api/admin/pages/revision", { id });
}

/** MVP-2: a hand-built page's first builder draft, from its current content. */
export async function convertToBuilderRequest(id: string): Promise<{ revision: number }> {
  return post<{ revision: number }>("/api/admin/pages/builder", { operation: "builderConvert", id });
}

export async function builderActionRequest(
  operation: "builderPublish" | "builderDiscard" | "builderRollback",
  input: { id: string; baseRevision: number },
): Promise<{ revision: number }> {
  return post<{ revision: number }>("/api/admin/pages/builder", { operation, ...input });
}

export type ProductOption = { id: string; title: string; handle: string; thumbnail: string | null };

/**
 * Active products matching a search, for the builder's product picker. The same
 * list endpoint the Products screen uses — no new route, no new query.
 */
export function useProductSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "product-search", search],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const page = await post<{ products: ProductOption[] }>("/api/admin/products", {
        operation: "products",
        first: 20,
        search: search || null,
        status: ["ACTIVE"],
        sortKey: "TITLE",
        reverse: false,
      });
      return page.products.map(({ id, title, handle, thumbnail }) => ({ id, title, handle, thumbnail }));
    },
  });
}
