import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { BuilderError, getBuilderState } from "@/lib/admin/page-builder";
import { PageNotFoundError } from "@/lib/admin/pages";

/**
 * The draft revision a page is at NOW — read by the builder when it opens.
 *
 * Why it is needed: Back and Forward restore a screen from the browser's router
 * cache, rendered when it was last visited. An editor opened that way starts from
 * an old revision, and its first save is refused as a conflict that nobody
 * caused. Asking once on open, and reloading when the answer is newer, keeps the
 * editor on the version that is really there.
 */
const schema = z.strictObject({ id: z.string().regex(/^gid:\/\/shopify\/Page\/\d+$/, "not a page id") });

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "page.builder.revision", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "page.builder.revision");
  if (!parsed.ok) return parsed.response;

  try {
    const state = await getBuilderState(parsed.data.id);
    return NextResponse.json({ revision: state.draft.meta.revision });
  } catch (error) {
    if (error instanceof PageNotFoundError) return fail("BAD_REQUEST", "That page no longer exists.");
    if (error instanceof BuilderError) return fail("NOT_ALLOWED", error.message);
    return failure("page.builder.revision", error);
  }
}
