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
  /** Narrows to what a given field will accept. */
  kind: z.enum(["image", "video", "any"]).optional(),
});

const MAX_BODY_BYTES = 8 * 1024;

type RawFile = Parameters<typeof normalizeFile>[0];

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "files.list", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "files.list");
  if (!parsed.ok) return parsed.response;

  const { first = 50, after = null, search, kind = "any" } = parsed.data;

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
  if (kind === "image") clauses.push("media_type:IMAGE");
  if (kind === "video") clauses.push("media_type:VIDEO");

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
