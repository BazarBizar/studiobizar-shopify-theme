/**
 * Round-trips every `rich_text_field` value in the store through the admin editor's
 * converter and checks that the STOREFRONT renders the result identically.
 *
 *   yarn check:rich-text
 *
 * Why the comparison is on rendered HTML rather than on the AST: key order and
 * absent-vs-false flags can differ harmlessly, but what a customer sees cannot.
 * `lib/shopify/transforms.ts` is the authority, so it is the judge here too.
 *
 * Run this after any change to `lib/admin/rich-text.ts` or to the enabled Tiptap
 * extensions. A failure means opening an entry in the panel and saving it would
 * silently alter published copy.
 */
import { readFileSync } from "node:fs";

import { proseMirrorToShopify, shopifyToProseMirror } from "../lib/admin/rich-text";
import { richTextToHtml } from "../lib/shopify/transforms";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
) as Record<string, string>;

const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION || "2026-07"}/graphql.json`;

async function gql(query: string, variables: Record<string, unknown>) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_API_ACCESS_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  return (await r.json()) as { data?: Record<string, { nodes: { handle: string; fields: { key: string; type: string; value: string | null }[] }[] }> };
}

async function main() {
  let checked = 0;
  let identicalHtml = 0;
  const differences: string[] = [];

  for (const type of ["designer", "project", "faq_item", "service"]) {
    const data = await gql(
      `query($type: String!) { metaobjects(type: $type, first: 50) { nodes { handle fields { key type value } } } }`,
      { type },
    );

    for (const node of data.data?.metaobjects?.nodes ?? []) {
      for (const field of node.fields) {
        if (field.type !== "rich_text_field" || !field.value) continue;

        checked += 1;
        const back = proseMirrorToShopify(shopifyToProseMirror(field.value));

        // The AST may legitimately reorder keys, so compare what the STOREFRONT
        // renders — that is the only difference a customer could ever see.
        const before = richTextToHtml(field.value);
        const after = richTextToHtml(back);

        if (before === after) {
          identicalHtml += 1;
        } else {
          differences.push(`${type}/${node.handle}.${field.key}`);
          if (differences.length <= 2) {
            console.log(`\nDIFFERS: ${type}/${node.handle}.${field.key}`);
            console.log(`  before: ${before.slice(0, 200)}`);
            console.log(`  after : ${after.slice(0, 200)}`);
          }
        }
      }
    }
  }

  console.log(`\nchecked ${checked} rich text values`);
  console.log(`identical rendered HTML after round trip: ${identicalHtml}/${checked}`);
  if (differences.length) console.log(`differing: ${differences.join(", ")}`);
  process.exit(differences.length ? 1 : 0);
}

void main();
