import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, failure, guard, readJson, validate } from "@/lib/admin/api";
import { buildProductQuery, countProducts, listProducts } from "@/lib/admin/products";

/**
 * The catalogue list — the one server-driven table in the panel.
 *
 * The client sends FILTER STATE, never a Shopify query string: `buildProductQuery`
 * assembles that on this side, so no caller can inject query syntax.
 */
const schema = z.strictObject({
  operation: z.literal("products"),
  first: z.number().int().min(1).max(100).optional(),
  after: z.string().max(4096).nullable().optional(),
  search: z.string().max(128).nullable().optional(),
  status: z.array(z.enum(["ACTIVE", "DRAFT", "ARCHIVED"])).max(3).optional(),
  vendors: z.array(z.string().max(255)).max(50).optional(),
  productTypes: z.array(z.string().max(255)).max(100).optional(),
  updatedFrom: z.string().max(40).nullable().optional(),
  updatedTo: z.string().max(40).nullable().optional(),
  sortKey: z
    .enum(["UPDATED_AT", "CREATED_AT", "TITLE", "VENDOR", "PRODUCT_TYPE", "INVENTORY_TOTAL"])
    .optional(),
  reverse: z.boolean().optional(),
  /** Only the first page needs the count; later pages reuse it. */
  withCount: z.boolean().optional(),
});

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "product.list", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const body = await readJson(request, 16 * 1024);
  if (!body.ok) return fail(body.code, "Send a JSON body.");

  const parsed = validate(schema, body.value, "product.list");
  if (!parsed.ok) return parsed.response;

  const { first = 50, after = null, sortKey = "UPDATED_AT", reverse = true, withCount } = parsed.data;
  const query = buildProductQuery(parsed.data);

  try {
    const [page, total] = await Promise.all([
      listProducts({ first, after, query, sortKey, reverse }),
      // Counted for the same filter, so the summary is the collection and not the scroll
      // position. Skipped on subsequent pages, where it cannot have changed.
      withCount ? countProducts(query) : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...page, total });
  } catch (error) {
    return failure("product.list", error);
  }
}
