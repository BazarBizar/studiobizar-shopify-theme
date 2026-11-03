import { buildRedirectMap, normalizePath, type RedirectRow } from "@/lib/redirects";

/**
 * The redirects `proxy.ts` follows, held in memory.
 *
 * Read through the Admin API — the Storefront API has no redirects — with the token that
 * only ever exists on the server; `proxy.ts` is this module's one importer. (No
 * `server-only` import: the proxy is not compiled with the react-server condition that
 * package needs.)
 *
 * Every storefront request looks its address up here, so the list is fetched at most
 * once a minute per server and the lookup itself is a Map read:
 *
 *  - the first request waits for the list, but never longer than `FIRST_LOAD_MS` —
 *    a slow Shopify must not hold the whole site up; it then carries on without;
 *  - after that a stale list is used while a fresh one loads in the background;
 *  - a failed load keeps the list it had.
 *
 * So a redirect saved in the panel works within about a minute.
 */

const TTL_MS = 60_000;
const FIRST_LOAD_MS = 1_500;
/** 20 pages of 250. A store with more needs the Next guide's Bloom-filter setup. */
const MAX_PAGES = 20;

export const REDIRECTS_QUERY = /* GraphQL */ `
  query StorefrontRedirects($after: String) {
    urlRedirects(first: 250, after: $after, sortKey: ID) {
      nodes {
        path
        target
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type Page = { urlRedirects: { nodes: RedirectRow[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

export async function fetchRedirectRows(): Promise<RedirectRow[]> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (!domain || !token) return [];
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  const rows: RedirectRow[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: REDIRECTS_QUERY, variables: { after } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Admin API returned ${response.status}`);
    const body = (await response.json()) as { data?: Page; errors?: { message: string }[] };
    if (!body.data) throw new Error(body.errors?.map((error) => error.message).join("; ") ?? "no data");
    rows.push(...body.data.urlRedirects.nodes);
    if (!body.data.urlRedirects.pageInfo.hasNextPage) break;
    after = body.data.urlRedirects.pageInfo.endCursor;
  }
  return rows;
}

let map: Map<string, string> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;

function refresh(): Promise<void> {
  loading ??= fetchRedirectRows()
    .then((rows) => {
      map = buildRedirectMap(rows);
      loadedAt = Date.now();
    })
    .catch((error: unknown) => {
      // Keep what we had; try again after the next minute rather than on every request.
      loadedAt = Date.now();
      map ??= new Map();
      console.error("[redirects] could not load the redirect list", error);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Where `pathname` should send the visitor, or null. */
export async function findRedirect(pathname: string): Promise<string | null> {
  if (!map) {
    await Promise.race([refresh(), new Promise((resolve) => setTimeout(resolve, FIRST_LOAD_MS))]);
  } else if (Date.now() - loadedAt > TTL_MS) {
    void refresh();
  }
  return map?.get(normalizePath(pathname)) ?? null;
}
