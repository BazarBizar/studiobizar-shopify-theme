/**
 * Adds the `site_settings` singleton the Collections "Featured" tab writes to.
 *
 * It used to add `bulk_price_tier` and `min_order_tier` as well. Those were removed again
 * by `remove-collection-tiers.mjs`; this script no longer creates them, so running the two
 * in sequence does not resurrect what the other took away.
 *
 *   node --env-file=.env scripts/add-site-settings.mjs
 *   node --env-file=.env scripts/add-site-settings.mjs --dry-run
 *
 * IDEMPOTENT, and additive only:
 *  - a definition that already exists is left completely alone, never patched into a
 *    shape this script prefers;
 *  - fields missing from an existing definition are appended, so re-running after an
 *    edit here adds what is new without disturbing what is there;
 *  - the `site_settings` singleton entry is created only if absent, and its values are
 *    seeded only while still empty — so a second run never overwrites an operator's edit.
 *
 * Nothing is deleted. Removing a definition deletes the data stored under it, which
 * stays a deliberate manual action in the Shopify admin.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/add-site-settings.mjs");
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
    // Printed as-is: a schema error here is the whole diagnostic.
    console.error("GraphQL error:", JSON.stringify(body.errors, null, 2));
    process.exit(1);
  }
  return body.data;
}

/** Shopify answers HTTP 200 for a rejected mutation, so this is checked explicitly. */
function assertNoUserErrors(userErrors, context) {
  if (!userErrors?.length) return;
  console.error(`${context}:`);
  for (const error of userErrors) {
    console.error(`  ${(error.field ?? []).join(".")} ${error.message}`.trim());
  }
  process.exit(1);
}

/* -------------------------------------------------------------------------- *
 * Definitions
 * -------------------------------------------------------------------------- */

const DEFINITIONS = [
  {
    type: "site_settings",
    name: "Site Settings",
    description: "Store-wide settings. One entry only.",
    displayNameKey: "title",
    fields: [
      { key: "title", name: "Title", type: "single_line_text_field", required: true },
      /** The Featured tab on the Collections screen edits this ordered list. */
      { key: "featured_collections", name: "Featured Collections", type: "list.collection_reference" },
    ],
  },
];

/** Fields added to COLLECTION, so a collection can override the store-wide default. */
const COLLECTION_METAFIELDS = [];

/* -------------------------------------------------------------------------- *
 * Run
 * -------------------------------------------------------------------------- */

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");

  const existing = await gql(`{
    metaobjectDefinitions(first: 100) {
      nodes { id type fieldDefinitions { key } }
    }
  }`);

  /** type -> { id, keys } for definitions already in the store. */
  const byType = new Map(
    existing.metaobjectDefinitions.nodes.map((node) => [
      node.type,
      { id: node.id, keys: new Set(node.fieldDefinitions.map((field) => field.key)) },
    ]),
  );

  // A `metaobject_reference` field needs the TARGET definition's gid, which only exists
  // once the target has been created — so the list above is walked in dependency order
  // and the map is filled as it goes.
  const gidByType = new Map([...byType].map(([type, value]) => [type, value.id]));

  for (const definition of DEFINITIONS) {
    const already = byType.get(definition.type);

    const toField = (field) => ({
      key: field.key,
      name: field.name,
      type: field.type,
      required: field.required ?? false,
      ...(field.description ? { description: field.description } : {}),
      validations: [
        ...(field.validations ?? []),
        ...(field.metaobjectRef
          ? [{ name: "metaobject_definition_id", value: gidByType.get(field.metaobjectRef) }]
          : []),
      ],
    });

    if (!already) {
      console.log(`CREATE  ${definition.type}  (${definition.fields.length} fields)`);
      if (DRY_RUN) {
        gidByType.set(definition.type, `gid://dry-run/${definition.type}`);
        continue;
      }

      const created = await gql(
        `mutation($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition { id type }
            userErrors { field message code }
          }
        }`,
        {
          definition: {
            type: definition.type,
            name: definition.name,
            description: definition.description,
            displayNameKey: definition.displayNameKey,
            fieldDefinitions: definition.fields.map(toField),
            // The storefront reads these through the Storefront API, like every other
            // definition `schema-push` provisions.
            access: { storefront: "PUBLIC_READ" },
          },
        },
      );

      assertNoUserErrors(
        created.metaobjectDefinitionCreate.userErrors,
        `metaobjectDefinitionCreate ${definition.type}`,
      );

      gidByType.set(definition.type, created.metaobjectDefinitionCreate.metaobjectDefinition.id);
      continue;
    }

    // Present already: append only what is missing, never rewrite what is there.
    const missing = definition.fields.filter((field) => !already.keys.has(field.key));

    if (missing.length === 0) {
      console.log(`SKIP    ${definition.type}  (exists, all fields present)`);
      continue;
    }

    console.log(`PATCH   ${definition.type}  (+${missing.length}: ${missing.map((f) => f.key).join(", ")})`);
    if (DRY_RUN) continue;

    const patched = await gql(
      `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          metaobjectDefinition { id }
          userErrors { field message code }
        }
      }`,
      {
        id: already.id,
        definition: { fieldDefinitions: missing.map((field) => ({ create: toField(field) })) },
      },
    );

    assertNoUserErrors(
      patched.metaobjectDefinitionUpdate.userErrors,
      `metaobjectDefinitionUpdate ${definition.type}`,
    );
  }

  /* ---- COLLECTION metafields ------------------------------------------- */

  const collectionDefs = await gql(
    `query { metafieldDefinitions(first: 100, ownerType: COLLECTION) { nodes { key } } }`,
  );
  const haveKeys = new Set(collectionDefs.metafieldDefinitions.nodes.map((node) => node.key));

  for (const field of COLLECTION_METAFIELDS) {
    if (haveKeys.has(field.key)) {
      console.log(`SKIP    COLLECTION.${field.key}  (exists)`);
      continue;
    }

    console.log(`CREATE  COLLECTION.${field.key}`);
    if (DRY_RUN) continue;

    const created = await gql(
      `mutation($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition { id }
          userErrors { field message code }
        }
      }`,
      {
        definition: {
          ownerType: "COLLECTION",
          namespace: "custom",
          key: field.key,
          name: field.name,
          description: field.description,
          type: field.type,
          validations: field.metaobjectRef
            ? [{ name: "metaobject_definition_id", value: gidByType.get(field.metaobjectRef) }]
            : [],
          access: { storefront: "PUBLIC_READ" },
        },
      },
    );

    assertNoUserErrors(
      created.metafieldDefinitionCreate.userErrors,
      `metafieldDefinitionCreate COLLECTION.${field.key}`,
    );
  }

  /* ---- the site_settings singleton -------------------------------------- */

  const entries = await gql(
    `query { metaobjects(type: "site_settings", first: 2) { nodes { id handle } } }`,
  );

  if (entries.metaobjects.nodes.length > 0) {
    console.log(`SKIP    site_settings entry  (${entries.metaobjects.nodes[0].handle} exists)`);
  } else {
    console.log("CREATE  site_settings entry  (singleton)");
    if (!DRY_RUN) {
      const created = await gql(
        `mutation($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject { id handle }
            userErrors { field message code }
          }
        }`,
        {
          metaobject: {
            type: "site_settings",
            handle: "site-settings",
            // Seeded only because the entry is new. A re-run takes the SKIP branch above
            // and never touches values an operator has since edited.
            fields: [{ key: "title", value: "Site Settings" }],
          },
        },
      );

      assertNoUserErrors(created.metaobjectCreate.userErrors, "metaobjectCreate site_settings");
    }
  }

  console.log(DRY_RUN ? "\ndry run complete — nothing changed" : "\ndone");
}

await main();
