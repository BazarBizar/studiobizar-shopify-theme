#!/usr/bin/env node
/**
 * schema-push — provisions the Studio Bizar schema (metaobject and metafield
 * definitions) plus the storefront navigation it hangs off (pages and menus)
 * on a Shopify store through the Admin GraphQL API.
 *
 *   node index.js verify                  inspect the store, change nothing
 *   node index.js push --dry-run          print the plan, change nothing
 *   node index.js push                    create everything that is missing
 *   node index.js push --only=metaobjects
 *   node index.js push --only=metafields
 *   node index.js push --only=pages
 *   node index.js push --only=menus
 *   node index.js push --only=designer
 *
 * The script is additive only. It never updates or deletes an existing
 * definition, page or menu item, so re-running it is safe.
 */

import { ShopifyAdminClient, readConfig, GraphQLRequestError } from './src/client.js';
import { log, c, table } from './src/logger.js';
import { pushMetaobjects } from './src/push-metaobjects.js';
import { pushMetafields } from './src/push-metafields.js';
import { pushPages } from './src/push-pages.js';
import { pushMenus } from './src/push-menus.js';
import { verify, checkApiVersion } from './src/verify.js';
import { metaobjectDefinitions } from './src/definitions/metaobjects.js';
import { metafieldDefinitions } from './src/definitions/metafields.js';
import { pageDefinitions } from './src/definitions/pages.js';
import { menuDefinitions } from './src/definitions/menus.js';

const HELP = `
${c.bold('schema-push')} — Shopify schema bootstrap for Studio Bizar

${c.bold('Usage')}
  node index.js verify                   List what already exists. Read-only.
  node index.js push [options]           Create missing definitions.

${c.bold('Options')}
  --dry-run          Print the plan without calling any mutation.
  --only=<targets>   Comma-separated. Accepts:
                       metaobjects | metafields | pages | menus
                       a metaobject type      (designer, project, faq_item, ...)
                       an owner type          (product, collection, page)
                       a metafield key        (designer, hero_image, ...)
                       a qualified key        (product.designer)
                       a page handle          (our-story, faq, contact, ...)
                       a menu handle          (desk-primary, desk-footer-legal)
                     A bare name matches both a metaobject type and a
                     metafield key, so --only=designer pushes both.
  --no-pin           Do not pin new metafield definitions in the admin UI.
  --no-patch         Do not add missing fields to definitions that already
                     exist, missing items to menus that already exist, or a
                     template to a page that has none. (Nothing that is
                     already set is ever modified either way.)
  --verbose          Log GraphQL cost and throttle status per request.
  -h, --help         This text.

${c.bold('Environment')} (schema-push/.env, falling back to ../.env)
  SHOPIFY_STORE_DOMAIN             e.g. studio-bizar-be.myshopify.com
  SHOPIFY_ADMIN_API_ACCESS_TOKEN   shpat_...
  SHOPIFY_API_VERSION              defaults to 2026-07
`;

/* `--only` token classification, so a whole phase is skipped when nothing matches. */
const isMetaobjectToken = (token) => metaobjectDefinitions.some((d) => d.type === token);
const isMetafieldToken = (token) =>
  metafieldDefinitions.some(
    (d) =>
      d.key === token ||
      d.ownerType.toLowerCase() === token ||
      `${d.ownerType.toLowerCase()}.${d.key}` === token
  );
const isPageToken = (token) => pageDefinitions.some((d) => d.handle === token);
const isMenuToken = (token) => menuDefinitions.some((d) => d.handle === token);

function parseArgs(argv) {
  const options = {
    command: null,
    dryRun: false,
    only: null,
    pin: true,
    patch: true,
    verbose: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--dry-run' || arg === '--dryrun') options.dryRun = true;
    else if (arg === '--no-pin') options.pin = false;
    else if (arg === '--no-patch') options.patch = false;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg.startsWith('--only=')) {
      options.only = arg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg === '--only') {
      throw new Error('--only needs a value, e.g. --only=metaobjects');
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.command) {
      options.command = arg.toLowerCase();
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return options;
}

function printSummary(results, dryRun) {
  const counts = { created: 0, patched: 0, skipped: 0, planned: 0, failed: 0 };
  for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;

  log.step('Summary');
  const rows = [[dryRun ? 'planned' : 'created', String(dryRun ? counts.planned : counts.created)]];
  if (!dryRun) rows.push(['fields added', String(counts.patched)]);
  rows.push(['skipped (already existed)', String(counts.skipped)]);
  rows.push(['failed', counts.failed ? c.red(String(counts.failed)) : '0']);
  table(['RESULT', 'COUNT'], rows);

  if (counts.failed) {
    log.blank();
    log.group(c.red('Failures'));
    for (const result of results.filter((r) => r.status === 'failed')) {
      log.error(`${result.label}${result.detail ? ` — ${result.detail.split('\n')[0]}` : ''}`);
    }
  }
  return counts.failed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return 0;
  }
  if (!options.command) {
    console.log(HELP);
    return 1;
  }
  if (options.command !== 'verify' && options.command !== 'push') {
    log.error(`Unknown command "${options.command}". Use verify or push.`);
    console.log(HELP);
    return 1;
  }

  const config = readConfig();
  const client = new ShopifyAdminClient({ ...config, verbose: options.verbose });

  log.info(
    `${c.grey('shop')} ${c.bold(config.shop)}  ${c.grey('api')} ${c.bold(config.apiVersion)}` +
      (config.loadedFiles.length ? `  ${c.grey('env')} ${config.loadedFiles.join(', ')}` : '')
  );

  if (options.command === 'verify') {
    await verify(client);
    log.blank();
    log.dim(`${client.requestCount} GraphQL requests`);
    return 0;
  }

  if (options.dryRun) {
    log.blank();
    log.info(c.magenta('DRY RUN — no mutations will be sent.'));
  }

  await checkApiVersion(client);

  const only = options.only;
  const wantsMetaobjects =
    !only || only.some((t) => t === 'all' || t === 'metaobjects' || isMetaobjectToken(t));
  const wantsMetafields =
    !only || only.some((t) => t === 'all' || t === 'metafields' || isMetafieldToken(t));
  const wantsPages = !only || only.some((t) => t === 'all' || t === 'pages' || isPageToken(t));
  const wantsMenus = !only || only.some((t) => t === 'all' || t === 'menus' || isMenuToken(t));

  if (!wantsMetaobjects && !wantsMetafields && !wantsPages && !wantsMenus) {
    log.blank();
    log.error(`--only=${only.join(',')} matched nothing. See --help for valid targets.`);
    return 1;
  }

  const results = [];
  let typeToGid = new Map();
  let pageHandleToGid = new Map();

  if (wantsMetaobjects) {
    const outcome = await pushMetaobjects(client, {
      dryRun: options.dryRun,
      only,
      patch: options.patch,
    });
    results.push(...outcome.results);
    typeToGid = outcome.typeToGid;
  }

  if (wantsMetafields) {
    const metafieldResults = await pushMetafields(client, {
      dryRun: options.dryRun,
      only,
      typeToGid,
      pin: options.pin,
    });
    results.push(...metafieldResults);
  }

  // Pages before menus: a PAGE menu item needs the page gid, the same way a
  // metaobject_reference metafield needs the metaobject definition gid.
  if (wantsPages) {
    const outcome = await pushPages(client, {
      dryRun: options.dryRun,
      only,
      patch: options.patch,
    });
    results.push(...outcome.results);
    pageHandleToGid = outcome.handleToGid;
  }

  if (wantsMenus) {
    const menuResults = await pushMenus(client, {
      dryRun: options.dryRun,
      only,
      patch: options.patch,
      pageHandleToGid,
    });
    results.push(...menuResults);
  }

  const failed = printSummary(results, options.dryRun);
  log.blank();
  log.dim(`${client.requestCount} GraphQL requests`);

  if (!failed && !options.dryRun) {
    log.blank();
    log.info(`Run ${c.bold('node index.js verify')} to confirm the result in the store.`);
  }

  return failed ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    log.blank();
    if (error instanceof GraphQLRequestError) {
      log.error(error.message);
    } else {
      log.error(error.message || String(error));
      if (process.env.DEBUG) console.error(error);
    }
    process.exitCode = 1;
  });
