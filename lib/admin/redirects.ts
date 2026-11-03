import "server-only";

import { z } from "zod";

import { BUILDER_METAFIELDS, parsePageDocument } from "@/lib/page-builder/document";
import { APP_ROUTE_SEGMENTS, isBuilderHandle } from "@/lib/page-builder/handles";
import {
  redirectSourceProblem,
  redirectSources,
  redirectTarget,
  redirectTargetProblem,
  normalizePath,
} from "@/lib/redirects";
import { LEGAL_HANDLES } from "@/lib/routes";
import { getCollection, getMetaobject, getPage, getProduct, METAOBJECT_TYPES } from "@/lib/shopify";
import { toMetafieldMap } from "@/lib/shopify/transforms";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Website → Redirects: Shopify's URL redirects, read and written for the panel. What the
 * storefront does with them is in `lib/redirects.ts` and `proxy.ts`.
 *
 * Two rules keep a redirect from hiding a page, because the proxy follows a redirect
 * whether or not something now lives at its address:
 *
 *  - a redirect FROM an address that shows a page is refused (`liveAddress`);
 *  - when something new takes an address — a page, product or collection created or
 *    given that handle — redirects from it are removed (`releaseAddress`).
 */

export class RedirectError extends Error {
  readonly code = "INVALID" as const;
  constructor(message: string) {
    super(message);
    this.name = "RedirectError";
  }
}

type UserError = { field?: string[] | null; message: string; code?: string | null };
type Raw = { id: string; path: string; target: string; createdAt?: string };

export type RedirectView = {
  id: string;
  /** As stored in Shopify, e.g. `/products/old-chair`. */
  path: string;
  target: string;
  /** Where it answers and sends on this site: `/shop/old-chair` → `/shop/new-chair`. */
  from: string;
  to: string;
  createdAt: string | null;
};

const toView = (row: Raw): RedirectView => ({
  id: row.id,
  path: row.path,
  target: row.target,
  from: redirectSources(row.path).at(-1) ?? row.path,
  to: redirectTarget(row.target),
  createdAt: row.createdAt ?? null,
});

/** Every redirect, newest first. A store with thousands gets its newest 2,500. */
export async function listRedirects(): Promise<RedirectView[]> {
  const rows: Raw[] = [];
  let after: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const data: {
      urlRedirects: { nodes: Raw[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    } = await adminGraphQL("urlRedirects", OPERATIONS.urlRedirects.document, { after });
    rows.push(...data.urlRedirects.nodes);
    if (!data.urlRedirects.pageInfo.hasNextPage) break;
    after = data.urlRedirects.pageInfo.endCursor;
  }
  return rows.map(toView);
}

/** Shopify search for the redirects stored under any of these paths. */
const pathQuery = (paths: string[]) => paths.map((path) => `path:'${path.replace(/'/g, "\\'")}'`).join(" OR ");

/**
 * The spellings a redirect FROM this site's address may be stored under: the address
 * itself, and Shopify's own path for the same thing (`/shop/x` ↔ `/products/x`).
 */
function storedSpellings(path: string): string[] {
  const [, first, second] = path.split("/");
  const shopify =
    first === "shop" && second
      ? `/products/${second}`
      : first && !second && !(APP_ROUTE_SEGMENTS as readonly string[]).includes(first)
        ? `/pages/${first}`
        : null;
  return shopify ? [path, shopify] : [path];
}

async function redirectsFrom(path: string): Promise<Raw[]> {
  const data = await adminGraphQL<{ urlRedirects: { nodes: Raw[] } }>("urlRedirectsAt", OPERATIONS.urlRedirectsAt.document, {
    query: pathQuery(storedSpellings(path)),
  });
  // Shopify's search is loose; keep only the ones that really answer on this address.
  return data.urlRedirects.nodes.filter((row) => redirectSources(row.path).includes(path));
}

/** What a visitor sees at this address today, in words — or null when nothing is there. */
export async function liveAddress(path: string): Promise<string | null> {
  const [first, second, third] = path.split("/").filter(Boolean);
  if (!first) return "the home page";
  if (third) return null;

  if (!second) {
    if ((APP_ROUTE_SEGMENTS as readonly string[]).includes(first)) return `the “/${first}” page`;
    if (!isBuilderHandle(first)) return null;
    const page = await getPage(first).catch(() => null);
    const document = page ? toMetafieldMap(page.metafields)[BUILDER_METAFIELDS.published]?.value : undefined;
    const parsed = parsePageDocument(document);
    return parsed.ok || parsed.reason !== "absent" ? `the page “${page?.title ?? first}”` : null;
  }

  if (first === "shop") {
    const product = await getProduct(second).catch(() => null);
    return product ? `the product “${product.title}”` : null;
  }
  if (first === "collections") {
    const collection = await getCollection(second).catch(() => null);
    return collection ? `the collection “${collection.title}”` : null;
  }
  if (first === "projects" || first === "designers") {
    const type = first === "projects" ? METAOBJECT_TYPES.project : METAOBJECT_TYPES.designer;
    const entry = await getMetaobject(type, second).catch(() => null);
    return entry ? `the ${first === "projects" ? "project" : "designer"} page “${second}”` : null;
  }
  if (first === "legal") return (LEGAL_HANDLES as readonly string[]).includes(second) ? "a legal page" : null;
  return null;
}

export const redirectInput = z.strictObject({
  from: z.string().max(2048),
  to: z.string().max(2048),
});

export async function createRedirect(input: z.infer<typeof redirectInput>): Promise<RedirectView> {
  const sourceProblem = redirectSourceProblem(input.from);
  if (sourceProblem) throw new RedirectError(sourceProblem);
  const targetProblem = redirectTargetProblem(input.to);
  if (targetProblem) throw new RedirectError(targetProblem);

  const from = normalizePath(input.from);
  const to = input.to.trim();
  if (to.startsWith("/") && normalizePath(to) === from) throw new RedirectError("The old and the new address are the same.");

  const live = await liveAddress(from);
  if (live) {
    throw new RedirectError(
      `“${from}” still shows ${live}. A redirect would hide it — change that page’s address first, or choose another old address.`,
    );
  }
  if ((await redirectsFrom(from)).length) throw new RedirectError(`“${from}” already has a redirect. Delete that one first.`);
  // Two redirects pointing at each other would send visitors round in a circle.
  if (to.startsWith("/") && (await redirectsFrom(normalizePath(to))).some((row) => normalizePath(redirectTarget(row.target)) === from)) {
    throw new RedirectError(`“${normalizePath(to)}” already redirects to “${from}”, so visitors would go round in a circle.`);
  }

  const data = await adminGraphQL<{ urlRedirectCreate: { urlRedirect: Raw | null; userErrors: UserError[] } }>(
    "urlRedirectCreate",
    OPERATIONS.urlRedirectCreate.document,
    { urlRedirect: { path: from, target: to } },
  );
  assertNoUserErrors(data.urlRedirectCreate.userErrors);
  return toView(data.urlRedirectCreate.urlRedirect!);
}

export async function deleteRedirect(id: string) {
  const data = await adminGraphQL<{ urlRedirectDelete: { userErrors: UserError[] } }>(
    "urlRedirectDelete",
    OPERATIONS.urlRedirectDelete.document,
    { id },
  );
  assertNoUserErrors(data.urlRedirectDelete.userErrors);
}

/**
 * Something now lives at `route` (a page, product or collection was created there, or
 * given that handle): redirects away from it would hide it, so they go. Best effort —
 * the write that called this has already succeeded and must not be failed by it.
 */
export async function releaseAddress(route: string): Promise<number> {
  try {
    const rows = await redirectsFrom(normalizePath(route));
    for (const row of rows) await deleteRedirect(row.id);
    return rows.length;
  } catch (error) {
    console.error(`[redirects] could not clear redirects from ${route}`, error);
    return 0;
  }
}
