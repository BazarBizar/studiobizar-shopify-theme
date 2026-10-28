/**
 * Adds the `site_identity` singleton — the website's logo, browser-tab icon, name and
 * what search engines and link previews show — edited in the panel under
 * Site-wide → Logo, icon & SEO.
 *
 *   node --env-file=.env scripts/add-site-identity.mjs
 *   node --env-file=.env scripts/add-site-identity.mjs --dry-run
 *
 * Read by BOTH storefronts: the Next app (`getSiteIdentity` in lib/shopify) and the
 * Liquid theme (`shop.metaobjects.site_identity['site-identity']`), so storefront access
 * is PUBLIC_READ. Nothing in it is private.
 *
 * IDEMPOTENT and additive only, like `add-site-settings.mjs`: an existing definition gets
 * missing fields appended; the entry is created once, with the name and description the
 * site used before, and never overwritten.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/add-site-identity.mjs");
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
  for (const error of userErrors) console.error(`  ${(error.field ?? []).join(".")} ${error.message}`.trim());
  process.exit(1);
}

const TYPE = "site_identity";
const HANDLE = "site-identity";
const IMAGE = [{ name: "file_type_options", value: JSON.stringify(["Image"]) }];

/** Kept in step with `LOGO_COLOURS` in lib/shopify/entities.ts. */
const LOGO_COLOURS = ["text", "original"];

const FIELDS = [
  { key: "site_name", name: "Website name", type: "single_line_text_field", required: true, validations: [{ name: "max", value: "60" }] },
  { key: "logo", name: "Logo", type: "file_reference", validations: IMAGE },
  { key: "logo_mark", name: "Small logo (symbol)", type: "file_reference", validations: IMAGE },
  {
    key: "logo_colour",
    name: "Logo colours",
    type: "single_line_text_field",
    validations: [{ name: "choices", value: JSON.stringify(LOGO_COLOURS) }],
  },
  { key: "favicon", name: "Browser tab icon", type: "file_reference", validations: IMAGE },
  { key: "meta_description", name: "Description for search engines", type: "multi_line_text_field", validations: [{ name: "max", value: "320" }] },
  { key: "share_image", name: "Share image", type: "file_reference", validations: IMAGE },
  { key: "theme_color", name: "Browser colour on phones", type: "color" },
  { key: "google_verification", name: "Google Search Console code", type: "single_line_text_field", validations: [{ name: "max", value: "200" }] },
];

/** What the site showed before this existed — so creating the entry changes nothing. */
const SEED = [
  ["site_name", "Studio Bizar"],
  ["logo_colour", "text"],
  ["meta_description", "Designed for life, inspired by the world."],
];

const toField = (field) => ({
  key: field.key,
  name: field.name,
  type: field.type,
  required: field.required ?? false,
  validations: field.validations ?? [],
});

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");

  const existing = await gql(
    `query($type: String!) { metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key type { name } } } }`,
    { type: TYPE },
  );
  const already = existing.metaobjectDefinitionByType;

  if (!already) {
    console.log(`CREATE  ${TYPE}  (${FIELDS.length} fields, storefront PUBLIC_READ)`);
    if (!DRY_RUN) {
      const created = await gql(
        `mutation($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id } userErrors { field message code } }
        }`,
        {
          definition: {
            type: TYPE,
            name: "Site identity",
            description: "The website's logo, browser-tab icon, name, and what search engines and link previews show. One entry.",
            displayNameKey: "site_name",
            fieldDefinitions: FIELDS.map(toField),
            access: { storefront: "PUBLIC_READ" },
          },
        },
      );
      assertNoUserErrors(created.metaobjectDefinitionCreate.userErrors, `metaobjectDefinitionCreate ${TYPE}`);
    }
  } else {
    const types = new Map(already.fieldDefinitions.map((field) => [field.key, field.type.name]));
    for (const field of FIELDS) {
      if (types.has(field.key) && types.get(field.key) !== field.type) {
        console.log(`WARN    ${TYPE}.${field.key}  is ${types.get(field.key)}, this file says ${field.type}`);
      }
    }
    const missing = FIELDS.filter((field) => !types.has(field.key));
    if (!missing.length) console.log(`SKIP    ${TYPE}  (exists, all fields present)`);
    else {
      console.log(`PATCH   ${TYPE}  (+${missing.length}: ${missing.map((field) => field.key).join(", ")})`);
      if (!DRY_RUN) {
        const patched = await gql(
          `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
            metaobjectDefinitionUpdate(id: $id, definition: $definition) { metaobjectDefinition { id } userErrors { field message code } }
          }`,
          { id: already.id, definition: { fieldDefinitions: missing.map((field) => ({ create: toField(field) })) } },
        );
        assertNoUserErrors(patched.metaobjectDefinitionUpdate.userErrors, `metaobjectDefinitionUpdate ${TYPE}`);
      }
    }
  }

  /* ---- the one entry ---------------------------------------------------- */

  if (DRY_RUN && !already) {
    console.log(`CREATE  entry ${HANDLE}  (seeded: ${SEED.map(([key]) => key).join(", ")})`);
    return;
  }
  const entry = await gql(
    `query($handle: MetaobjectHandleInput!) { metaobjectByHandle(handle: $handle) { id } }`,
    { handle: { type: TYPE, handle: HANDLE } },
  );
  if (entry.metaobjectByHandle) {
    console.log(`SKIP    entry ${HANDLE}  (exists — edit it in the panel)`);
    return;
  }
  console.log(`CREATE  entry ${HANDLE}  (seeded: ${SEED.map(([key]) => key).join(", ")})`);
  if (DRY_RUN) return;
  const created = await gql(
    `mutation($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) { metaobject { id } userErrors { field message code } }
    }`,
    {
      metaobject: {
        type: TYPE,
        handle: HANDLE,
        fields: SEED.map(([key, value]) => ({ key, value })),
      },
    },
  );
  assertNoUserErrors(created.metaobjectCreate.userErrors, `metaobjectCreate ${TYPE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
