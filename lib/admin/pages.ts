import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";
import { METAFIELD_NAMESPACE } from "@/lib/shopify/constants";

/**
 * Online Store pages.
 *
 * WHY THIS SCREEN EXISTS. Fifteen of the twenty-three public routes read a page,
 * and almost everything they render lives in that page's METAFIELDS rather than
 * its body — the landing page's hero slides, New In, Monthly Selection and story
 * image are all PAGE metafields on `home`. Until this existed, changing any of
 * them meant leaving the panel for the Shopify admin, which is the one thing the
 * panel is for.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. There is no create and no delete. A page is
 * created by `schema-push`, which also gives it the template suffix that decides
 * which route renders it; a page made here would have no suffix and no route, so
 * the button would produce a page nobody can reach. Deleting one breaks whichever
 * route reads it — `getPage(handle)` returns null and the route degrades or 404s.
 * Both belong with the tool that owns the relationship between a handle and a
 * route, and that tool is schema-push.
 *
 * `handle` is editable but sharply consequential: the storefront looks pages up
 * BY HANDLE (`getPage("our-story")`), so renaming one silently empties the route
 * that reads it. The editor says so; see `components/admin/pages-table/page-editor.tsx`.
 */

/**
 * Page gids, to and from a URL segment.
 *
 * NOT `paramFromEntryId` from field-values.ts — that one is hardcoded to the
 * METAOBJECT gid prefix and returns anything else unchanged, so a page gid would
 * pass through whole and put `gid://shopify/Page/123` into a route segment. It
 * would not throw; the link would simply be wrong.
 */
const PAGE_GID_PREFIX = "gid://shopify/Page/";

export function pageIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${PAGE_GID_PREFIX}${param}` : null;
}

export function paramFromPageId(gid: string): string {
  return gid.startsWith(PAGE_GID_PREFIX) ? gid.slice(PAGE_GID_PREFIX.length) : gid;
}

export class PageNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message = "That page no longer exists.") {
    super(message);
    this.name = "PageNotFoundError";
  }
}

export type PageSummary = {
  id: string;
  title: string;
  handle: string;
  /** Which storefront route renders it, as set by schema-push. */
  templateSuffix: string | null;
  isPublished: boolean;
  updatedAt: string;
};

export type PageMetafield = {
  id: string;
  key: string;
  type: string;
  value: string;
};

export type PageDetail = PageSummary & {
  body: string;
  metafields: PageMetafield[];
};

type RawSummary = PageSummary;

type RawDetail = RawSummary & {
  body: string | null;
  metafields: { nodes: PageMetafield[] };
};

/**
 * Every page, in one pass.
 *
 * Paged rather than capped at one request because `first: 250` silently truncates
 * at 251 and the symptom is a page that is simply missing from the list, with
 * nothing to say why. Eleven pages means one round trip today; the loop is what
 * keeps that true if the store grows.
 */
export async function listPages(): Promise<PageSummary[]> {
  const all: PageSummary[] = [];
  let after: string | null = null;

  do {
    const data: {
      pages: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawSummary[] };
    } = await adminGraphQL("pages", OPERATIONS.pages.document, { first: 100, after });

    all.push(...data.pages.nodes);
    after = data.pages.pageInfo.hasNextPage ? data.pages.pageInfo.endCursor : null;
  } while (after);

  return all;
}

export async function getPage(id: string): Promise<PageDetail> {
  const data = await adminGraphQL<{ page: RawDetail | null }>("page", OPERATIONS.page.document, {
    id,
  });

  if (!data.page) throw new PageNotFoundError();

  return {
    ...data.page,
    body: data.page.body ?? "",
    metafields: data.page.metafields.nodes,
  };
}

export type PageWrite = {
  title?: string;
  handle?: string;
  body?: string;
  isPublished?: boolean;
  /** Only keys with a value. Clearing goes through `clearPageMetafields`. */
  metafields?: { key: string; type: string; value: string }[];
};

/**
 * Writes the page.
 *
 * `title`, `handle` and `body` are only sent when the caller passed them, so a
 * save that touches one metafield does not rewrite the body with whatever the
 * form happened to be holding. An undefined key is absent from the input, not
 * sent as null — null is a value and Shopify treats it as one.
 */
export async function updatePage(id: string, fields: PageWrite) {
  const page: Record<string, unknown> = {};

  if (fields.title !== undefined) page.title = fields.title;
  if (fields.handle !== undefined) page.handle = fields.handle;
  if (fields.body !== undefined) page.body = fields.body;
  if (fields.isPublished !== undefined) page.isPublished = fields.isPublished;

  if (fields.metafields?.length) {
    page.metafields = fields.metafields.map((field) => ({
      namespace: METAFIELD_NAMESPACE,
      key: field.key,
      type: field.type,
      value: field.value,
    }));
  }

  const data = await adminGraphQL<{
    pageUpdate: {
      page: { id: string; title: string; handle: string; updatedAt: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("pageUpdate", OPERATIONS.pageUpdate.document, { id, page });

  assertNoUserErrors(data.pageUpdate.userErrors);
  if (!data.pageUpdate.page) throw new PageNotFoundError();

  return data.pageUpdate.page;
}

/**
 * Clears metafields. This is `metafieldsDelete`, NOT `metafieldsSet` with an empty
 * string — the same distinction the product editor makes. An empty value still
 * exists and still reads as present, so a storefront section guarded with
 * `{% if metafield != blank %}` would keep rendering an empty band.
 */
export async function clearPageMetafields(ownerId: string, keys: string[]) {
  if (keys.length === 0) return;

  const data = await adminGraphQL<{
    metafieldsDelete: { userErrors: { field?: string[] | null; message: string }[] };
  }>("metafieldsDelete", OPERATIONS.metafieldsDelete.document, {
    metafields: keys.map((key) => ({ ownerId, namespace: METAFIELD_NAMESPACE, key })),
  });

  assertNoUserErrors(data.metafieldsDelete.userErrors);
}
