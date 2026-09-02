/**
 * Read-only inspection. Reports what already exists in the store and how it
 * compares to the definitions in src/definitions/. Never mutates anything.
 */

import { log, c, table } from './logger.js';
import { metaobjectDefinitions } from './definitions/metaobjects.js';
import { metafieldDefinitions, OWNER_TYPES, NAMESPACE } from './definitions/metafields.js';
import { pageDefinitions } from './definitions/pages.js';
import { menuDefinitions } from './definitions/menus.js';
import { fetchExistingMetaobjectDefinitions, indexByType } from './push-metaobjects.js';
import { fetchExistingMetafieldDefinitions } from './push-metafields.js';
import { fetchExistingPages, indexPagesByHandle } from './push-pages.js';
import { fetchExistingMenus, indexMenusByHandle } from './push-menus.js';

const SHOP_QUERY = `query Shop { shop { name myshopifyDomain primaryDomain { url } } }`;
const VERSIONS_QUERY = `query Versions { publicApiVersions { handle supported } }`;

const yes = c.green('yes');
const no = c.grey('no');

/**
 * Confirms the configured API version is one Shopify still serves.
 * Runs on `verify` and before every `push` — a wrong version is the single most
 * confusing failure mode, because it surfaces as a bare HTTP 404.
 */
export async function checkApiVersion(client) {
  try {
    const data = await client.request(VERSIONS_QUERY, {}, { label: 'publicApiVersions' });
    const versions = data.publicApiVersions ?? [];
    const match = versions.find((v) => v.handle === client.apiVersion);
    if (!match) {
      const supported = versions.filter((v) => v.supported).map((v) => v.handle);
      log.warn(
        `API version "${client.apiVersion}" is not in the list Shopify reports. Supported: ${supported.join(', ') || 'unknown'}`
      );
      return false;
    }
    if (!match.supported) {
      log.warn(`API version "${client.apiVersion}" is release-candidate/unsupported.`);
    }
    return true;
  } catch (error) {
    log.dim(`could not check API versions (${error.message.split('\n')[0]})`);
    return true; // Not fatal — the real calls will report their own errors.
  }
}

export async function verify(client) {
  log.step('Store');
  try {
    const data = await client.request(SHOP_QUERY, {}, { label: 'shop' });
    log.info(`${c.bold(data.shop.name)}  ${c.grey(data.shop.myshopifyDomain)}`);
  } catch (error) {
    log.warn(`could not read shop details: ${error.message.split('\n')[0]}`);
  }
  log.info(`API version ${c.bold(client.apiVersion)}`);
  await checkApiVersion(client);

  /* ---------------- Metaobjects ---------------- */
  log.step('Metaobject definitions');
  const existingMetaobjects = await fetchExistingMetaobjectDefinitions(client);
  const byType = indexByType(existingMetaobjects);

  const metaobjectRows = [];
  const missingFieldNotes = [];
  let missingMetaobjects = 0;

  for (const definition of metaobjectDefinitions) {
    const found = byType.get(definition.type);
    if (!found) {
      missingMetaobjects++;
      metaobjectRows.push([
        definition.type,
        c.yellow('MISSING'),
        `0/${definition.fields.length}`,
        definition.publishable ? yes : no,
      ]);
      continue;
    }
    const missing = definition.fields.filter((f) => !found.fieldKeys.has(f.key));
    const present = definition.fields.length - missing.length;
    const status = missing.length ? c.yellow('PARTIAL') : c.green('OK');
    const publishable = found.node.capabilities?.publishable?.enabled;
    metaobjectRows.push([
      definition.type,
      status,
      `${present}/${definition.fields.length}`,
      publishable === undefined ? c.grey('?') : publishable ? yes : no,
    ]);
    if (missing.length) {
      missingFieldNotes.push(`${definition.type}: missing ${missing.map((f) => f.key).join(', ')}`);
    }
  }

  table(['TYPE', 'STATUS', 'FIELDS', 'PUBLISHABLE'], metaobjectRows);
  for (const note of missingFieldNotes) log.dim(note);

  const unmanaged = existingMetaobjects
    .map((n) => n.type)
    .filter((type) => !metaobjectDefinitions.some((d) => d.type === type));
  if (unmanaged.length) {
    log.dim(`other definitions in store (not managed here): ${unmanaged.join(', ')}`);
  }

  /* ---------------- Metafields ---------------- */
  let missingMetafields = 0;

  for (const ownerType of OWNER_TYPES) {
    const expected = metafieldDefinitions.filter((d) => d.ownerType === ownerType);
    if (!expected.length) continue;

    log.step(`Metafield definitions · ${ownerType} · namespace "${NAMESPACE}"`);
    const existing = await fetchExistingMetafieldDefinitions(client, ownerType);
    const byKey = new Map(
      existing.filter((n) => n.namespace === NAMESPACE).map((n) => [n.key, n])
    );

    const rows = [];
    for (const definition of expected) {
      const found = byKey.get(definition.key);
      if (!found) missingMetafields++;
      const actualType = found?.type?.name;
      let status = found ? c.green('OK') : c.yellow('MISSING');
      if (found && actualType && actualType !== definition.type) {
        status = c.red('TYPE MISMATCH');
      }
      rows.push([definition.key, status, actualType ?? definition.type]);
    }
    table(['KEY', 'STATUS', 'TYPE'], rows);

    const extra = [...byKey.keys()].filter((key) => !expected.some((d) => d.key === key));
    if (extra.length) log.dim(`other keys in "${NAMESPACE}": ${extra.join(', ')}`);
  }

  /* ---------------- Pages ---------------- */
  log.step('Pages');
  let missingPages = 0;
  const pageRows = [];
  const existingPages = indexPagesByHandle(await fetchExistingPages(client));

  for (const definition of pageDefinitions) {
    const found = existingPages.get(definition.handle);
    if (!found) {
      missingPages++;
      pageRows.push([definition.handle, c.yellow('MISSING'), definition.templateSuffix ?? c.grey('—')]);
      continue;
    }
    let status = c.green('OK');
    if (found.isPublished === false) status = c.yellow('HIDDEN');
    else if (definition.templateSuffix && found.templateSuffix !== definition.templateSuffix) {
      status = c.yellow('NO TEMPLATE');
    }
    pageRows.push([definition.handle, status, found.templateSuffix ?? c.grey('—')]);
  }
  table(['HANDLE', 'STATUS', 'TEMPLATE'], pageRows);

  /* ---------------- Menus ---------------- */
  log.step('Navigation menus');
  let missingMenus = 0;
  const menuRows = [];
  const existingMenus = indexMenusByHandle(await fetchExistingMenus(client));

  for (const definition of menuDefinitions) {
    const found = existingMenus.get(definition.handle);
    if (!found) {
      missingMenus++;
      menuRows.push([definition.handle, c.yellow('MISSING'), `0/${definition.items.length}`]);
      continue;
    }
    const liveTitles = new Set(
      (found.items ?? []).map((i) => String(i.title ?? '').trim().toLowerCase())
    );
    const present = definition.items.filter((i) => liveTitles.has(i.title.trim().toLowerCase()));
    menuRows.push([
      definition.handle,
      present.length === definition.items.length ? c.green('OK') : c.yellow('PARTIAL'),
      `${present.length}/${definition.items.length}`,
    ]);
  }
  table(['HANDLE', 'STATUS', 'ITEMS'], menuRows);

  const unmanagedMenus = [...existingMenus.keys()].filter(
    (handle) => !menuDefinitions.some((d) => d.handle === handle)
  );
  if (unmanagedMenus.length) {
    log.dim(`other menus in store (not managed here): ${unmanagedMenus.join(', ')}`);
  }

  /* ---------------- Summary ---------------- */
  log.step('Summary');
  const totalMetaobjectFields = metaobjectDefinitions.reduce((n, d) => n + d.fields.length, 0);
  table(
    ['ITEM', 'EXPECTED', 'MISSING'],
    [
      ['metaobject definitions', String(metaobjectDefinitions.length), String(missingMetaobjects)],
      ['metaobject fields', String(totalMetaobjectFields), String(missingFieldNotes.length ? '(see above)' : 0)],
      ['metafield definitions', String(metafieldDefinitions.length), String(missingMetafields)],
      ['pages', String(pageDefinitions.length), String(missingPages)],
      ['navigation menus', String(menuDefinitions.length), String(missingMenus)],
    ]
  );

  const clean =
    missingMetaobjects === 0 &&
    missingMetafields === 0 &&
    missingFieldNotes.length === 0 &&
    missingPages === 0 &&
    missingMenus === 0;
  if (clean) {
    log.blank();
    log.info(c.green('Everything in the schema and navigation is present.'));
  } else {
    log.blank();
    log.info(`Run ${c.bold('node index.js push')} to create what is missing.`);
  }

  return { missingMetaobjects, missingMetafields, missingPages, missingMenus, clean };
}
