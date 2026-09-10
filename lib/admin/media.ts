import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Shopify Files — the panel's media layer.
 *
 * THE BYTES GO THROUGH THIS SERVER. The browser POSTs a file to the panel's own API,
 * which relays it to Shopify's signed target. Uploading straight from the browser
 * would mean whitelisting Shopify's storage host in the page CSP — the admin policy is
 * `connect-src 'self'` precisely so a successful injection has nowhere to send what it
 * steals — and it would hand a signed upload target to client code.
 *
 * The flow is Shopify's three steps: `stagedUploadsCreate` for a signed target, a POST
 * of the bytes to it, then `fileCreate` to register the result.
 */

/** Per §5.2. MOV reports itself as `video/quicktime`, never `video/mov`. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
] as const;

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

export type UploadKind = "IMAGE" | "VIDEO" | "FILE";

/** Shopify's `resource` and `contentType` both derive from the MIME type. */
export function kindForMime(mime: string): UploadKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "FILE";
}

export type MimeCheck =
  | { ok: true; kind: UploadKind; limit: number }
  /** `reason` distinguishes the two failures so the caller can pick the right status:
   *  a rejected type is a bad request, an oversized file is 413. */
  | { ok: false; kind: "type" | "size"; reason: string };

/**
 * Enforced on the SERVER. An `accept` attribute on the input is a hint to a file
 * picker, not a rule — a direct POST ignores it entirely.
 */
export function checkUpload(mime: string, size: number): MimeCheck {
  const isImage = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mime);
  const isVideo = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(mime);

  if (!isImage && !isVideo) {
    return { ok: false, kind: "type", reason: `${mime || "That file type"} is not accepted.` };
  }

  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size > limit) {
    return {
      ok: false,
      kind: "size",
      reason: `That file is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is ${limit / 1024 / 1024} MB.`,
    };
  }

  return { ok: true, kind: kindForMime(mime), limit };
}

/**
 * SEARCH TERMS ARE SANITISED, NOT QUOTED — and that is the opposite of what the
 * metaobject search needs.
 *
 * Verified against this store: `files(query: "seagrass")` returns matches, and
 * `files(query: "\"seagrass\"")` returns zero. So a term cannot be wrapped for safety;
 * instead every character that carries query syntax is removed, which is what stops a
 * term like `a" OR id:*` from being read as an expression.
 */
export function sanitizeFileSearch(term: string): string | null {
  const cleaned = term
    .replace(/["':()\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

export type MediaFile = {
  id: string;
  kind: string;
  alt: string | null;
  thumbnail: string | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  /** `READY`, `PROCESSING`, `FAILED`, `UPLOADED`. */
  status: string | null;
};

type RawFile = {
  __typename: string;
  id: string;
  alt?: string | null;
  fileStatus?: string | null;
  url?: string | null;
  mimeType?: string | null;
  image?: { url: string; width: number | null; height: number | null } | null;
  preview?: { image: { url: string } | null } | null;
};

export function normalizeFile(raw: RawFile): MediaFile {
  return {
    id: raw.id,
    kind: raw.__typename,
    alt: raw.alt ?? null,
    // A Video has no `image`, only a poster frame under `preview`.
    thumbnail: raw.image?.url ?? raw.preview?.image?.url ?? null,
    url: raw.url ?? raw.image?.url ?? null,
    mimeType: raw.mimeType ?? null,
    width: raw.image?.width ?? null,
    height: raw.image?.height ?? null,
    status: raw.fileStatus ?? null,
  };
}

/** Resolves many gids at once, for a form full of media fields. */
export async function resolveFiles(ids: string[]): Promise<MediaFile[]> {
  if (ids.length === 0) return [];

  const data = await adminGraphQL<{ nodes: (RawFile | null)[] }>(
    "nodes",
    OPERATIONS.nodes.document,
    { ids: ids.slice(0, 250) },
  );

  return data.nodes.filter((node): node is RawFile => Boolean(node?.id)).map(normalizeFile);
}

export type UploadResult = { file: MediaFile; processing: boolean };

/**
 * The full three-step upload. `bytes` has already been read and size-checked by the
 * route handler.
 */
export async function uploadFile({
  bytes,
  filename,
  mimeType,
  alt,
}: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  alt?: string | null;
}): Promise<UploadResult> {
  const kind = kindForMime(mimeType);

  const staged = await adminGraphQL<{
    stagedUploadsCreate: {
      stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[];
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("stagedUploadsCreate", OPERATIONS.stagedUploadsCreate.document, {
    input: [
      {
        filename,
        mimeType,
        resource: kind,
        httpMethod: "POST",
        fileSize: String(bytes.byteLength),
      },
    ],
  });

  assertNoUserErrors(staged.stagedUploadsCreate.userErrors);

  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error("Shopify returned no upload target.");

  // Shopify's parameters must be appended BEFORE the file part; the storage backend
  // reads the policy fields in order and rejects the request if `file` comes first.
  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append("file", new Blob([bytes as BlobPart], { type: mimeType }), filename);

  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok) {
    throw new Error(`Upload target rejected the file (${upload.status}).`);
  }

  const created = await adminGraphQL<{
    fileCreate: { files: RawFile[]; userErrors: { field?: string[] | null; message: string }[] };
  }>("fileCreate", OPERATIONS.fileCreate.document, {
    files: [
      {
        originalSource: target.resourceUrl,
        contentType: kind,
        ...(alt ? { alt } : {}),
      },
    ],
  });

  assertNoUserErrors(created.fileCreate.userErrors);

  const file = created.fileCreate.files[0];
  if (!file) throw new Error("Shopify registered no file.");

  const normalized = normalizeFile(file);

  return {
    file: normalized,
    // A freshly created file is usually still processing, so it has no preview yet.
    // The caller says so rather than showing a broken thumbnail.
    processing: normalized.status !== "READY",
  };
}

/** Alt text is the only property of a file the panel may change. */
export async function setFileAlt(id: string, alt: string): Promise<void> {
  const data = await adminGraphQL<{
    fileUpdate: { files: { id: string }[]; userErrors: { field?: string[] | null; message: string }[] };
  }>("fileUpdate", OPERATIONS.fileUpdate.document, { files: [{ id, alt }] });

  assertNoUserErrors(data.fileUpdate.userErrors);
}
