import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { listCollectionProducts } from "@/lib/admin/collections";

/** Cursor paging for the read-only membership list on a collection. */
const schema = z.object({
  operation: z.literal("collectionProducts"),
  id: z.string().regex(/^gid:\/\/shopify\/Collection\/\d+$/, "not a collection id"),
  after: z.string().max(4096).nullable().optional(),
  first: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "collection.products", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, 8 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "collection.products");
  if (!parsed.ok) return parsed.response;

  try {
    const page = await listCollectionProducts(parsed.data.id, {
      first: parsed.data.first ?? 24,
      after: parsed.data.after ?? null,
    });
    return NextResponse.json(page);
  } catch (error) {
    return failure("collection.products", error);
  }
}
