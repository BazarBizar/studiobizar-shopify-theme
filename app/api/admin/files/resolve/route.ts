import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { resolveFiles } from "@/lib/admin/media";

/**
 * Turns a batch of file gids into previews — ONE request for a whole form.
 *
 * A form can carry a dozen media fields; resolving each from its own component would
 * mean a dozen round trips on mount, all of them to the same endpoint, for data one
 * query returns.
 */

const schema = z.object({
  operation: z.literal("nodes"),
  ids: z
    .array(z.string().regex(/^gid:\/\/shopify\/\w+\/\d+$/, "not a Shopify gid"))
    .min(1)
    .max(250),
});

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "files.resolve", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "files.resolve");
  if (!parsed.ok) return parsed.response;

  try {
    // Keyed by id so a caller can look up exactly what it asked for; a gid that
    // resolves to nothing is simply absent rather than shifting the array.
    const files = await resolveFiles(parsed.data.ids);
    return NextResponse.json({ files });
  } catch (error) {
    return failure("files.resolve", error);
  }
}
