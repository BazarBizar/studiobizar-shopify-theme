import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
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
  /** Free-text search, passed to Shopify's own file query syntax. */
  search: z.string().max(128).nullable().optional(),
  /** Narrows to what a given field will accept. */
  kind: z.enum(["image", "video", "any"]).optional(),
});

const MAX_BODY_BYTES = 8 * 1024;

type RawFile = {
  __typename: string;
  id: string;
  alt?: string | null;
  createdAt?: string;
  url?: string | null;
  mimeType?: string | null;
  image?: { url: string; altText: string | null; width: number | null; height: number | null } | null;
  preview?: { image: { url: string } | null } | null;
};

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "files.list", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "files.list");
  if (!parsed.ok) return parsed.response;

  const { first = 50, after = null, search, kind = "any" } = parsed.data;

  /**
   * Built here rather than accepted from the client, so a caller cannot inject
   * arbitrary Shopify query syntax. `media_type` is Shopify's own filter; the
   * free-text part is quoted so a search containing a colon cannot become a filter
   * clause of its own.
   */
  const clauses: string[] = [];
  if (kind === "image") clauses.push("media_type:IMAGE");
  if (kind === "video") clauses.push("media_type:VIDEO");
  if (search?.trim()) clauses.push(`"${search.trim().replace(/"/g, "")}"`);

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
      files: data.files.nodes.map((file) => ({
        id: file.id,
        kind: file.__typename,
        alt: file.alt ?? file.image?.altText ?? null,
        // A Video has no `image`, only a poster frame under `preview`.
        thumbnail: file.image?.url ?? file.preview?.image?.url ?? null,
        mimeType: file.mimeType ?? null,
        width: file.image?.width ?? null,
        height: file.image?.height ?? null,
      })),
    });
  } catch (error) {
    return failure("files.list", error);
  }
}
