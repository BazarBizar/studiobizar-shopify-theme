import { NextResponse } from "next/server";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { listEntries, NotAllowedError } from "@/lib/admin/metaobjects";
import { z } from "zod";

/**
 * READ endpoint, for the reference pickers in the entry form.
 *
 * The client sends an operation NAME plus parameters — never a GraphQL document
 * (§4.4). The only operation this route will run is `metaobjects`, and the data
 * layer still checks the requested type against the live allowlist, so naming a
 * type that does not exist answers NOT_ALLOWED rather than leaking whether it
 * exists.
 */

const schema = z.object({
  operation: z.literal("metaobjects"),
  type: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_-]*$/),
  first: z.number().int().min(1).max(250).optional(),
  after: z.string().max(4096).nullable().optional(),
  query: z.string().max(256).nullable().optional(),
});

/** A picker sends a type and a cursor; nothing here needs a large body. */
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "metaobject.list", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "metaobject.list");
  if (!parsed.ok) return parsed.response;

  try {
    const page = await listEntries({
      type: parsed.data.type,
      first: parsed.data.first ?? 100,
      after: parsed.data.after ?? null,
      query: parsed.data.query ?? null,
    });

    // Trimmed to what a picker renders. The full field payload of every candidate
    // would be a large response for a dropdown, and most of it is unused.
    return NextResponse.json({
      hasNextPage: page.hasNextPage,
      endCursor: page.endCursor,
      entries: page.entries.map((entry) => ({
        id: entry.id,
        handle: entry.handle,
        label: entry.displayName || entry.handle,
        thumbnail:
          entry.fields.find((field) => field.reference?.image?.url)?.reference?.image?.url ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof NotAllowedError) return fail("NOT_ALLOWED", error.message);
    return failure("metaobject.list", error);
  }
}
