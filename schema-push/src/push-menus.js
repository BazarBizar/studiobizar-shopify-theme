/**
 * Creates the navigation menus from definitions/menus.js.
 *
 * Runs last, because every item points at something that has to exist first —
 * a page, a collection, or a shop policy. Resolution mirrors the metaobject
 * reference handling: definitions carry handles, the pusher swaps them for
 * gids, and anything it cannot resolve degrades to a plain HTTP link to the
 * canonical storefront path rather than failing the whole menu.
 *
 * Idempotent and additive:
 *   - a handle that already exists is skipped; its items are never reordered,
 *     retitled or removed.
 *   - the one patch appends items this file declares that the live menu is
 *     missing, matched on title. `--no-patch` turns that off. Because
 *     menuUpdate replaces the whole item list, the existing items are read
 *     back and resent verbatim (ids included) with the new ones appended.
 */

import { formatUserErrors } from './client.js';
import { log, c } from './logger.js';
import { menuDefinitions } from './definitions/menus.js';
import { fetchExistingPages, indexPagesByHandle } from './push-pages.js';

/* ------------------------------------------------------------------ *
 * GraphQL documents
 * ------------------------------------------------------------------ */

const ITEM_FIELDS = 'id title type url resourceId';

const LIST_QUERY = `
  query Menus($first: Int!, $after: String) {
    menus(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        items {
          ${ITEM_FIELDS}
          items {
            ${ITEM_FIELDS}
            items { ${ITEM_FIELDS} }
          }
        }
      }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) {
      menu { id handle title items { id title type url } }
      userErrors { field message }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateMenu($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
      menu { id handle items { id title } }
      userErrors { field message }
    }
  }
`;

const ITEM_TYPES_QUERY = `
  query MenuItemTypes { __type(name: "MenuItemType") { enumValues { name } } }
`;

const SHOP_QUERY = `query ShopUrl { shop { primaryDomain { url } } }`;

const COLLECTION_QUERY = `
  query CollectionByHandle($query: String!) {
    collections(first: 1, query: $query) { nodes { id handle title } }
  }
`;

const POLICIES_QUERY = `query ShopPolicies { shop { shopPolicies { id type body } } }`;

/* ------------------------------------------------------------------ *
 * Reading what already exists
 * ------------------------------------------------------------------ */

export async function fetchExistingMenus(client) {
  return client.paginate(LIST_QUERY, {}, (data) => data.menus, {
    label: 'menus',
    pageSize: 50,
  });
}

/** handle -> node for every menu already in the store. */
export function indexMenusByHandle(nodes) {
  const map = new Map();
  for (const node of nodes) map.set(node.handle, node);
  return map;
}

/* ------------------------------------------------------------------ *
 * Resolving the things items point at
 * ------------------------------------------------------------------ */

/** Canonical policy handles, used only for the HTTP fallback URL. */
const POLICY_PATHS = {
  PRIVACY_POLICY: '/policies/privacy-policy',
  TERMS_OF_SERVICE: '/policies/terms-of-service',
  SHIPPING_POLICY: '/policies/shipping-policy',
  REFUND_POLICY: '/policies/refund-policy',
  SUBSCRIPTION_POLICY: '/policies/subscription-policy',
  LEGAL_NOTICE: '/policies/legal-notice',
  TERMS_OF_SALE: '/policies/terms-of-sale',
  CONTACT_INFORMATION: '/policies/contact-information',
};

/** Storefront path behind a resource-less MenuItemType. */
function pathForType(type) {
  switch (type) {
    case 'COLLECTIONS':
      return '/collections';
    case 'CATALOG':
      return '/collections/all';
    case 'SEARCH':
      return '/search';
    case 'FRONTPAGE':
    default:
      return '/';
  }
}

/** Where an item points when nothing could be resolved to a gid. */
function canonicalPath(item) {
  if (item.url) return item.url;
  if (item.page) return `/pages/${item.page}`;
  if (item.policy) return POLICY_PATHS[item.policy] ?? '/';
  if (item.collection) return `/collections/${item.collection}`;
  return pathForType(item.type);
}

function walkItems(items, visit) {
  for (const item of items ?? []) {
    visit(item);
    walkItems(item.items, visit);
  }
}

/**
 * One round trip per kind of thing the selected menus reference. Everything is
 * looked up up-front so item building stays synchronous.
 */
async function buildContext(client, definitions, pageHandleToGid) {
  const pages = new Map(pageHandleToGid);
  const collections = new Map();
  const policies = new Map();

  const wantedPages = new Set();
  const wantedCollections = new Set();
  const wantedPolicies = new Set();

  for (const definition of definitions) {
    walkItems(definition.items, (item) => {
      if (item.page && !pages.has(item.page)) wantedPages.add(item.page);
      if (item.collection) wantedCollections.add(item.collection);
      if (item.policy) wantedPolicies.add(item.policy);
    });
  }

  /* Pages — one paginated read covers every handle still missing. */
  if (wantedPages.size) {
    log.dim(`resolving page(s): ${[...wantedPages].join(', ')}`);
    const nodes = await fetchExistingPages(client);
    for (const [handle, node] of indexPagesByHandle(nodes)) {
      if (!pages.has(handle)) pages.set(handle, node.id);
    }
  }

  /* Collections — searched by handle, one query each (there are very few). */
  for (const handle of wantedCollections) {
    try {
      const data = await client.request(
        COLLECTION_QUERY,
        { query: `handle:${handle}` },
        { label: `collections(handle:${handle})` }
      );
      const node = data.collections?.nodes?.find((n) => n.handle === handle);
      if (node) collections.set(handle, node.id);
    } catch (error) {
      log.dim(`could not look up collection "${handle}" (${error.message.split('\n')[0]})`);
    }
  }

  /* Shop policies — only usable when the store has actually written one. */
  if (wantedPolicies.size) {
    try {
      const data = await client.request(POLICIES_QUERY, {}, { label: 'shopPolicies' });
      for (const policy of data.shop?.shopPolicies ?? []) {
        if (policy.body && policy.body.trim()) policies.set(policy.type, policy.id);
      }
    } catch (error) {
      // read_legal_policies is not in the documented scope list for this tool,
      // so a rejection here is expected on a minimal app — fall back to pages.
      log.dim(`could not read shop policies (${error.message.split('\n')[0]})`);
    }
  }

  /* Which MenuItemType values this API version actually knows. */
  let supportedTypes = null;
  try {
    const data = await client.request(ITEM_TYPES_QUERY, {}, { label: 'MenuItemType' });
    const values = data.__type?.enumValues?.map((v) => v.name);
    if (values?.length) supportedTypes = new Set(values);
  } catch {
    // Introspection disabled — trust the definitions and let Shopify complain.
  }

  /* Absolute base for HTTP fallbacks; menu URLs must be fully qualified. */
  let storeUrl = `https://${client.shop}`;
  try {
    const data = await client.request(SHOP_QUERY, {}, { label: 'shop' });
    if (data.shop?.primaryDomain?.url) storeUrl = data.shop.primaryDomain.url.replace(/\/$/, '');
  } catch {
    // Keep the myshopify domain — every store answers on it.
  }

  return { pages, collections, policies, supportedTypes, storeUrl };
}

/* ------------------------------------------------------------------ *
 * Item building
 * ------------------------------------------------------------------ */

const supports = (context, type) => !context.supportedTypes || context.supportedTypes.has(type);

/**
 * Turns one definition item into a MenuItemCreateInput.
 * @returns {{ input: object, note: string|null }} `note` explains a fallback.
 */
function buildItemInput(item, context) {
  const children = (item.items ?? []).map((child) => buildItemInput(child, context));
  const nested = children.length ? { items: children.map((c) => c.input) } : {};
  const notes = children.map((c) => c.note).filter(Boolean);
  const withNotes = (input, note) => ({
    input,
    note: [note, ...notes].filter(Boolean).join('; ') || null,
  });

  const httpFallback = (reason) =>
    withNotes(
      {
        title: item.title,
        type: 'HTTP',
        url: `${context.storeUrl}${canonicalPath(item)}`,
        ...nested,
      },
      reason
    );

  if (item.url) {
    return withNotes({ title: item.title, type: 'HTTP', url: item.url, ...nested }, null);
  }

  if (item.policy) {
    const gid = context.policies.get(item.policy);
    if (gid && supports(context, 'SHOP_POLICY')) {
      return withNotes(
        { title: item.title, type: 'SHOP_POLICY', resourceId: gid, ...nested },
        null
      );
    }
    // No policy written (or no access to read them) — fall through to the page.
    if (!item.page) return httpFallback(`${item.title}: no ${item.policy} in the store`);
  }

  if (item.page) {
    const gid = context.pages.get(item.page);
    if (gid && supports(context, 'PAGE')) {
      const note = item.policy ? `${item.title}: linked to /pages/${item.page}, no shop policy written` : null;
      return withNotes({ title: item.title, type: 'PAGE', resourceId: gid, ...nested }, note);
    }
    return httpFallback(`${item.title}: page "${item.page}" not found`);
  }

  if (item.collection) {
    const gid = context.collections.get(item.collection);
    if (gid && supports(context, 'COLLECTION')) {
      return withNotes(
        { title: item.title, type: 'COLLECTION', resourceId: gid, ...nested },
        null
      );
    }
    // The catalogue collection is created by hand in the admin, so on a fresh
    // store it is missing. Point at the whole catalogue instead of writing a
    // link that 404s until someone gets round to it.
    if (item.fallbackType && supports(context, item.fallbackType)) {
      return withNotes(
        { title: item.title, type: item.fallbackType, ...nested },
        `${item.title}: no "${item.collection}" collection — pointed at ${pathForType(item.fallbackType)} for now`
      );
    }
    return httpFallback(`${item.title}: collection "${item.collection}" not found`);
  }

  if (item.type) {
    if (supports(context, item.type)) {
      return withNotes({ title: item.title, type: item.type, ...nested }, null);
    }
    return httpFallback(`${item.title}: ${item.type} unsupported on this API version`);
  }

  return httpFallback(`${item.title}: no destination declared`);
}

/** Existing items have to be resent verbatim, ids and all, on an update. */
function existingItemToInput(node) {
  const input = { id: node.id, title: node.title, type: node.type };
  if (node.resourceId) input.resourceId = node.resourceId;
  if (node.type === 'HTTP' && node.url) input.url = node.url;
  if (node.items?.length) input.items = node.items.map(existingItemToInput);
  return input;
}

const normalise = (title) => String(title ?? '').trim().toLowerCase();

/* ------------------------------------------------------------------ *
 * Push
 * ------------------------------------------------------------------ */

export async function pushMenus(
  client,
  { dryRun = false, only = null, patch = true, pageHandleToGid = new Map() } = {}
) {
  log.step(dryRun ? 'Menus (dry run)' : 'Menus');

  const selected = menuDefinitions.filter((d) => matchesOnly(d, only));
  if (!selected.length) {
    log.dim('nothing selected');
    return [];
  }

  const context = await buildContext(client, selected, pageHandleToGid);
  const existing = indexMenusByHandle(await fetchExistingMenus(client));
  const results = [];

  for (const definition of selected) {
    const label = c.bold(definition.handle);
    const built = definition.items.map((item) => buildItemInput(item, context));
    for (const note of built.map((b) => b.note).filter(Boolean)) log.warn(note);

    const already = existing.get(definition.handle);

    /* ---------------- Already there: append what is missing ---------------- */
    if (already) {
      const liveTitles = new Set((already.items ?? []).map((i) => normalise(i.title)));
      const missing = built.filter((b) => !liveTitles.has(normalise(b.input.title)));

      if (!missing.length) {
        log.result('SKIP', label, `exists · ${already.items?.length ?? 0} items`);
        results.push({ kind: 'menu', label: definition.handle, status: 'skipped' });
        continue;
      }
      if (!patch) {
        log.result('SKIP', label, `exists · ${missing.length} item(s) missing`);
        log.dim('  re-run without --no-patch to append them');
        results.push({ kind: 'menu', label: definition.handle, status: 'skipped' });
        continue;
      }

      const titles = missing.map((b) => b.input.title).join(', ');
      const resultLabel = `${definition.handle} (items)`;

      if (dryRun) {
        log.result('PLAN', label, `append ${titles}`);
        results.push({ kind: 'menu', label: resultLabel, status: 'planned' });
        continue;
      }

      const items = [
        ...(already.items ?? []).map(existingItemToInput),
        ...missing.map((b) => b.input),
      ];

      try {
        const data = await client.request(
          UPDATE_MUTATION,
          { id: already.id, title: already.title, handle: already.handle, items },
          { label: `menuUpdate(${definition.handle})` }
        );
        const payload = data.menuUpdate;
        if (payload.userErrors?.length) {
          const detail = formatUserErrors(payload.userErrors);
          log.result('FAIL', label, '');
          log.error(`         ${detail}`);
          results.push({ kind: 'menu', label: resultLabel, status: 'failed', detail });
          continue;
        }
        log.result('PATCH', label, `appended ${titles}`);
        results.push({ kind: 'menu', label: resultLabel, status: 'patched' });
      } catch (error) {
        log.result('FAIL', label, error.message.split('\n')[0]);
        results.push({ kind: 'menu', label: resultLabel, status: 'failed', detail: error.message });
      }
      continue;
    }

    /* ---------------- Create ---------------- */
    const items = built.map((b) => b.input);
    const summary = items.map((i) => i.title).join(' · ');

    if (dryRun) {
      log.result('PLAN', label, `create ${items.length} items — ${summary}`);
      results.push({ kind: 'menu', label: definition.handle, status: 'planned' });
      continue;
    }

    try {
      const data = await client.request(
        CREATE_MUTATION,
        { title: definition.title, handle: definition.handle, items },
        { label: `menuCreate(${definition.handle})` }
      );
      const payload = data.menuCreate;
      if (payload.userErrors?.length) {
        const detail = formatUserErrors(payload.userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${detail}`);
        results.push({ kind: 'menu', label: definition.handle, status: 'failed', detail });
        continue;
      }
      log.result('CREATE', label, `${items.length} items — ${summary}`);
      results.push({ kind: 'menu', label: definition.handle, status: 'created' });
    } catch (error) {
      log.result('FAIL', label, error.message.split('\n')[0]);
      results.push({
        kind: 'menu',
        label: definition.handle,
        status: 'failed',
        detail: error.message,
      });
    }
  }

  return results;
}

/** `--only` accepts `menus`, `all`, or a specific menu handle. */
function matchesOnly(definition, only) {
  if (!only || !only.length) return true;
  return only.some((token) => token === 'all' || token === 'menus' || token === definition.handle);
}
