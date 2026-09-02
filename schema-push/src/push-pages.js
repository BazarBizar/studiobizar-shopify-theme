/**
 * Creates the Online Store pages from definitions/pages.js.
 *
 * Runs before the menus, because a PAGE menu item needs the page's gid. The
 * `handleToGid` map this returns is handed to pushMenus; a menus-only run looks
 * the handles up in the store instead, so `push --only=menus` still works once
 * the pages exist.
 *
 * Idempotent and additive:
 *   - a handle that already exists is skipped, never rewritten. Title, body and
 *     published state of an existing page are left exactly as they are.
 *   - the one patch is `templateSuffix`, and only when the existing page has
 *     none. That changes which template renders the page, not its content, and
 *     it is what makes /pages/projects show the project list. A page carrying a
 *     different suffix is reported and left alone.
 */

import { formatUserErrors } from './client.js';
import { log, c } from './logger.js';
import { pageDefinitions } from './definitions/pages.js';

/* ------------------------------------------------------------------ *
 * GraphQL documents
 * ------------------------------------------------------------------ */

const LIST_QUERY = `
  query Pages($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id title handle templateSuffix isPublished }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreatePage($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id title handle templateSuffix }
      userErrors { field message code }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
    pageUpdate(id: $id, page: $page) {
      page { id handle templateSuffix }
      userErrors { field message code }
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Reading what already exists
 * ------------------------------------------------------------------ */

export async function fetchExistingPages(client) {
  return client.paginate(LIST_QUERY, {}, (data) => data.pages, {
    label: 'pages',
    pageSize: 100,
  });
}

/** handle -> node for every page already in the store. */
export function indexPagesByHandle(nodes) {
  const map = new Map();
  for (const node of nodes) map.set(node.handle, node);
  return map;
}

/* ------------------------------------------------------------------ *
 * Push
 * ------------------------------------------------------------------ */

/**
 * @returns {Promise<{ results: Array, handleToGid: Map<string,string> }>}
 */
export async function pushPages(client, { dryRun = false, only = null, patch = true } = {}) {
  log.step(dryRun ? 'Pages (dry run)' : 'Pages');

  const existingNodes = await fetchExistingPages(client);
  const existing = indexPagesByHandle(existingNodes);

  // Seed with everything in the store so the menu pusher can resolve links to
  // pages this run skipped, or pages someone created by hand in the admin.
  const handleToGid = new Map();
  for (const [handle, node] of existing) handleToGid.set(handle, node.id);

  const selected = pageDefinitions.filter((d) => matchesOnly(d, only));
  if (!selected.length) {
    log.dim('nothing selected');
    return { results: [], handleToGid };
  }

  const results = [];
  /** templateSuffix additions for pages that already exist. */
  const suffixPatches = [];

  for (const definition of selected) {
    const label = c.bold(definition.handle);
    const already = existing.get(definition.handle);

    if (already) {
      log.result('SKIP', label, already.isPublished === false ? 'exists, hidden' : 'exists');
      results.push({ kind: 'page', label: definition.handle, status: 'skipped' });

      if (already.isPublished === false) {
        log.dim('  page is hidden — publish it in the admin or the nav link 404s');
      }
      if (definition.templateSuffix && already.templateSuffix !== definition.templateSuffix) {
        if (already.templateSuffix) {
          log.dim(
            `  template "${already.templateSuffix}" kept (wanted "${definition.templateSuffix}") — change it by hand`
          );
        } else if (patch) {
          suffixPatches.push({ definition, id: already.id });
        } else {
          log.dim(
            `  no template assigned; re-run without --no-patch to set "${definition.templateSuffix}"`
          );
        }
      }
      continue;
    }

    const input = {
      title: definition.title,
      handle: definition.handle,
      isPublished: true,
    };
    if (definition.body) input.body = definition.body;
    if (definition.templateSuffix) input.templateSuffix = definition.templateSuffix;

    if (dryRun) {
      const suffix = definition.templateSuffix ? ` · template ${definition.templateSuffix}` : '';
      log.result('PLAN', label, `create "${definition.title}"${suffix}`);
      results.push({ kind: 'page', label: definition.handle, status: 'planned' });
      handleToGid.set(definition.handle, `gid://shopify/Page/DRY-${definition.handle}`);
      continue;
    }

    try {
      const data = await client.request(
        CREATE_MUTATION,
        { page: input },
        { label: `pageCreate(${definition.handle})` }
      );
      const payload = data.pageCreate;
      const userErrors = payload.userErrors ?? [];

      if (userErrors.length) {
        // Handle taken by a page the list query did not return — a concurrent
        // run, or a page created between the read and the write.
        if (userErrors.every((e) => e.code === 'TAKEN')) {
          log.result('SKIP', label, 'exists (reported by Shopify)');
          results.push({ kind: 'page', label: definition.handle, status: 'skipped' });
          continue;
        }
        const detail = formatUserErrors(userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${detail}`);
        results.push({ kind: 'page', label: definition.handle, status: 'failed', detail });
        continue;
      }

      const created = payload.page;
      handleToGid.set(created.handle, created.id);
      const suffix = created.templateSuffix ? ` · template ${created.templateSuffix}` : '';
      log.result('CREATE', label, `/pages/${created.handle}${suffix}`);
      results.push({ kind: 'page', label: definition.handle, status: 'created' });
    } catch (error) {
      log.result('FAIL', label, error.message.split('\n')[0]);
      results.push({
        kind: 'page',
        label: definition.handle,
        status: 'failed',
        detail: error.message,
      });
    }
  }

  /* ---------------- Template suffix reconciliation ---------------- */
  if (suffixPatches.length) {
    log.blank();
    log.group('templates');
  }

  for (const item of suffixPatches) {
    const label = c.bold(item.definition.handle);
    const resultLabel = `${item.definition.handle} (template)`;

    if (dryRun) {
      log.result('PLAN', label, `assign template ${item.definition.templateSuffix}`);
      results.push({ kind: 'page', label: resultLabel, status: 'planned' });
      continue;
    }

    try {
      const data = await client.request(
        UPDATE_MUTATION,
        { id: item.id, page: { templateSuffix: item.definition.templateSuffix } },
        { label: `pageUpdate(${item.definition.handle} template)` }
      );
      const payload = data.pageUpdate;
      if (payload.userErrors?.length) {
        const detail = formatUserErrors(payload.userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${detail}`);
        results.push({ kind: 'page', label: resultLabel, status: 'failed', detail });
        continue;
      }
      log.result('PATCH', label, `template ${item.definition.templateSuffix}`);
      results.push({ kind: 'page', label: resultLabel, status: 'patched' });
    } catch (error) {
      log.result('FAIL', label, error.message.split('\n')[0]);
      results.push({ kind: 'page', label: resultLabel, status: 'failed', detail: error.message });
    }
  }

  return { results, handleToGid };
}

/** `--only` accepts `pages`, `all`, or a specific page handle. */
function matchesOnly(definition, only) {
  if (!only || !only.length) return true;
  return only.some((token) => token === 'all' || token === 'pages' || token === definition.handle);
}
