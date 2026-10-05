/**
 * Adds the `email_notification` metaobject — who receives the staff copy of each
 * storefront email. Replaces the single `INQUIRY_NOTIFY_EMAIL` address, which could
 * only be changed with a deploy and could not send different forms to different
 * people. Read by `lib/email/notification-recipients.ts`.
 *
 *   node --env-file=.env scripts/add-email-notifications.mjs
 *   node --env-file=.env scripts/add-email-notifications.mjs --dry-run
 *   node --env-file=.env scripts/add-email-notifications.mjs --default-recipient=name@example.com
 *
 * One entry per notification type. A type without an entry of its own falls back to
 * the `default` entry; a type whose entry is DISABLED is muted and does not fall back.
 *
 * `--default-recipient` also creates the `default` entry, if there is none. Without
 * it only the definition is created and the entry is left to the panel — this script
 * does not guess whose inbox the store's mail should go to.
 *
 * IDEMPOTENT, and additive only, like `add-site-settings.mjs`: an existing definition
 * gets missing fields appended and nothing else; an existing `default` entry is never
 * touched. Access is `NONE` on creation — the storefront reads this through the Admin
 * API, and recipient addresses are nobody else's business.
 */

const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_RECIPIENT = process.argv
  .find((argument) => argument.startsWith("--default-recipient="))
  ?.slice("--default-recipient=".length)
  .trim();

/** Kept in step with `NOTIFICATION_TYPES` in `lib/email/notification-recipients.ts`. */
const NOTIFICATION_TYPES = ["default", "product_inquiry", "contact"];

/** The same check the runtime applies. Shopify enforces it on every save. */
const EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/add-email-notifications.mjs");
  process.exit(1);
}

if (DEFAULT_RECIPIENT !== undefined && !new RegExp(EMAIL_PATTERN).test(DEFAULT_RECIPIENT)) {
  console.error(`--default-recipient is not an email address: "${DEFAULT_RECIPIENT}"`);
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

const DEFINITION = {
  type: "email_notification",
  name: "Email notification",
  description:
    "Who receives the staff copy of each storefront email. One entry per type; a type without its own entry uses the 'default' entry.",
  displayNameKey: "name",
  fields: [
    { key: "name", name: "Name", type: "single_line_text_field", required: true },
    {
      key: "notification_type",
      name: "Notification type",
      type: "single_line_text_field",
      required: true,
      description:
        "default: anything without its own entry. product_inquiry: the inquiry list. contact: the Contact page form.",
      validations: [{ name: "choices", value: JSON.stringify(NOTIFICATION_TYPES) }],
    },
    {
      key: "recipients",
      name: "Recipients",
      type: "list.single_line_text_field",
      required: true,
      description: "Email addresses, one per line.",
      validations: [{ name: "regex", value: EMAIL_PATTERN }],
    },
    {
      key: "enabled",
      name: "Enabled",
      type: "boolean",
      required: true,
      description: "Off mutes this type completely — it does NOT fall back to the default entry.",
    },
  ],
};

const toField = (field) => ({
  key: field.key,
  name: field.name,
  type: field.type,
  required: field.required ?? false,
  ...(field.description ? { description: field.description } : {}),
  validations: field.validations ?? [],
});

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");

  /* ---- definition ------------------------------------------------------- */

  const existing = await gql(
    `query($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        id
        access { storefront }
        fieldDefinitions { key type { name } }
      }
    }`,
    { type: DEFINITION.type },
  );

  const already = existing.metaobjectDefinitionByType;

  if (!already) {
    console.log(`CREATE  ${DEFINITION.type}  (${DEFINITION.fields.length} fields, storefront NONE)`);
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
            type: DEFINITION.type,
            name: DEFINITION.name,
            description: DEFINITION.description,
            displayNameKey: DEFINITION.displayNameKey,
            fieldDefinitions: DEFINITION.fields.map(toField),
            access: { storefront: "NONE" },
          },
        },
      );

      assertNoUserErrors(
        created.metaobjectDefinitionCreate.userErrors,
        `metaobjectDefinitionCreate ${DEFINITION.type}`,
      );
    }
  } else {
    const types = new Map(already.fieldDefinitions.map((field) => [field.key, field.type.name]));

    // Reported, not repaired: Shopify cannot change a field's type in place.
    for (const field of DEFINITION.fields) {
      if (types.has(field.key) && types.get(field.key) !== field.type) {
        console.log(
          `WARN    ${DEFINITION.type}.${field.key}  is ${types.get(field.key)}, ` +
            `this file says ${field.type} — delete the field in Shopify and re-run`,
        );
      }
    }

    if (already.access.storefront !== "NONE") {
      console.log(
        `WARN    ${DEFINITION.type}  storefront access is ${already.access.storefront} — ` +
          "run scripts/set-private-access.mjs",
      );
    }

    const missing = DEFINITION.fields.filter((field) => !types.has(field.key));
    if (missing.length === 0) {
      console.log(`SKIP    ${DEFINITION.type}  (exists, all fields present)`);
    } else {
      console.log(`PATCH   ${DEFINITION.type}  (+${missing.length}: ${missing.map((f) => f.key).join(", ")})`);
      if (!DRY_RUN) {
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
          `metaobjectDefinitionUpdate ${DEFINITION.type}`,
        );
      }
    }
  }

  /* ---- the `default` entry ---------------------------------------------- */

  if (!DEFAULT_RECIPIENT) {
    console.log(
      "SKIP    default entry  (no --default-recipient given — add it in the panel under Site-wide → Email notifications)",
    );
    return;
  }

  if (DRY_RUN && !already) {
    console.log(`CREATE  default entry  (recipients: ${DEFAULT_RECIPIENT})`);
    return;
  }

  const entries = await gql(
    `query { metaobjects(type: "email_notification", first: 50) { nodes { handle fields { key value } } } }`,
  );

  const hasDefault = entries.metaobjects.nodes.some(
    (node) => node.fields.find((field) => field.key === "notification_type")?.value === "default",
  );

  if (hasDefault) {
    console.log("SKIP    default entry  (exists — edit it in the panel)");
    return;
  }

  console.log(`CREATE  default entry  (recipients: ${DEFAULT_RECIPIENT})`);
  if (DRY_RUN) return;

  const created = await gql(
    `mutation($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }`,
    {
      metaobject: {
        type: "email_notification",
        handle: "default",
        fields: [
          { key: "name", value: "Default" },
          { key: "notification_type", value: "default" },
          { key: "recipients", value: JSON.stringify([DEFAULT_RECIPIENT]) },
          { key: "enabled", value: "true" },
        ],
      },
    },
  );

  assertNoUserErrors(created.metaobjectCreate.userErrors, "metaobjectCreate email_notification default");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
