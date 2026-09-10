"use client";

import { useQuery } from "@tanstack/react-query";

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
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

export type PickerEntry = {
  id: string;
  handle: string;
  label: string;
  thumbnail: string | null;
};

type ApiError = { code?: string; message?: string };

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
    const detail = (await response.json().catch(() => null)) as ApiError | null;
    // The server has already stripped anything sensitive; this is the safe message.
    throw new Error(detail?.message ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export function useFiles({
  kind,
  search,
  enabled,
}: {
  kind: "image" | "video" | "any";
  search: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["admin", "files", kind, search],
    enabled,
    queryFn: () =>
      post<{ files: PickerFile[]; hasNextPage: boolean; endCursor: string | null }>(
        "/api/admin/files",
        { operation: "files", first: 60, kind, search: search || null },
      ),
  });
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
