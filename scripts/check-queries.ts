/**
 * Runs every Storefront query against the live API and reports what came back.
 * GraphQL fragment errors are invisible until execution, so this is the only
 * way to know the data layer actually works.
 *
 *   npx tsx scripts/check-queries.ts
 */

import { readFileSync } from "node:fs";

import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery,
} from "../lib/shopify/queries/collection";
import { getMenuQuery, getPageQuery, getShopQuery } from "../lib/shopify/queries/content";
import { getMetaobjectsQuery } from "../lib/shopify/queries/metaobject";
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductTypesQuery,
  getProductsQuery,
} from "../lib/shopify/queries/product";
import { predictiveSearchQuery, searchProductsQuery } from "../lib/shopify/queries/search";
import { cdnImage, normalizeProduct } from "../lib/shopify/transforms";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

const url = `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

async function run(name: string, query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
    console.log(`✕ ${name}`);
    for (const error of body.errors) console.log(`    ${error.message}`);
    return { ok: false, data: undefined };
  }

  const summary = JSON.stringify(body.data ?? {});
  console.log(`✓ ${name.padEnd(28)} ${summary.length.toLocaleString()} bytes`);
  return { ok: true, data: body.data };
}

async function main() {
  const results: boolean[] = [];

  const products = await run("getProducts", getProductsQuery, {
    first: 3,
    sortKey: "TITLE",
    reverse: false,
  });
  results.push(products.ok);

  const firstHandle =
    (products.data?.products as { nodes: { handle: string }[] } | undefined)?.nodes?.[0]?.handle ??
    "the-caviar-spoon-natural";

  results.push((await run("getProduct", getProductQuery, { handle: firstHandle })).ok);
  results.push(
    (
      await run("getProductRecommendations", getProductRecommendationsQuery, {
        productHandle: firstHandle,
      })
    ).ok,
  );
  results.push((await run("getProductTypes", getProductTypesQuery, { first: 10 })).ok);
  results.push((await run("getCollections", getCollectionsQuery, { first: 3 })).ok);
  results.push((await run("getCollection", getCollectionQuery, { handle: "frontpage" })).ok);
  results.push(
    (
      await run("getCollectionProducts", getCollectionProductsQuery, {
        handle: "frontpage",
        first: 3,
        sortKey: "COLLECTION_DEFAULT",
        reverse: false,
      })
    ).ok,
  );
  results.push((await run("getMetaobjects", getMetaobjectsQuery, { type: "designer", first: 3 })).ok);
  results.push((await run("getPage", getPageQuery, { handle: "our-story" })).ok);
  results.push((await run("getMenu", getMenuQuery, { handle: "desk-primary" })).ok);
  results.push((await run("getShop", getShopQuery)).ok);
  results.push((await run("searchProducts", searchProductsQuery, { query: "basket", first: 3 })).ok);
  results.push(
    (await run("predictiveSearch", predictiveSearchQuery, { query: "basket", limit: 4 })).ok,
  );

  // The queries executing is only half of it — the normalisers have to survive
  // the real payload shape too.
  console.log("\n— normalisers —");
  const raw = await run("getProduct (normalise)", getProductQuery, { handle: firstHandle });
  results.push(raw.ok);

  if (raw.data?.product) {
    const product = normalizeProduct(raw.data.product as never);
    const checks: [string, boolean, string][] = [
      ["handle", Boolean(product.handle), product.handle],
      ["title", Boolean(product.title), product.title],
      ["images", product.images.length > 0, `${product.images.length}`],
      ["variants", product.variants.length > 0, `${product.variants.length}`],
      ["sku", Boolean(product.variants[0]?.sku), product.variants[0]?.sku ?? "—"],
      ["metafield map", Object.keys(product.metafields).length > 0, Object.keys(product.metafields).join(",")],
      [
        "cdn resize",
        product.images[0] ? cdnImage(product.images[0].url, 415).includes("width=415") : false,
        product.images[0] ? cdnImage(product.images[0].url, 415).split("/").pop()!.slice(0, 40) : "—",
      ],
      ["no price leaked", !JSON.stringify(product).match(/"(price|compareAtPrice|availableForSale)"/), "ok"],
    ];

    for (const [label, ok, detail] of checks) {
      console.log(`  ${ok ? "✓" : "✕"} ${label.padEnd(16)} ${detail}`);
      results.push(ok);
    }
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(
    failed
      ? `\n✕ ${failed} of ${results.length} queries failed\n`
      : `\n✓ all ${results.length} queries executed\n`,
  );
  process.exit(failed ? 1 : 0);
}

void main();
