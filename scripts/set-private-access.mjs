/**
 * Takes storefront access away from metaobject types that hold private data.
 *
 *   node --env-file=.env scripts/set-private-access.mjs
 *   node --env-file=.env scripts/set-private-access.mjs --dry-run
 *
 * THE RULE: a type is `PUBLIC_READ` only when the storefront RENDERS it. Everything
 * the site reads through the Admin API — submissions, notification routing — is
 * `NONE`, so the storefront token (which Shopify treats as public) cannot list it and
 * no theme template can print it.
 *
 * `inquiry` was created `PUBLIC_READ` by `schema-push`, which used to give every
 * definition public access. Nothing ever read it that way: `lib/inquiry/*` goes
 * through `adminFetch`. `schema-push` now takes an `access` per definition, but it is
 * additive-only and never changes a definition that exists — hence this script.
 *
 * IDEMPOTENT. A type already at `NONE` is skipped; a type that does not exist in the
 * store is reported and skipped. Only `access.storefront` is sent — fields, entries
 * and admin access are untouched.
 */

const DRY_RUN = process.argv.includes("--dry-run");

/** Every type the storefront must NOT be able to read. */
const PRIVATE_TYPES = ["inquiry", "email_notification", "admin_settings"];

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN.");
  console.error("Run with: node --env-file=.env scripts/set-private-access.mjs");
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

async function main() {
  console.log(`store   ${domain} (${version})`);
  console.log(DRY_RUN ? "mode    dry run — nothing will be sent\n" : "mode    live\n");

  for (const type of PRIVATE_TYPES) {
    const data = await gql(
      `query($type: String!) {
        metaobjectDefinitionByType(type: $type) { id access { storefront } }
      }`,
      { type },
    );

    const definition = data.metaobjectDefinitionByType;
    if (!definition) {
      console.log(`SKIP    ${type}  (no such definition in this store)`);
      continue;
    }

    if (definition.access.storefront === "NONE") {
      console.log(`SKIP    ${type}  (already NONE)`);
      continue;
    }

    console.log(`UPDATE  ${type}  storefront ${definition.access.storefront} -> NONE`);
    if (DRY_RUN) continue;

    const updated = await gql(
      `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          metaobjectDefinition { access { storefront } }
          userErrors { field message code }
        }
      }`,
      { id: definition.id, definition: { access: { storefront: "NONE" } } },
    );

    assertNoUserErrors(updated.metaobjectDefinitionUpdate.userErrors, `metaobjectDefinitionUpdate ${type}`);
    console.log(`        now ${updated.metaobjectDefinitionUpdate.metaobjectDefinition.access.storefront}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
