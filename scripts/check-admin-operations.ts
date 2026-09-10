/**
 * Runs every document in the admin panel's GraphQL allowlist against the live
 * Admin API and reports what came back.
 *
 *   npx tsx --conditions=react-server scripts/check-admin-operations.ts
 *
 * The `--conditions=react-server` flag is required: `lib/admin/operations.ts`
 * imports `server-only`, which throws under the default resolution conditions.
 *
 * Why this script exists at all: neither `tsc` nor `next build` can see inside a
 * GraphQL template literal. A misspelled field, a selection the API version
 * dropped, or a quote inside a `#` comment are all invisible until Shopify
 * itself parses the document. This is the only check that catches them.
 *
 * The two mutations are exercised with deliberately unresolvable arguments — a
 * metaobject type that cannot exist, and entry id 0 — so the document is parsed
 * and validated by Shopify while nothing in the store is created or changed.
 */

import { readFileSync } from "node:fs";

import { OPERATIONS, type OperationName } from "../lib/admin/operations";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
) as Record<string, string>;

const version = env.SHOPIFY_API_VERSION || "2026-07";
const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${version}/graphql.json`;

let failures = 0;
const attempted = new Set<OperationName>();

async function run(name: OperationName, variables: Record<string, unknown>) {
  attempted.add(name);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query: OPERATIONS[name].document, variables }),
  });

  const body = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
    failures += 1;
    console.log(`FAIL  ${name}`);
    for (const error of body.errors) console.log(`        ${error.message}`);
    return null;
  }

  console.log(`ok    ${name}`);
  return body.data ?? null;
}

async function main() {
  const definitions = (await run("metaobjectDefinitions", { first: 50 })) as {
    metaobjectDefinitions?: { nodes: { type: string; fieldDefinitions: unknown[] }[] };
  } | null;

  const types = definitions?.metaobjectDefinitions?.nodes.map((node) => node.type) ?? [];
  const probeType = types[0] ?? "designer";

  await run("metaobjectDefinitionByType", { type: probeType });

  const list = (await run("metaobjects", { type: probeType, first: 3 })) as {
    metaobjects?: { nodes: { id: string }[] };
  } | null;

  const firstId = list?.metaobjects?.nodes[0]?.id;
  if (firstId) {
    await run("metaobject", { id: firstId });
  } else {
    console.log(`skip  metaobject (no entries of type ${probeType})`);
  }

  await run("files", { first: 3, after: null, query: null });
  await run("nodes", { ids: [] });

  /* ---- collections ---- */

  const collections = (await run("collections", { first: 3, after: null })) as {
    collections?: { nodes: { id: string }[] };
  } | null;

  const collectionId = collections?.collections?.nodes[0]?.id;
  if (collectionId) {
    await run("collection", { id: collectionId });
    await run("collectionProducts", { id: collectionId, first: 3, after: null });
  } else {
    console.log("skip  collection, collectionProducts (store has no collections)");
  }

  /**
   * Mutations are exercised with arguments that cannot succeed, so the document is
   * parsed and validated by Shopify while nothing in the store is created or changed.
   */
  await run("collectionUpdate", { input: { id: "gid://shopify/Collection/0" } });
  await run("collectionCreate", { input: { title: "" } });

  /* ---- products ---- */

  const products = (await run("products", {
    first: 3,
    after: null,
    query: null,
    sortKey: "UPDATED_AT",
    reverse: true,
  })) as { products?: { nodes: { id: string }[] } } | null;

  await run("productsCount", { query: "status:ACTIVE" });
  await run("productFilterOptions", {});

  const productId = products?.products?.nodes[0]?.id;
  if (productId) {
    await run("product", { id: productId });
  } else {
    console.log("skip  product (store has no products)");
  }

  // Product id 0 cannot exist, so these are validated and change nothing.
  await run("productUpdate", { product: { id: "gid://shopify/Product/0" }, media: null });
  await run("productReorderMedia", { id: "gid://shopify/Product/0", moves: [] });
  await run("metafieldsDelete", { metafields: [] });
  await run("publishablePublish", { id: "gid://shopify/Product/0", input: [] });
  await run("publishableUnpublish", { id: "gid://shopify/Product/0", input: [] });

  /* ---- customers ---- */

  await run("customers", { first: 3, after: null, query: null });
  await run("customersCount", { query: null });
  // Customer id 0 is rejected as malformed by Shopify, unlike products and collections,
  // so a well-formed id that cannot exist is used instead.
  await run("customer", { id: "gid://shopify/Customer/1" });
  await run("customerUpdate", { input: { id: "gid://shopify/Customer/1" } });

  await run("productVariantImages", { ids: [] });
  await run("publications", {});
  await run("productMetafieldDefinitions", {});

  await run("stagedUploadsCreate", { input: [] });
  await run("fileCreate", { files: [] });
  await run("fileUpdate", { files: [] });

  /** A type no store can have, so the mutation is validated but creates nothing. */
  await run("metaobjectCreate", {
    metaobject: { type: "zz_check_only_does_not_exist", fields: [] },
  });

  await run("metaobjectUpdate", {
    id: "gid://shopify/Metaobject/0",
    metaobject: { fields: [] },
  });

  /**
   * The count is of what this run actually SENT, not of what the allowlist contains —
   * an operation nobody exercises here has not been checked, and saying otherwise would
   * make a green run mean less than it appears to.
   */
  const untested = (Object.keys(OPERATIONS) as OperationName[]).filter(
    (name) => !attempted.has(name),
  );

  console.log("-".repeat(58));
  console.log(
    failures === 0
      ? `${attempted.size} of ${Object.keys(OPERATIONS).length} operations parsed against ${env.SHOPIFY_STORE_DOMAIN} (${version})`
      : `${failures} operation(s) rejected by Shopify`,
  );
  if (untested.length) console.log(`not exercised: ${untested.join(", ")}`);

  process.exit(failures === 0 ? 0 : 1);
}

void main();
