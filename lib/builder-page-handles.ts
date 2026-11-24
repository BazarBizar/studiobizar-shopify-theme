import { isBuilderHandle } from "@/lib/page-builder/handle-rules";

/**
 * The page builder pages Shopify publishes, held in memory for `proxy.ts`.
 *
 * WHY THE PROXY NEEDS THEM. `/<handle>` is the builder's route, and a dynamic segment
 * there matches EVERY one-segment address: `/wp-login`, `/cart`, `/backup`, anything a
 * scanner or a typo produces. Each one used to be rendered and stored as its own cached
 * 404 — an unbounded set of cache writes, paid for by bots. With this list the proxy
 * sends an address that is no published page to ONE shared not-found page instead.
 *
 * Same shape as `lib/redirect-map.ts`:
 *  - loaded at most once a minute per server, never holding a request longer than
 *    `FIRST_LOAD_MS`;
 *  - a stale list is used while a fresh one loads;
 *  - an address not on the list reloads it first (at most every `MISS_RELOAD_MS`), so a
 *    page published a moment ago is found without waiting out the minute;
 *  - UNKNOWN IS NOT NO: until a list has loaded, or when Shopify cannot be reached,
 *    `isPublishedBuilderPage` answers null and the proxy lets the request through to
 *    the route, exactly as before. A Shopify hiccup can never 404 a real page.
 *
 * Storefront API, so it lists exactly the pages a visitor can see. (No `server-only`:
 * the proxy is not compiled with the react-server condition.)
 */

const TTL_MS = 60_000;
const MISS_RELOAD_MS = 10_000;
const FIRST_LOAD_MS = 1_500;
/** 10 pages of 250 — far beyond any real store's page count. */
const MAX_PAGES = 10;

const QUERY = /* GraphQL */ `
  query BuilderPageHandles($after: String) {
    pages(first: 250, after: $after) {
      nodes {
        handle
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type Page = { pages: { nodes: { handle: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

async function fetchHandles(): Promise<Set<string>> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) throw new Error("Storefront API is not configured");
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  const handles = new Set<string>();
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
      body: JSON.stringify({ query: QUERY, variables: { after } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Storefront API returned ${response.status}`);
    const body = (await response.json()) as { data?: Page; errors?: { message: string }[] };
    if (!body.data) throw new Error(body.errors?.map((error) => error.message).join("; ") ?? "no data");
    for (const node of body.data.pages.nodes) if (isBuilderHandle(node.handle)) handles.add(node.handle);
    if (!body.data.pages.pageInfo.hasNextPage) break;
    after = body.data.pages.pageInfo.endCursor;
  }
  return handles;
}

let handles: Set<string> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;

function refresh(): Promise<void> {
  loading ??= fetchHandles()
    .then((fresh) => {
      handles = fresh;
      loadedAt = Date.now();
    })
    .catch((error: unknown) => {
      // Keep what we had (or nothing, which means "let everything through").
      loadedAt = Date.now();
      console.error("[builder-pages] could not load the published page list", error);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function settle(promise: Promise<void>): Promise<unknown> {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, FIRST_LOAD_MS))]);
}

/**
 * Whether `/<handle>` is a page builder page Shopify publishes: true, false, or null
 * when that is not known (no list yet) — null must be treated as "let it through".
 */
export async function isPublishedBuilderPage(handle: string): Promise<boolean | null> {
  if (!handles) {
    await settle(refresh());
  } else if (Date.now() - loadedAt > TTL_MS) {
    void refresh();
  }
  if (!handles) return null;
  if (handles.has(handle)) return true;

  // Not on the list: it may have been published since. Look again, rate-limited, so a
  // bot walking random addresses costs one Shopify call per ten seconds at most.
  if (Date.now() - loadedAt > MISS_RELOAD_MS) await settle(refresh());
  return handles.has(handle);
}
