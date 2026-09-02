/**
 * Counts what is actually in the store, through the Storefront API — i.e. what
 * the site can really see, not what the admin holds.
 *
 *   npx tsx scripts/check-content.ts
 */

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
) as Record<string, string>;

async function sf<T>(query: string): Promise<T> {
  const response = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data!;
}

const row = (label: string, count: number, detail = "") =>
  console.log(`  ${String(count).padStart(4)}  ${label.padEnd(28)} ${detail}`);

async function main() {
  console.log("\n▸ Metaobjects (Storefront-visible)");
  for (const type of [
    "designer",
    "project",
    "captioned_image",
    "service",
    "contact_channel",
    "faq_item",
    "inquiry",
  ]) {
    const data = await sf<{ metaobjects: { nodes: { handle: string }[] } }>(
      `{ metaobjects(type:"${type}", first:250){ nodes { handle } } }`,
    );
    row(type, data.metaobjects.nodes.length);
  }

  console.log("\n▸ Collections");
  const collections = await sf<{
    collections: {
      nodes: {
        handle: string;
        signature: { value: string } | null;
        designer: { value: string } | null;
        hero: { value: string } | null;
        products: { nodes: { id: string }[] };
      }[];
    };
  }>(`{ collections(first:100){ nodes {
        handle
        signature: metafield(namespace:"custom", key:"is_signature"){ value }
        designer: metafield(namespace:"custom", key:"designer"){ value }
        hero: metafield(namespace:"custom", key:"hero_image"){ value }
        products(first:50){ nodes { id } }
      } } }`);

  const all = collections.collections.nodes;
  row("total", all.length);
  row("is_signature", all.filter((c) => c.signature?.value === "true").length);
  row("with designer", all.filter((c) => c.designer).length);
  row("with hero image", all.filter((c) => c.hero).length);

  const inCollections = new Set(all.flatMap((c) => c.products.nodes.map((p) => p.id)));
  row("distinct products in them", inCollections.size);

  console.log("\n▸ Product metafields (sample of 250)");
  const products = await sf<{
    products: { nodes: { handle: string; metafields: ({ key: string } | null)[] }[] };
  }>(`{ products(first:250){ nodes { handle metafields(identifiers:[
        {namespace:"custom",key:"designer"},{namespace:"custom",key:"collection_label"},
        {namespace:"custom",key:"is_new"},{namespace:"custom",key:"material_finish"},
        {namespace:"custom",key:"technical_specifications"},{namespace:"custom",key:"idea_body"},
        {namespace:"custom",key:"idea_image"},{namespace:"custom",key:"signature_collection"}
      ]){ key } } } }`);

  const fill = new Map<string, number>();
  let withAny = 0;
  for (const product of products.products.nodes) {
    const keys = product.metafields.filter(Boolean).map((m) => m!.key);
    if (keys.length) withAny++;
    for (const key of keys) fill.set(key, (fill.get(key) ?? 0) + 1);
  }
  row("sampled", products.products.nodes.length);
  row("with any of the 8", withAny);
  for (const [key, count] of [...fill].sort((a, b) => b[1] - a[1])) row(key, count);

  console.log("\n▸ Pages and their metafields");
  const pages = await sf<{
    pages: { nodes: { handle: string; metafields: ({ key: string } | null)[] }[] };
  }>(`{ pages(first:25){ nodes { handle metafields(identifiers:[
        {namespace:"custom",key:"hero_slides"},{namespace:"custom",key:"feature_images"},
        {namespace:"custom",key:"gallery"},{namespace:"custom",key:"intro_body"},
        {namespace:"custom",key:"story_block_1"},{namespace:"custom",key:"channels"},
        {namespace:"custom",key:"inquiry_types"},{namespace:"custom",key:"new_in"},
        {namespace:"custom",key:"monthly_selection"},{namespace:"custom",key:"story_image"}
      ]){ key } } } }`);

  for (const page of pages.pages.nodes) {
    const keys = page.metafields.filter(Boolean).map((m) => m!.key);
    if (keys.length) console.log(`  ${page.handle.padEnd(20)} ${keys.join(", ")}`);
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
