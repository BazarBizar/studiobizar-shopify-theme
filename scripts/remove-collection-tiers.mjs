/**
 * Removes the price-tier schema added by `add-site-settings.mjs`.
 *
 *   node --env-file=.env scripts/remove-collection-tiers.mjs --dry-run
 *   node --env-file=.env scripts/remove-collection-tiers.mjs
 *
 * SIX THINGS COME OUT, not two. Deleting only the definitions would leave:
 *
 *   - two `site_settings` fields whose target no longer exists, which the generic form
 *     renders as pickers that can never offer anything;
 *   - two COLLECTION metafield definitions pointing at a deleted definition, which the
 *     collection form would still try to read and write.
 *
 * So the references go first, then the definitions they point at.
 *
 * THIS SCRIPT DELETES DATA, which is why every step is guarded:
 *  - it refuses outright if either definition has any entries;
 *  - it refuses if any referencing field holds a value;
 *  - it only ever touches the exact keys it created, never a whole namespace.
 *
 * Re-running is safe: anything already gone is reported as SKIP.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  process.exit(1);
}

const url = `https://${domain}/admin/api/${version}/graphql.json`;

async function gql(query, variables) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json();
  if (body.errors) {
    console.error("GraphQL error:", JSON.stringify(body.errors, null, 2));
    process.exit(1);
  }
  return body.data;
}

function assertNoUserErrors(userErrors, context) {
  if (!userErrors?.length) return;
  console.error(`${context}:`);
  for (const error of userErrors) {
    console.error(`  ${(error.field ?? []).join(".")} ${error.message}`.trim());
  }
  process.exit(1);
}

const TIER_TYPES = ["bulk_price_tier", "min_order_tier"];
const SETTINGS_FIELDS = ["default_bulk_price_tiers", "default_min_order_tier"];
const COLLECTION_KEYS = ["bulk_price_tiers", "min_order_tier"];

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live — this deletes schema\n");

  const definitions = (await gql(`{ metaobjectDefinitions(first: 100) { nodes { id type } } }`))
    .metaobjectDefinitions.nodes;
  const byType = new Map(definitions.map((node) => [node.type, node]));

  /* ---- Guard 1: refuse if either definition holds entries ---------------- */

  for (const type of TIER_TYPES) {
    if (!byType.has(type)) continue;

    // Counted for real: `metaobjectsCount` is unreliable on this API and is exactly the
    // wrong thing to trust when deciding whether a delete destroys data.
    const entries = (
      await gql(`query($t: String!) { metaobjects(type: $t, first: 250) { nodes { id handle } } }`, {
        t: type,
      })
    ).metaobjects.nodes;

    if (entries.length > 0) {
      console.error(`REFUSING: ${type} has ${entries.length} entries. Deleting it would destroy them.`);
      console.error(`  ${entries.map((entry) => entry.handle).join(", ")}`);
      process.exit(1);
    }
    console.log(`check   ${type} holds no entries`);
  }

  /* ---- Guard 2: refuse if any referencing field holds a value ------------ */

  const settings = (
    await gql(`{ metaobjects(type: "site_settings", first: 5) { nodes { id handle fields { key value } } } }`)
  ).metaobjects.nodes;

  for (const entry of settings) {
    for (const field of entry.fields) {
      if (SETTINGS_FIELDS.includes(field.key) && field.value) {
        console.error(`REFUSING: site_settings.${field.key} holds ${JSON.stringify(field.value)}.`);
        console.error("  Clear it in the panel first, so nothing is silently discarded.");
        process.exit(1);
      }
    }
  }
  console.log("check   no site_settings tier values are set");

  /* ---- 1. COLLECTION metafield definitions ------------------------------ */

  const collectionFields = (
    await gql(`{ metafieldDefinitions(first: 100, ownerType: COLLECTION) { nodes { id key } } }`)
  ).metafieldDefinitions.nodes;

  for (const key of COLLECTION_KEYS) {
    const field = collectionFields.find((candidate) => candidate.key === key);
    if (!field) {
      console.log(`SKIP    COLLECTION.${key}  (already gone)`);
      continue;
    }

    console.log(`DELETE  COLLECTION.${key}`);
    if (DRY_RUN) continue;

    const result = await gql(
      `mutation($id: ID!) {
        metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: true) {
          deletedDefinitionId
          userErrors { field message code }
        }
      }`,
      { id: field.id },
    );
    assertNoUserErrors(
      result.metafieldDefinitionDelete.userErrors,
      `metafieldDefinitionDelete COLLECTION.${key}`,
    );
  }

  /* ---- 2. site_settings fields ------------------------------------------ */

  const siteSettings = byType.get("site_settings");

  if (!siteSettings) {
    console.log("SKIP    site_settings fields  (definition absent)");
  } else {
    const existing = (
      await gql(`{ metaobjectDefinitionByType(type: "site_settings") { fieldDefinitions { key } } }`)
    ).metaobjectDefinitionByType.fieldDefinitions.map((field) => field.key);

    const toRemove = SETTINGS_FIELDS.filter((key) => existing.includes(key));

    if (toRemove.length === 0) {
      console.log("SKIP    site_settings fields  (already gone)");
    } else {
      console.log(`DELETE  site_settings.${toRemove.join(", site_settings.")}`);
      if (!DRY_RUN) {
        const result = await gql(
          `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
            metaobjectDefinitionUpdate(id: $id, definition: $definition) {
              metaobjectDefinition { id }
              userErrors { field message code }
            }
          }`,
          {
            id: siteSettings.id,
            definition: {
              fieldDefinitions: toRemove.map((key) => ({ delete: { key } })),
            },
          },
        );
        assertNoUserErrors(
          result.metaobjectDefinitionUpdate.userErrors,
          "metaobjectDefinitionUpdate site_settings",
        );
      }
    }
  }

  /* ---- 3. the tier definitions themselves -------------------------------- */

  for (const type of TIER_TYPES) {
    const definition = byType.get(type);
    if (!definition) {
      console.log(`SKIP    ${type}  (already gone)`);
      continue;
    }

    console.log(`DELETE  ${type}`);
    if (DRY_RUN) continue;

    const result = await gql(
      `mutation($id: ID!) {
        metaobjectDefinitionDelete(id: $id) {
          deletedId
          userErrors { field message code }
        }
      }`,
      { id: definition.id },
    );
    assertNoUserErrors(result.metaobjectDefinitionDelete.userErrors, `metaobjectDefinitionDelete ${type}`);
  }

  console.log(DRY_RUN ? "\ndry run complete — nothing changed" : "\ndone");
}

await main();
