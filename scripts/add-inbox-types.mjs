/**
 * Adds the two inbox types the storefront forms write to, so what visitors send is kept
 * in the panel and not only in somebody's mailbox:
 *
 *   contact_message        the Contact page form   (app/api/contact/route.ts)
 *   newsletter_subscriber  the newsletter sign-up  (app/api/newsletter/route.ts)
 *
 *   node --env-file=.env scripts/add-inbox-types.mjs
 *   node --env-file=.env scripts/add-inbox-types.mjs --dry-run
 *
 * IDEMPOTENT and additive only, like `add-email-notifications.mjs`: an existing
 * definition gets missing fields appended and nothing else. Access is `NONE` on
 * creation — these are visitors' names and addresses, read by the server through the
 * Admin API and never by the storefront token.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/add-inbox-types.mjs");
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

/** Kept in step with `CONTACT_STATUSES` / `SUBSCRIBER_STATUSES` in `lib/inbox/save.ts`. */
const CONTACT_STATUSES = ["new", "replied", "closed"];
const SUBSCRIBER_STATUSES = ["subscribed", "unsubscribed"];

const DEFINITIONS = [
  {
    type: "contact_message",
    name: "Contact message",
    description: "A message sent through the Contact page form. Written by the website; only its status is changed in the panel.",
    displayNameKey: "name",
    fields: [
      { key: "name", name: "Name", type: "single_line_text_field", required: true },
      { key: "email", name: "Email", type: "single_line_text_field", required: true },
      { key: "phone", name: "Phone", type: "single_line_text_field" },
      { key: "company", name: "Company", type: "single_line_text_field" },
      { key: "topic", name: "Topic", type: "single_line_text_field" },
      { key: "message", name: "Message", type: "multi_line_text_field" },
      { key: "received_at", name: "Received at", type: "date_time" },
      {
        key: "status",
        name: "Status",
        type: "single_line_text_field",
        required: true,
        validations: [{ name: "choices", value: JSON.stringify(CONTACT_STATUSES) }],
      },
      {
        key: "email_status",
        name: "Email to the team",
        type: "single_line_text_field",
        description: "Whether the team was emailed about this message, and if not, why.",
      },
    ],
  },
  {
    type: "newsletter_subscriber",
    name: "Newsletter subscriber",
    description: "An address signed up through the newsletter form. One entry per address.",
    displayNameKey: "email",
    fields: [
      { key: "email", name: "Email", type: "single_line_text_field", required: true },
      { key: "subscribed_at", name: "Signed up at", type: "date_time" },
      { key: "source", name: "Signed up on", type: "single_line_text_field" },
      {
        key: "status",
        name: "Status",
        type: "single_line_text_field",
        required: true,
        validations: [{ name: "choices", value: JSON.stringify(SUBSCRIBER_STATUSES) }],
      },
    ],
  },
];

const toField = (field) => ({
  key: field.key,
  name: field.name,
  type: field.type,
  required: field.required ?? false,
  ...(field.description ? { description: field.description } : {}),
  validations: field.validations ?? [],
});

async function ensure(definition) {
  const existing = await gql(
    `query($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        id
        access { storefront }
        fieldDefinitions { key type { name } }
      }
    }`,
    { type: definition.type },
  );
  const already = existing.metaobjectDefinitionByType;

  if (!already) {
    console.log(`CREATE  ${definition.type}  (${definition.fields.length} fields, storefront NONE)`);
    if (DRY_RUN) return;
    const created = await gql(
      `mutation($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition { id }
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
          access: { storefront: "NONE" },
        },
      },
    );
    assertNoUserErrors(created.metaobjectDefinitionCreate.userErrors, `metaobjectDefinitionCreate ${definition.type}`);
    return;
  }

  const types = new Map(already.fieldDefinitions.map((field) => [field.key, field.type.name]));
  for (const field of definition.fields) {
    if (types.has(field.key) && types.get(field.key) !== field.type) {
      console.log(
        `WARN    ${definition.type}.${field.key}  is ${types.get(field.key)}, this file says ${field.type} — delete the field in Shopify and re-run`,
      );
    }
  }
  if (already.access.storefront !== "NONE") {
    console.log(`WARN    ${definition.type}  storefront access is ${already.access.storefront} — run scripts/set-private-access.mjs`);
  }

  const missing = definition.fields.filter((field) => !types.has(field.key));
  if (missing.length === 0) {
    console.log(`SKIP    ${definition.type}  (exists, all fields present)`);
    return;
  }
  console.log(`PATCH   ${definition.type}  (+${missing.length}: ${missing.map((field) => field.key).join(", ")})`);
  if (DRY_RUN) return;
  const patched = await gql(
    `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
      metaobjectDefinitionUpdate(id: $id, definition: $definition) {
        metaobjectDefinition { id }
        userErrors { field message code }
      }
    }`,
    { id: already.id, definition: { fieldDefinitions: missing.map((field) => ({ create: toField(field) })) } },
  );
  assertNoUserErrors(patched.metaobjectDefinitionUpdate.userErrors, `metaobjectDefinitionUpdate ${definition.type}`);
}

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");
  for (const definition of DEFINITIONS) await ensure(definition);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
