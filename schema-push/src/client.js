/**
 * Shopify Admin GraphQL client.
 *
 * Handles the three things that make this API awkward:
 *   1. Cost-based throttling — every response carries `extensions.cost.throttleStatus`.
 *      We read it and pre-emptively slow down before Shopify starts rejecting us.
 *   2. Retries — THROTTLED, HTTP 429 and 5xx are transient; retry with backoff.
 *   3. userErrors — Shopify returns HTTP 200 even when a mutation fails. Those are
 *      handled by the callers, not here (see `checkUserErrors`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log, c } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_API_VERSION = '2026-07';
const MAX_ATTEMPTS = 5;
/** Keep this many cost points in reserve before firing the next request. */
const COST_HEADROOM = 250;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * .env loading (no dotenv dependency)
 * ------------------------------------------------------------------ */

function parseEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let [, key, value] = match;
    value = value.trim();
    // Strip matching quotes; only expand \n inside double quotes, like dotenv does.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      value = value.replace(/\s+#.*$/, '').trim(); // trailing inline comment
    }
    out[key] = value;
  }
  return out;
}

/**
 * Loads `.env` from this folder first, then falls back to the repo root one
 * directory up — the existing project `.env` already holds these credentials,
 * so there is no need to duplicate the token. Real process.env always wins.
 */
export function loadEnv() {
  const candidates = [
    path.join(PROJECT_ROOT, '.env'),
    path.resolve(PROJECT_ROOT, '..', '.env'),
  ];
  const loaded = [];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}

export function readConfig() {
  const loadedFiles = loadEnv();

  const domainRaw = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;

  const missing = [];
  if (!domainRaw) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!token) missing.push('SHOPIFY_ADMIN_API_ACCESS_TOKEN');
  if (missing.length) {
    const where = loadedFiles.length
      ? `Loaded: ${loadedFiles.join(', ')}`
      : 'No .env file found (looked in schema-push/.env and ../.env)';
    throw new Error(
      `Missing required env var(s): ${missing.join(', ')}\n  ${where}\n  Copy .env.example to .env and fill it in.`
    );
  }

  // Accept a bare handle, a full domain, or a pasted URL.
  const domain = domainRaw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
  const shop = domain.includes('.') ? domain : `${domain}.myshopify.com`;

  if (!/^shpat_|^shpca_|^shppa_/.test(token)) {
    log.warn(
      'SHOPIFY_ADMIN_API_ACCESS_TOKEN does not look like an Admin API token (expected shpat_…).'
    );
  }

  return { shop, token, apiVersion, loadedFiles };
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export class GraphQLRequestError extends Error {
  constructor(message, { errors = [], query, variables } = {}) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.errors = errors;
    this.query = query;
    this.variables = variables;
  }
}

/* ------------------------------------------------------------------ *
 * Client
 * ------------------------------------------------------------------ */

export class ShopifyAdminClient {
  constructor({ shop, token, apiVersion, verbose = false }) {
    this.shop = shop;
    this.token = token;
    this.apiVersion = apiVersion;
    this.verbose = verbose;
    this.endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
    this.throttleStatus = null;
    this.requestCount = 0;
  }

  /**
   * Pre-emptive throttle guard. The Admin API refills the bucket at
   * `restoreRate` points/second; if we're low, wait just long enough to get
   * back above the headroom instead of eating a THROTTLED error.
   */
  async #respectThrottle() {
    const status = this.throttleStatus;
    if (!status) return;
    const { currentlyAvailable, restoreRate, maximumAvailable } = status;
    if (!restoreRate) return;
    const floor = Math.min(COST_HEADROOM, Math.floor((maximumAvailable ?? 1000) * 0.25));
    if (currentlyAvailable >= floor) return;
    const waitMs = Math.ceil(((floor - currentlyAvailable) / restoreRate) * 1000);
    const capped = Math.min(waitMs, 10_000);
    log.result('WAIT', `throttle headroom low (${currentlyAvailable} pts)`, `sleeping ${capped}ms`);
    await sleep(capped);
    // Assume the bucket refilled so we don't sleep again on the next call.
    this.throttleStatus = { ...status, currentlyAvailable: floor };
  }

  #recordCost(extensions) {
    const status = extensions?.cost?.throttleStatus;
    if (status) this.throttleStatus = status;
    if (this.verbose && extensions?.cost) {
      const { actualQueryCost, throttleStatus } = extensions.cost;
      log.dim(
        `cost ${actualQueryCost} · available ${throttleStatus?.currentlyAvailable}/${throttleStatus?.maximumAvailable}`
      );
    }
  }

  /**
   * Executes a GraphQL document and returns `data`.
   * Throws GraphQLRequestError for top-level `errors`; `userErrors` are left to callers.
   */
  async request(query, variables = {}, { label = 'graphql' } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.#respectThrottle();

      let response;
      try {
        this.requestCount++;
        response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.token,
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch (networkError) {
        // DNS / socket / TLS failures are worth retrying.
        lastError = networkError;
        await this.#backoff(attempt, `network error (${networkError.message})`, label);
        continue;
      }

      // 401/403 are configuration problems — retrying will never help.
      if (response.status === 401 || response.status === 403) {
        const body = await response.text().catch(() => '');
        throw new GraphQLRequestError(
          `HTTP ${response.status} from Shopify — the access token was rejected.\n` +
            `  Check SHOPIFY_ADMIN_API_ACCESS_TOKEN and that the custom app has the required scopes\n` +
            `  (write_metaobject_definitions, write_products, write_content).\n  ${body.slice(0, 300)}`
        );
      }

      if (response.status === 404) {
        throw new GraphQLRequestError(
          `HTTP 404 for ${this.endpoint}\n` +
            `  Either the shop domain is wrong or API version "${this.apiVersion}" does not exist.`
        );
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null;
        await this.#backoff(attempt, 'HTTP 429 (rate limited)', label, waitMs);
        continue;
      }

      if (response.status >= 500) {
        await this.#backoff(attempt, `HTTP ${response.status} (server error)`, label);
        continue;
      }

      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new GraphQLRequestError(
          `Non-JSON response (HTTP ${response.status}): ${text.slice(0, 300)}`
        );
      }

      this.#recordCost(json.extensions);

      if (json.errors?.length) {
        const throttled = json.errors.some((e) => e.extensions?.code === 'THROTTLED');
        if (throttled) {
          // Wait until the bucket has refilled enough to cover the query cost.
          const cost = json.extensions?.cost;
          const need = cost?.requestedQueryCost ?? 100;
          const status = cost?.throttleStatus;
          const waitMs = status?.restoreRate
            ? Math.ceil(((need - status.currentlyAvailable) / status.restoreRate) * 1000)
            : null;
          await this.#backoff(attempt, 'THROTTLED', label, waitMs && waitMs > 0 ? waitMs : null);
          continue;
        }
        const messages = json.errors.map((e) => `- ${e.message}`).join('\n  ');
        throw new GraphQLRequestError(`GraphQL error on ${label}:\n  ${messages}`, {
          errors: json.errors,
          query,
          variables,
        });
      }

      if (!json.data) {
        throw new GraphQLRequestError(`Empty response data on ${label}`, { query, variables });
      }

      return json.data;
    }

    throw new GraphQLRequestError(
      `Giving up on ${label} after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message ?? 'unknown'}`
    );
  }

  async #backoff(attempt, reason, label, explicitMs = null) {
    if (attempt >= MAX_ATTEMPTS) return;
    // Exponential backoff with jitter, unless Shopify told us exactly how long to wait.
    const base = explicitMs ?? Math.min(2 ** (attempt - 1) * 500, 8000);
    const waitMs = Math.min(Math.round(base + Math.random() * 250), 15_000);
    log.result('WAIT', `${label}: ${reason}`, `retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`);
    await sleep(waitMs);
  }

  /** Paginate a connection. `pick` returns `{ nodes, pageInfo }` from the data. */
  async paginate(query, variables, pick, { label = 'graphql', pageSize = 50 } = {}) {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 50; page++) {
      const data = await this.request(query, { ...variables, first: pageSize, after: cursor }, { label });
      const { nodes = [], pageInfo } = pick(data) ?? {};
      all.push(...nodes);
      if (!pageInfo?.hasNextPage) break;
      cursor = pageInfo.endCursor;
    }
    return all;
  }
}

/* ------------------------------------------------------------------ *
 * userErrors helper
 * ------------------------------------------------------------------ */

/**
 * Shopify returns HTTP 200 with a populated `userErrors` array when a mutation
 * is rejected. Format them so `field` and `message` are both visible.
 */
export function formatUserErrors(userErrors) {
  return userErrors
    .map((e) => {
      const field = Array.isArray(e.field) ? e.field.join('.') : e.field;
      const code = e.code ? c.grey(` [${e.code}]`) : '';
      return field ? `${c.yellow(field)}: ${e.message}${code}` : `${e.message}${code}`;
    })
    .join('\n           ');
}

export { DEFAULT_API_VERSION };
