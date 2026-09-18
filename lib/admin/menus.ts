import "server-only";

import { MENUS } from "@/lib/navigation";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Navigation menus.
 *
 * The store holds eight. Five are this site's, created by `schema-push` and
 * named in `lib/navigation.ts`; the other three are Shopify's own defaults,
 * which no storefront route reads. The screen says which is which rather than
 * showing eight equivalent rows and letting an operator find out by editing the
 * wrong one.
 *
 * TWO LEVELS. `Header` renders `item.items` for the secondary nav's dropdowns
 * and stops; the mobile drawer does the same. A third level would be data no
 * screen shows, so it is neither read nor written here.
 *
 * NO CREATE, NO DELETE. A menu exists because a component asks for it by handle
 * — `getMenu(MENUS.primary)` — so a new one is reachable by nothing, and
 * deleting one drops that component to its `FALLBACK_NAV`, silently. Both belong
 * with `schema-push`, which owns the handle a component depends on.
 */

export class MenuNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message = "That menu no longer exists.") {
    super(message);
    this.name = "MenuNotFoundError";
  }
}

const MENU_GID_PREFIX = "gid://shopify/Menu/";

export function menuIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${MENU_GID_PREFIX}${param}` : null;
}

export function paramFromMenuId(gid: string): string {
  return gid.startsWith(MENU_GID_PREFIX) ? gid.slice(MENU_GID_PREFIX.length) : gid;
}

export type MenuItemNode = {
  id: string;
  title: string;
  /** Shopify's MenuItemType: PAGE, HTTP, FRONTPAGE, CATALOG, … */
  type: string;
  url: string | null;
  resourceId: string | null;
  items: MenuItemNode[];
};

export type Menu = {
  id: string;
  handle: string;
  title: string;
  /** Shopify's own menus, which this storefront does not read. */
  isDefault: boolean;
  items: MenuItemNode[];
};

type RawItem = Omit<MenuItemNode, "items"> & { items?: RawItem[] };
type RawMenu = Omit<Menu, "items"> & { items: RawItem[] };

const normalizeItem = (item: RawItem): MenuItemNode => ({
  id: item.id,
  title: item.title,
  type: item.type,
  url: item.url,
  resourceId: item.resourceId,
  items: (item.items ?? []).map(normalizeItem),
});

export async function listMenus(): Promise<Menu[]> {
  const data = await adminGraphQL<{ menus: { nodes: RawMenu[] } }>(
    "menus",
    OPERATIONS.menus.document,
    { first: 50 },
  );

  return data.menus.nodes.map((menu) => ({ ...menu, items: menu.items.map(normalizeItem) }));
}

export async function getMenu(id: string): Promise<Menu> {
  // One query for eight menus is cheaper than a second document to keep valid.
  // Revisit if menus ever become something people create freely; they do not.
  const menu = (await listMenus()).find((candidate) => candidate.id === id);
  if (!menu) throw new MenuNotFoundError();
  return menu;
}

/**
 * Which part of the site reads a menu, from the handles `lib/navigation.ts`
 * declares. Asking that module rather than repeating its handles is what keeps
 * this from drifting the day one is renamed.
 */
const USED_BY: Record<string, string> = {
  [MENUS.primary]: "Header — primary nav",
  [MENUS.secondary]: "Header — secondary nav and dropdowns",
  [MENUS.footerAbout]: "Footer — About column",
  [MENUS.footerInfo]: "Footer — Info column",
  [MENUS.footerLegal]: "Footer — Legal column",
};

export function menuUsedBy(handle: string): string | null {
  return USED_BY[handle] ?? null;
}

/* -------------------------------------------------------------------------- *
 * Destinations
 * -------------------------------------------------------------------------- */

export type DestinationOption = {
  /** The editor's select value. See `parseDestination`. */
  value: string;
  label: string;
  group: string;
};

/**
 * A destination is `type` plus at most one of `resourceId` or `url`, which does
 * not fit a single `<select>`. It is encoded as one string — `PAGE:<gid>` — so
 * the control stays a plain select and the server does the splitting.
 */
export function encodeDestination(item: {
  type: string;
  resourceId: string | null;
}): string {
  return item.resourceId ? `${item.type}:${item.resourceId}` : item.type;
}

export function parseDestination(value: string): { type: string; resourceId: string | null } {
  const separator = value.indexOf(":");
  // A gid contains colons, so split on the FIRST one only.
  if (separator === -1) return { type: value, resourceId: null };
  return { type: value.slice(0, separator), resourceId: value.slice(separator + 1) };
}

/** Destinations Shopify resolves itself — they take neither url nor resourceId. */
export const DERIVED_TYPES = new Set(["FRONTPAGE", "CATALOG", "COLLECTIONS", "SEARCH"]);

export async function listMenuDestinations(): Promise<DestinationOption[]> {
  const data = await adminGraphQL<{
    pages: { nodes: { id: string; title: string; handle: string }[] };
    collections: { nodes: { id: string; title: string; handle: string }[] };
    shop: { shopPolicies: { id: string; title: string; type: string }[] };
  }>("menuDestinations", OPERATIONS.menuDestinations.document, {});

  return [
    { value: "FRONTPAGE", label: "Home", group: "Store" },
    { value: "CATALOG", label: "All products", group: "Store" },
    { value: "COLLECTIONS", label: "All collections", group: "Store" },
    { value: "SEARCH", label: "Search", group: "Store" },
    { value: "HTTP", label: "Custom URL", group: "Store" },

    ...data.pages.nodes.map((page) => ({
      value: `PAGE:${page.id}`,
      label: page.title,
      group: "Pages",
    })),
    ...data.collections.nodes.map((collection) => ({
      value: `COLLECTION:${collection.id}`,
      label: collection.title,
      group: "Collections",
    })),
    ...data.shop.shopPolicies.map((policy) => ({
      value: `SHOP_POLICY:${policy.id}`,
      label: policy.title,
      group: "Policies",
    })),
  ];
}

/* -------------------------------------------------------------------------- *
 * Writing
 * -------------------------------------------------------------------------- */

export type MenuItemWrite = {
  /** Omitted for an item being added. */
  id?: string;
  title: string;
  type: string;
  url?: string | null;
  resourceId?: string | null;
  items?: MenuItemWrite[];
};

/**
 * Sends the whole tree.
 *
 * `menuUpdate` REPLACES rather than patches, so an item missing from `items` is
 * deleted. That is the API's contract; the editor always holds and sends the
 * complete list, and the route's schema requires a non-empty one so a truncated
 * payload cannot quietly empty a menu.
 *
 * A derived type carries no url and no resourceId. Sending one back is rejected,
 * which is why they are stripped here rather than in the browser — the browser
 * is not the last word on what reaches Shopify.
 */
export async function updateMenu(
  id: string,
  title: string,
  handle: string,
  items: MenuItemWrite[],
) {
  const clean = (list: MenuItemWrite[]): MenuItemWrite[] =>
    list.map((item) => {
      const derived = DERIVED_TYPES.has(item.type);

      return {
        ...(item.id ? { id: item.id } : {}),
        title: item.title,
        type: item.type,
        ...(derived ? {} : item.type === "HTTP"
          ? { url: item.url ?? "" }
          : { resourceId: item.resourceId ?? null }),
        ...(item.items?.length ? { items: clean(item.items) } : {}),
      };
    });

  const data = await adminGraphQL<{
    menuUpdate: {
      menu: { id: string; handle: string; title: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("menuUpdate", OPERATIONS.menuUpdate.document, {
    id,
    title,
    handle,
    items: clean(items),
  });

  assertNoUserErrors(data.menuUpdate.userErrors);
  if (!data.menuUpdate.menu) throw new MenuNotFoundError();

  return data.menuUpdate.menu;
}
