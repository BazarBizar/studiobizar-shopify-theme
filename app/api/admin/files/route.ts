import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { normalizeFile, sanitizeFileSearch } from "@/lib/admin/media";
import { OPERATIONS } from "@/lib/admin/operations";
import { adminGraphQL } from "@/lib/admin/shopify";

/**
 * READ endpoint backing the media picker. Operation name plus parameters, like every
 * other admin endpoint — the document comes from the allowlist, never the client.
 */

const schema = z.object({
  operation: z.literal("files"),
  first: z.number().int().min(1).max(100).optional(),
  after: z.string().max(4096).nullable().optional(),
  /** Free-text search. Sanitised, never quoted — see below. */
  search: z.string().max(128).nullable().optional(),
  /** Narrows to what a given field will accept, or what the library filter asks for. */
  kind: z.enum(["image", "video", "model3d", "file", "any"]).optional(),
  sort: z.enum(["newest", "oldest", "largest", "smallest", "name"]).optional(),
});

/**
 * Every sort here is one Shopify performs, so it orders the WHOLE library, not the
 * page already loaded. Resolution is missing on purpose: `FileSortKeys` has no key
 * for it, and the library sorts loaded rows for that instead.
 */
const SORTS = {
  newest: { sortKey: "CREATED_AT", reverse: true },
  oldest: { sortKey: "CREATED_AT", reverse: false },
  largest: { sortKey: "ORIGINAL_UPLOAD_SIZE", reverse: true },
  smallest: { sortKey: "ORIGINAL_UPLOAD_SIZE", reverse: false },
  name: { sortKey: "FILENAME", reverse: false },
} as const;

/**
 * Shopify's documented `media_type` values. Note `MODEL3D`, with no underscore —
 * unlike the `MODEL_3D` of `MediaContentType`. An unknown value is not an error; it
 * silently matches nothing, which is why these are spelled out rather than derived.
 */
const MEDIA_TYPES = {
  image: "IMAGE",
  video: "VIDEO",
  model3d: "MODEL3D",
  file: "GENERIC_FILE",
} as const;

const MAX_BODY_BYTES = 8 * 1024;

type RawFile = Parameters<typeof normalizeFile>[0];

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "files.list", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "files.list");
  if (!parsed.ok) return parsed.response;

  const { first = 50, after = null, search, kind = "any", sort = "newest" } = parsed.data;

  /**
   * Built here rather than accepted from the client, so a caller cannot inject Shopify
   * query syntax.
   *
   * THE TERM IS NOT QUOTED. Shopify's file search inverts the usual advice, and this
   * was measured against this store: `query: "seagrass"` returns 5 files, while
   * `query: "\"seagrass\""` returns 0. Wrapping the term for safety would therefore
   * make search silently find nothing. `sanitizeFileSearch` strips the characters that
   * carry query meaning instead, so `a" OR id:*` cannot become an expression.
   */
  const clauses: string[] = [];
  if (kind !== "any") clauses.push(`media_type:${MEDIA_TYPES[kind]}`);

  const term = search ? sanitizeFileSearch(search) : null;
  if (term) clauses.push(term);

  try {
    const data = await adminGraphQL<{
      files: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawFile[];
      };
    }>("files", OPERATIONS.files.document, {
      first,
      after,
      query: clauses.length ? clauses.join(" AND ") : null,
      ...SORTS[sort],
    });

    return NextResponse.json({
      hasNextPage: data.files.pageInfo.hasNextPage,
      endCursor: data.files.pageInfo.endCursor,
      files: data.files.nodes.map(normalizeFile),
    });
  } catch (error) {
    return failure("files.list", error);
  }
}
