/**
 * Adds the `admin_settings` singleton — branding for the admin PANEL itself (its
 * sidebar name, initials and browser-tab icon), never for the storefront. Read by
 * `lib/admin/admin-settings.ts`; edited under Site-wide → Admin panel.
 *
 *   node --env-file=.env scripts/add-admin-settings.mjs
 *   node --env-file=.env scripts/add-admin-settings.mjs --dry-run
 *
 * Light/dark theme is deliberately NOT here: it is each person's preference
 * (next-themes, per browser), not a property of the panel.
 *
 * IDEMPOTENT, and additive only, like `add-site-settings.mjs`: an existing definition
 * gets missing fields appended; the entry is created only if absent and its values are
 * seeded only while empty. Storefront access is `NONE` — nothing public reads it.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const TYPE = "admin_settings";
const HANDLE = "admin-settings";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/add-admin-settings.mjs");
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

const FIELDS = [
  {
    key: "panel_title",
    name: "Panel title",
    type: "single_line_text_field",
    description: "The name at the top of the sidebar and in the browser tab.",
  },
  {
    key: "panel_initials",
    name: "Panel initials",
    type: "single_line_text_field",
    description: "Up to three characters, in the square beside the title.",
    validations: [{ name: "max", value: "3" }],
  },
  {
    key: "favicon",
    name: "Favicon",
    type: "file_reference",
    description: "The admin's browser-tab icon. A square PNG works best.",
    validations: [{ name: "file_type_options", value: JSON.stringify(["Image"]) }],
  },
];

/** The values the panel showed before this existed — seeded so nothing changes on day one. */
const SEED = { panel_title: "Studio Bizar", panel_initials: "SB" };

const toField = (field) => ({
  key: field.key,
  name: field.name,
  type: field.type,
  required: false,
  ...(field.description ? { description: field.description } : {}),
  validations: field.validations ?? [],
});

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");

  /* ---- definition ------------------------------------------------------- */

  const existing = await gql(
    `query($type: String!) {
      metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key type { name } } }
    }`,
    { type: TYPE },
  );

  const already = existing.metaobjectDefinitionByType;

  if (!already) {
    console.log(`CREATE  ${TYPE}  (${FIELDS.length} fields, storefront NONE)`);
    if (!DRY_RUN) {
      const created = await gql(
        `mutation($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition { id }
            userErrors { field message code }
          }
        }`,
        {
          definition: {
            type: TYPE,
            name: "Admin settings",
            description: "Branding for the admin panel. One entry only.",
            displayNameKey: "panel_title",
            fieldDefinitions: FIELDS.map(toField),
            access: { storefront: "NONE" },
          },
        },
      );
      assertNoUserErrors(created.metaobjectDefinitionCreate.userErrors, `metaobjectDefinitionCreate ${TYPE}`);
    }
  } else {
    const types = new Map(already.fieldDefinitions.map((field) => [field.key, field.type.name]));

    for (const field of FIELDS) {
      if (types.has(field.key) && types.get(field.key) !== field.type) {
        console.log(
          `WARN    ${TYPE}.${field.key}  is ${types.get(field.key)}, this file says ${field.type} — ` +
            "delete the field in Shopify and re-run",
        );
      }
    }

    const missing = FIELDS.filter((field) => !types.has(field.key));
    if (missing.length === 0) {
      console.log(`SKIP    ${TYPE}  (exists, all fields present)`);
    } else {
      console.log(`PATCH   ${TYPE}  (+${missing.length}: ${missing.map((f) => f.key).join(", ")})`);
      if (!DRY_RUN) {
        const patched = await gql(
          `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
            metaobjectDefinitionUpdate(id: $id, definition: $definition) {
              metaobjectDefinition { id }
              userErrors { field message code }
            }
          }`,
          { id: already.id, definition: { fieldDefinitions: missing.map((field) => ({ create: toField(field) })) } },
        );
        assertNoUserErrors(patched.metaobjectDefinitionUpdate.userErrors, `metaobjectDefinitionUpdate ${TYPE}`);
      }
    }
  }

  /* ---- the singleton entry ---------------------------------------------- */

  if (DRY_RUN && !already) {
    console.log(`CREATE  ${TYPE} entry  (singleton, seeded: ${Object.keys(SEED).join(", ")})`);
    return;
  }

  const entries = await gql(
    `query($type: String!) { metaobjects(type: $type, first: 2) { nodes { id handle fields { key value } } } }`,
    { type: TYPE },
  );

  const entry = entries.metaobjects.nodes[0];

  if (!entry) {
    console.log(`CREATE  ${TYPE} entry  (singleton, seeded: ${Object.keys(SEED).join(", ")})`);
    if (DRY_RUN) return;

    const created = await gql(
      `mutation($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message code }
        }
      }`,
      {
        metaobject: {
          type: TYPE,
          handle: HANDLE,
          fields: Object.entries(SEED).map(([key, value]) => ({ key, value })),
        },
      },
    );
    assertNoUserErrors(created.metaobjectCreate.userErrors, `metaobjectCreate ${TYPE}`);
    return;
  }

  // Seed only what is still empty — an operator's edit is never overwritten.
  const filled = new Set(entry.fields.filter((field) => field.value).map((field) => field.key));
  const toSeed = Object.entries(SEED).filter(([key]) => !filled.has(key));

  if (toSeed.length === 0) {
    console.log(`SKIP    ${TYPE} entry  (${entry.handle} exists, values set)`);
    return;
  }

  console.log(`SEED    ${TYPE} values  (+${toSeed.length}: ${toSeed.map(([key]) => key).join(", ")})`);
  if (DRY_RUN) return;

  const seeded = await gql(
    `mutation($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message code }
      }
    }`,
    { id: entry.id, metaobject: { fields: toSeed.map(([key, value]) => ({ key, value })) } },
  );
  assertNoUserErrors(seeded.metaobjectUpdate.userErrors, `metaobjectUpdate ${TYPE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
