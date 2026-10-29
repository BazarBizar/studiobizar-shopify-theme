import "server-only";

import { MENUS } from "@/lib/navigation";
import { menusIn } from "@/lib/theme-builder/layout";

import { MENU_HANDLE, type StoredMenuItem } from "./menu-tree";
import type { EntryReference } from "./metaobjects";
import { OPERATIONS } from "./operations";
import { referenceLabel } from "./reference-previews";
import { adminGraphQL, assertNoUserErrors } from "./shopify";
import { getThemeState } from "./theme-builder";

/**
 * Navigation menus, as Shopify keeps them — the editor's tree and its changes are in
 * `menu-tree.ts`.
 *
 * THE SITE'S OWN FIVE (`lib/navigation.ts`, made by `schema-push`) are asked for by
 * handle — `getMenu(MENUS.primary)` — so they can be edited but never deleted or
 * emptied: the header would fall back to `FALLBACK_NAV` without saying so.
 *
 * MENUS MADE HERE are shown wherever a Theme Builder menu element is set to them
 * (Appearance). One can be deleted only while no layout — published or draft — shows
 * it. Shopify's own defaults ("Main menu", "Footer menu") are not listed: nothing on
 * this site reads them.
 *
 * THREE LEVELS, Shopify's limit — the header draws the third as a mega menu.
 */

export class MenuNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message = "That menu no longer exists.") {
    super(message);
    this.name = "MenuNotFoundError";
  }
}

export { menuIdFromParam, paramFromMenuId } from "./menu-tree";

export type MenuItemNode = {
  id: string;
  title: string;
  /** Shopify's MenuItemType: PAGE, HTTP, FRONTPAGE, CATALOG, … */
  type: string;
  url: string | null;
  resourceId: string | null;
  /** A collection link's "filtered by tag". */
  tags: string[];
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

type RawItem = Omit<MenuItemNode, "items" | "tags"> & { tags?: string[]; items?: RawItem[] };
type RawMenu = Omit<Menu, "items"> & { items: RawItem[] };

const normalizeItem = (item: RawItem): MenuItemNode => ({
  id: item.id,
  title: item.title,
  type: item.type,
  url: item.url,
  resourceId: item.resourceId,
  tags: item.tags ?? [],
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
  // One query for every menu is cheaper than a second document to keep valid — a
  // store has a handful.
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
  [MENUS.primary]: "Top of every page — the main links",
  [MENUS.secondary]: "Top of every page — the second row and its dropdowns",
  [MENUS.footerAbout]: "Bottom of every page — the About column",
  [MENUS.footerInfo]: "Bottom of every page — the Info column",
  [MENUS.footerLegal]: "Bottom of every page — the Legal column",
};

export function menuUsedBy(handle: string): string | null {
  return USED_BY[handle] ?? null;
}

/**
 * The name a person sees. The titles stored in Shopify ("DESK primary") were named for
 * the code; they are still what is saved back, only never shown.
 */
const DISPLAY_NAME: Record<string, string> = {
  [MENUS.primary]: "Main menu",
  [MENUS.secondary]: "Second menu",
  [MENUS.footerAbout]: "Footer — About",
  [MENUS.footerInfo]: "Footer — Info",
  [MENUS.footerLegal]: "Footer — Legal",
};

export function menuDisplayName(menu: { handle: string; title: string }): string {
  return DISPLAY_NAME[menu.handle] ?? menu.title;
}

/**
 * What a Theme Builder menu element can show: the site's own menus by their key (as the
 * layout has always stored them), then every menu made here by its handle.
 */
export function menuChoices(menus: Menu[]): { value: string; label: string }[] {
  const keys = Object.entries(MENUS) as [keyof typeof MENUS, string][];
  const own = new Set<string>(Object.values(MENUS));
  return [
    ...keys.map(([key, handle]) => ({ value: key, label: menuDisplayName({ handle, title: key }) })),
    ...menus
      .filter((menu) => !menu.isDefault && !own.has(menu.handle))
      .map((menu) => ({ value: menu.handle, label: menu.title }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

/**
 * Only the menus this site reads, in the order they appear on the page. Shopify's own
 * defaults (Main menu, Footer menu, …) look identical and change nothing here, so
 * listing them only invites editing the wrong one.
 */
export function siteMenus(menus: Menu[]): Menu[] {
  const order = Object.keys(USED_BY);
  return menus
    .filter((menu) => menu.handle in USED_BY)
    .sort((a, b) => order.indexOf(a.handle) - order.indexOf(b.handle));
}

/** One of the five the site's components ask for by handle. */
export const isSiteMenu = (handle: string) => handle in USED_BY;

/** Menus made here: not the site's own, not Shopify's defaults. Alphabetical. */
export function madeMenus(menus: Menu[]): Menu[] {
  return menus.filter((menu) => !menu.isDefault && !isSiteMenu(menu.handle)).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The handles a Theme Builder layout shows — the published one and the draft — so a
 * menu still on the site, or about to be, is not deleted from under it. The site's
 * own are stored by key ("primary"), the rest by handle.
 */
export async function menusInAppearance(): Promise<Set<string>> {
  const state = await getThemeState();
  const refs = [...(state.published ? menusIn(state.published) : []), ...menusIn(state.draft)];
  return new Set(refs.map((ref) => (ref in MENUS ? MENUS[ref as keyof typeof MENUS] : ref)));
}

/* -------------------------------------------------------------------------- *
 * Destinations
 * -------------------------------------------------------------------------- */

export type DestinationOption = {
  /** The editor's destination — see `menu-tree.ts`. */
  value: string;
  label: string;
  group: string;
};

export type MenuDestinations = {
  options: DestinationOption[];
  /** Every product tag, for "filter by tag". */
  tags: string[];
  /** Active products, all of which the picker's Products folder lists. */
  productCount: number | null;
};

/**
 * What a link can open, as Shopify's own menu editor offers it — everything except
 * single products, of which there are too many to list: those are searched
 * (`useProductSearch`), and the ones a menu already links to are named here
 * (`productIds`) so they show as their product, not as a code.
 */
export async function listMenuDestinations(productIds: string[] = []): Promise<MenuDestinations> {
  const [data, products] = await Promise.all([
    adminGraphQL<{
      productsCount: { count: number } | null;
      designers: { nodes: { id: string; displayName: string }[] };
      projects: { nodes: { id: string; displayName: string }[] };
      customerAccountPages: { nodes: { id: string; title: string }[] };
      productTypes: { nodes: string[] };
      productVendors: { nodes: string[] };
      productTags: { nodes: string[] };
      pages: { nodes: { id: string; title: string; handle: string }[] };
      collections: { nodes: { id: string; title: string; handle: string }[] };
      shop: { shopPolicies: { id: string; title: string; type: string }[] };
    }>("menuDestinations", OPERATIONS.menuDestinations.document, {}),
    productIds.length
      ? adminGraphQL<{ nodes: (EntryReference | null)[] }>(
          "referencePreviews",
          OPERATIONS.referencePreviews.document,
          { ids: productIds },
        ).catch(() => ({ nodes: [] as (EntryReference | null)[] }))
      : Promise.resolve({ nodes: [] as (EntryReference | null)[] }),
  ]);
  const named = (list: string[]) => list.filter((value) => value.trim()).sort((a, b) => a.localeCompare(b));

  return {
    tags: named(data.productTags.nodes),
    productCount: data.productsCount?.count ?? null,
    // In the order Shopify's link picker lists them; `group` is the folder each sits in
    // ("Store" for the few with none). "All …" open their folder.
    options: [
      { value: "FRONTPAGE", label: "Home", group: "Store" },
      { value: "SEARCH", label: "Search", group: "Store" },
      { value: "COLLECTIONS", label: "All collections", group: "Collections" },
      ...data.collections.nodes.map((collection) => ({
        value: `COLLECTION:${collection.id}`,
        label: collection.title,
        group: "Collections",
      })),
      { value: "CATALOG", label: "All products", group: "Products" },
      ...named(data.productTypes.nodes).map((type) => ({ value: `TYPE:${type}`, label: type, group: "Product types" })),
      ...named(data.productVendors.nodes).map((vendor) => ({ value: `VENDOR:${vendor}`, label: vendor, group: "Vendors" })),
      ...data.pages.nodes.map((page) => ({ value: `PAGE:${page.id}`, label: page.title, group: "Pages" })),
      ...data.designers.nodes.map((entry) => ({ value: `METAOBJECT:${entry.id}`, label: entry.displayName, group: "Designers" })),
      ...data.projects.nodes.map((entry) => ({ value: `METAOBJECT:${entry.id}`, label: entry.displayName, group: "Projects" })),
      ...data.shop.shopPolicies.map((policy) => ({
        value: `SHOP_POLICY:${policy.id}`,
        label: policy.title,
        group: "Policies",
      })),
      ...data.customerAccountPages.nodes.map((page) => ({
        value: `CUSTOMER_ACCOUNT_PAGE:${page.id}`,
        label: page.title,
        group: "Customer account",
      })),
      { value: "HTTP", label: "Web address", group: "Store" },
      ...products.nodes
        .filter((node): node is EntryReference => Boolean(node?.id))
        .map((node) => ({ value: `PRODUCT:${node.id}`, label: referenceLabel(node), group: "Products" })),
    ],
  };
}

/** The products a menu links to, for `listMenuDestinations`. */
export function productIdsIn(items: MenuItemNode[]): string[] {
  const all = (list: MenuItemNode[]): MenuItemNode[] => list.flatMap((item) => [item, ...all(item.items)]);
  return [...new Set(all(items).filter((item) => item.type === "PRODUCT" && item.resourceId).map((item) => item.resourceId!))];
}

/* -------------------------------------------------------------------------- *
 * Writing
 * -------------------------------------------------------------------------- */

export class MenuRuleError extends Error {
  constructor(
    readonly code: "RESERVED" | "IN_USE" | "NOT_ALLOWED" | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "MenuRuleError";
  }
}

const DERIVED = new Set(["FRONTPAGE", "CATALOG", "COLLECTIONS", "SEARCH"]);

/**
 * A derived type carries no url and no resourceId, a web link only its url, the rest
 * only their resourceId — whatever the browser sent. Tags only on a collection.
 */
function clean(list: StoredMenuItem[]): StoredMenuItem[] {
  return list.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    title: item.title,
    type: item.type,
    ...(DERIVED.has(item.type) ? {} : item.type === "HTTP" ? { url: item.url ?? "" } : { resourceId: item.resourceId ?? null }),
    ...(item.type === "COLLECTION" && item.tags?.length ? { tags: item.tags } : {}),
    ...(item.items?.length ? { items: clean(item.items) } : {}),
  }));
}

/**
 * Sends the whole tree.
 *
 * `menuUpdate` REPLACES rather than patches, so an item missing from `items` is
 * deleted. That is the API's contract; the editor always holds and sends the complete
 * tree. One of the site's own menus may not be emptied (its component would fall back
 * without saying so) nor change its handle (its component asks for it by that); a
 * menu made here may do both.
 */
export async function updateMenu(id: string, title: string, handle: string, items: StoredMenuItem[]) {
  const current = await getMenu(id);
  const fixed = isSiteMenu(current.handle) || current.isDefault;
  if (isSiteMenu(current.handle) && items.length === 0) {
    throw new MenuRuleError("NOT_ALLOWED", "This menu is shown on every page, so it needs at least one link.");
  }
  const nextHandle = fixed ? current.handle : handle;
  if (!MENU_HANDLE.test(nextHandle)) {
    throw new MenuRuleError("INVALID", "Use lowercase letters, numbers and dashes for the handle.");
  }
  if (nextHandle !== current.handle) {
    if (isSiteMenu(nextHandle) || (await listMenus()).some((menu) => menu.handle === nextHandle)) {
      throw new MenuRuleError("RESERVED", "Another menu already has that handle.");
    }
    if ((await menusInAppearance()).has(current.handle)) {
      throw new MenuRuleError("IN_USE", "This menu is shown in Appearance under its handle, so the handle cannot change now.");
    }
  }

  const data = await adminGraphQL<{
    menuUpdate: {
      menu: { id: string; handle: string; title: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("menuUpdate", OPERATIONS.menuUpdate.document, { id, title, handle: nextHandle, items: clean(items) });

  assertNoUserErrors(data.menuUpdate.userErrors);
  if (!data.menuUpdate.menu) throw new MenuNotFoundError();

  return data.menuUpdate.menu;
}

export async function createMenu(title: string, handle: string, items: StoredMenuItem[] = []) {
  if (!MENU_HANDLE.test(handle)) {
    throw new MenuRuleError("INVALID", "Use lowercase letters, numbers and dashes for the handle.");
  }
  if (isSiteMenu(handle) || (await listMenus()).some((menu) => menu.handle === handle)) {
    throw new MenuRuleError("RESERVED", "A menu with that handle already exists. Choose another name.");
  }

  const data = await adminGraphQL<{
    menuCreate: {
      menu: { id: string; handle: string; title: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("menuCreate", OPERATIONS.menuCreate.document, { title, handle, items: clean(items) });

  assertNoUserErrors(data.menuCreate.userErrors);
  if (!data.menuCreate.menu) throw new MenuRuleError("INVALID", "Shopify did not make the menu.");
  return data.menuCreate.menu;
}

export async function deleteMenu(id: string) {
  const menu = await getMenu(id);
  if (isSiteMenu(menu.handle) || menu.isDefault) {
    throw new MenuRuleError("NOT_ALLOWED", "This menu is part of the site and cannot be deleted. Remove its links instead.");
  }
  if ((await menusInAppearance()).has(menu.handle)) {
    throw new MenuRuleError(
      "IN_USE",
      "This menu is shown in Appearance. Choose another menu for that element, or remove the element, there first.",
    );
  }

  const data = await adminGraphQL<{
    menuDelete: { deletedMenuId: string | null; userErrors: { field?: string[] | null; message: string }[] };
  }>("menuDelete", OPERATIONS.menuDelete.document, { id });

  assertNoUserErrors(data.menuDelete.userErrors);
  return { id: data.menuDelete.deletedMenuId ?? id, handle: menu.handle };
}
