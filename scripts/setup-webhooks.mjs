/**
 * Subscribes the storefront to Shopify's change notifications (webhooks), so a change made
 * in Shopify's own admin, an import or an app reaches the live site within a minute instead
 * of within a day (the cache window). See docs/modules/caching.md → "Webhook setup".
 *
 *   yarn setup:webhooks                 check the live address, then subscribe what is missing
 *   yarn setup:webhooks --dry-run       say what it would do; change nothing
 *   yarn setup:webhooks --list          show the subscriptions there are now
 *   yarn setup:webhooks --test          only check the live address and its secret
 *   yarn setup:webhooks --remove        delete this site's subscriptions
 *   … --site https://www.example.com    another address than STOREFRONT_URL
 *
 * Subscribes, through the panel's own Shopify app (the Admin token in .env):
 *   - products and collections: create / update / delete;
 *   - metaobjects of the types the website shows: create / update / delete. Entries that
 *     visitors' forms create (inquiries, messages, newsletter sign-ups) and the panel's own
 *     settings are left out: they are not on a page, so they must not refresh it.
 * Shopify signs these with that app's CLIENT SECRET (API secret key). It must be in
 * SHOPIFY_WEBHOOK_SECRET both here (.env) and on the live site (Vercel env).
 *
 * SAFE BY ORDER. Nothing is subscribed until the live address answers like the webhook
 * route with its secret set, and a test signed with the local secret is accepted. Shopify
 * deletes a subscription whose address keeps failing, so subscribing before the route is
 * deployed would only lose it again.
 *
 * IDEMPOTENT: run it again after adding a new kind of entry to the website; it adds what is
 * missing and brings changed filters up to date. Nothing else in the store is touched.
 */

import { createHmac } from "node:crypto";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const DRY_RUN = flag("--dry-run");
const LIST = flag("--list");
const TEST = flag("--test");
const REMOVE = flag("--remove");

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN in .env.");
  process.exit(1);
}

/** Thrown by `fail`; ends the run with exit code 1 without `process.exit` (which trips a
 *  libuv assertion on Windows while fetch sockets are still closing). */
class Stop extends Error {}

const NAME = "storefront-cache";
const PATH = "/api/webhooks/shopify";

/** Not on any page: created by visitors, or the panel's own settings. */
const SKIPPED_TYPES = new Set(["inquiry", "contact_message", "newsletter_subscriber", "email_notification", "admin_settings"]);

const url = `https://${domain}/admin/api/${version}/graphql.json`;

async function gql(query, variables) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors) {
    fail("Shopify refused the request:", JSON.stringify(body.errors, null, 2));
  }
  return body.data;
}

function fail(...lines) {
  for (const line of lines) console.error(line);
  throw new Stop();
}

/** The address Shopify must call. Shopify does not follow redirects, so resolve them here. */
async function resolveEndpoint() {
  const site = (option("--site") ?? process.env.STOREFRONT_URL ?? "").replace(/\/+$/, "");
  // A local dev server only for --test: Shopify cannot reach it.
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site);
  if (local ? !TEST : !/^https:\/\//.test(site) || /localhost|127\.0\.0\.1/.test(site)) {
    fail("Give the live website's address: --site https://www.example.com (or set STOREFRONT_URL).");
  }
  let endpoint = site + PATH;
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(endpoint, { method: "POST", body: "{}", redirect: "manual" });
    const next = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!next) return endpoint;
    endpoint = new URL(next, endpoint).toString();
    console.log(`  (the site redirects; using ${endpoint})`);
  }
  return endpoint;
}

/** Proves the live route is deployed, has its secret, and that the secret is the local one. */
async function checkEndpoint(endpoint) {
  console.log(`Checking ${endpoint}`);
  const unsigned = await fetch(endpoint, { method: "POST", body: "{}", redirect: "manual" });
  const said = await unsigned.json().catch(() => ({}));
  if (unsigned.status === 404) {
    fail(
      "  ✗ The live site has no webhook address yet (404).",
      "    Deploy this version of the website first, then run this again.",
    );
  }
  if (unsigned.status === 401 && said.message === "Not configured.") {
    fail(
      "  ✗ The live site is missing SHOPIFY_WEBHOOK_SECRET.",
      "    Add it in Vercel → Project → Settings → Environment Variables (Production), redeploy, then run this again.",
    );
  }
  if (unsigned.status !== 401) fail(`  ✗ Unexpected answer to an unsigned call: ${unsigned.status} ${JSON.stringify(said)}`);
  console.log("  ✓ refuses an unsigned call");

  if (!secret) {
    fail(
      "  ✗ SHOPIFY_WEBHOOK_SECRET is not in .env, so the live secret cannot be checked.",
      "    Put the same value in .env as on Vercel: the Admin app's client secret (API secret key).",
    );
  }
  // A topic the route ignores: proves the signature without refreshing anything.
  const body = JSON.stringify({ test: true });
  const signed = await fetch(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": "shop/update",
      "X-Shopify-Hmac-Sha256": createHmac("sha256", secret).update(body).digest("base64"),
    },
    body,
  });
  if (signed.status === 401) {
    fail(
      "  ✗ The live site refused a call signed with the secret in .env: the two secrets differ.",
      "    Use the Admin app's client secret (API secret key) in both places, redeploy, then run this again.",
    );
  }
  if (!signed.ok) fail(`  ✗ Unexpected answer to a signed call: ${signed.status}`);
  console.log("  ✓ accepts a call signed with the secret in .env");
}

async function existingSubscriptions() {
  const all = [];
  let after = null;
  do {
    const data = await gql(
      `query ($after: String) {
        webhookSubscriptions(first: 100, after: $after) {
          nodes { id topic uri filter includeFields name }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after },
    );
    all.push(...data.webhookSubscriptions.nodes);
    after = data.webhookSubscriptions.pageInfo.hasNextPage ? data.webhookSubscriptions.pageInfo.endCursor : null;
  } while (after);
  return all;
}

async function metaobjectTypes() {
  const data = await gql(`{ metaobjectDefinitions(first: 250) { nodes { type } } }`);
  return data.metaobjectDefinitions.nodes
    .map((node) => node.type)
    .filter((type) => !SKIPPED_TYPES.has(type) && !type.startsWith("shopify--") && !type.startsWith("app--"))
    .sort();
}

function wanted(types) {
  const list = [];
  for (const event of ["CREATE", "UPDATE", "DELETE"]) {
    list.push({ topic: `PRODUCTS_${event}`, includeFields: ["id"], filter: "" });
    list.push({ topic: `COLLECTIONS_${event}`, includeFields: ["id"], filter: "" });
    if (types.length) {
      list.push({ topic: `METAOBJECTS_${event}`, includeFields: ["id", "type"], filter: types.map((type) => `type:${type}`).join(" OR ") });
    }
  }
  return list;
}

const sameList = (a = [], b = []) => [...a].sort().join(",") === [...b].sort().join(",");

function printSubscriptions(subscriptions) {
  if (!subscriptions.length) return console.log("  (none)");
  for (const s of subscriptions) {
    console.log(`  ${s.topic.padEnd(20)} → ${s.uri}${s.filter ? `  [${s.filter}]` : ""}`);
  }
}

async function main() {
  if (LIST) {
    console.log("Subscriptions now:");
    printSubscriptions(await existingSubscriptions());
    return;
  }

  const endpoint = await resolveEndpoint();

  if (REMOVE) {
    const mine = (await existingSubscriptions()).filter((s) => s.uri === endpoint);
    console.log(`${DRY_RUN ? "Would remove" : "Removing"} ${mine.length} subscription(s) to ${endpoint}`);
    for (const s of mine) {
      if (DRY_RUN) continue;
      const data = await gql(`mutation ($id: ID!) { webhookSubscriptionDelete(id: $id) { userErrors { message } } }`, { id: s.id });
      const errors = data.webhookSubscriptionDelete.userErrors;
      console.log(`  ${errors.length ? "✗" : "✓"} ${s.topic}${errors.length ? ` — ${errors[0].message}` : ""}`);
    }
    return;
  }

  await checkEndpoint(endpoint);
  if (TEST) return;

  const types = await metaobjectTypes();
  console.log(`Website entry types followed: ${types.join(", ") || "(none)"}`);
  const existing = (await existingSubscriptions()).filter((s) => s.uri === endpoint);
  let changed = 0;

  for (const want of wanted(types)) {
    const have = existing.find((s) => s.topic === want.topic);
    const input = { uri: endpoint, format: "JSON", name: NAME, includeFields: want.includeFields, ...(want.filter ? { filter: want.filter } : {}) };
    if (have && (have.filter ?? "") === want.filter && sameList(have.includeFields, want.includeFields)) {
      console.log(`  = ${want.topic} already there`);
      continue;
    }
    changed += 1;
    if (DRY_RUN) {
      console.log(`  would ${have ? "update" : "add"} ${want.topic}${want.filter ? ` [${want.filter}]` : ""}`);
      continue;
    }
    const data = have
      ? await gql(
          `mutation ($id: ID!, $input: WebhookSubscriptionInput!) {
            webhookSubscriptionUpdate(id: $id, webhookSubscription: $input) { webhookSubscription { id } userErrors { field message } }
          }`,
          { id: have.id, input },
        )
      : await gql(
          `mutation ($topic: WebhookSubscriptionTopic!, $input: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $input) { webhookSubscription { id } userErrors { field message } }
          }`,
          { topic: want.topic, input },
        );
    const result = have ? data.webhookSubscriptionUpdate : data.webhookSubscriptionCreate;
    if (result.userErrors.length) {
      fail(`  ✗ ${want.topic}: ${result.userErrors.map((e) => e.message).join("; ")}`);
    }
    console.log(`  ✓ ${have ? "updated" : "added"} ${want.topic}`);
  }

  console.log(changed ? (DRY_RUN ? `\n${changed} change(s) to make.` : `\nDone: ${changed} change(s).`) : "\nEverything was already set up.");
  if (!DRY_RUN) {
    console.log("Subscriptions to this site now:");
    printSubscriptions((await existingSubscriptions()).filter((s) => s.uri === endpoint));
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  process.exitCode = 1;
}
