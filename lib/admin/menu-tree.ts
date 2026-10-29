/**
 * A menu as the editor holds it, and every change made to it — pure, so the editor,
 * the server and `scripts/check-menus.ts` share one definition.
 *
 * THREE LEVELS, Shopify's limit: a link, the links under it, and the links under
 * those. The header draws the third level as a mega menu; the phone drawer opens it
 * in place.
 *
 * DESTINATIONS are one string, so a picker can hold them: `FRONTPAGE`, `PAGE:<gid>`,
 * `COLLECTION:<gid>`, `PRODUCT:<gid>`, `HTTP` (with `url`) … and two that Shopify has
 * no item type for — a product TYPE and a VENDOR. Shopify's own admin makes those web
 * links to `/collections/types?q=…` and `/collections/vendors?q=…`, which its themes
 * serve; they are stored the same way here (`writeDestination`) and read back as
 * `TYPE:<name>` / `VENDOR:<name>` (`readDestination`). The storefront maps them onto
 * `/shop?type=` (see `lib/routes.ts`).
 */

export const MAX_MENU_DEPTH = 3;
export const MAX_MENU_ITEMS = 250;

/** Destinations Shopify resolves itself — they take neither url nor resourceId. */
export const DERIVED_TYPES = new Set(["FRONTPAGE", "CATALOG", "COLLECTIONS", "SEARCH"]);

export type MenuDraft = {
  /** Local, stable across renders. Not Shopify's id — a new item has none. */
  key: string;
  id?: string;
  title: string;
  destination: string;
  /** For `HTTP` only. */
  url: string;
  /** "Filtered by tag" — a collection link only. */
  tags: string[];
  children: MenuDraft[];
};

export type StoredMenuItem = {
  id?: string;
  title: string;
  type: string;
  url?: string | null;
  resourceId?: string | null;
  tags?: string[];
  items?: StoredMenuItem[];
};

let counter = 0;
export const nextMenuKey = () => `item-${(counter += 1)}`;

/* -------------------------------------------------------------------------- *
 * Destinations
 * -------------------------------------------------------------------------- */

const FILTER_PATHS = { TYPE: "/collections/types", VENDOR: "/collections/vendors" } as const;

/** A stored item → the editor's destination string (and, for a web link, its url). */
export function readDestination(item: { type: string; url?: string | null; resourceId?: string | null }): {
  destination: string;
  url: string;
} {
  if (item.type === "HTTP" && item.url) {
    try {
      const parsed = new URL(item.url, "https://shop.invalid");
      for (const [kind, path] of Object.entries(FILTER_PATHS)) {
        const name = parsed.searchParams.get("q");
        if (parsed.pathname === path && name) return { destination: `${kind}:${name}`, url: "" };
      }
    } catch {
      // Not a url at all: kept as typed.
    }
    return { destination: "HTTP", url: item.url };
  }
  return { destination: item.resourceId ? `${item.type}:${item.resourceId}` : item.type, url: item.url ?? "" };
}

/** The editor's destination → what `menuUpdate` takes. */
export function writeDestination(destination: string, url: string): { type: string; resourceId?: string | null; url?: string } {
  const at = destination.indexOf(":");
  // A gid contains colons; split on the first one only.
  const kind = at === -1 ? destination : destination.slice(0, at);
  const rest = at === -1 ? null : destination.slice(at + 1);
  if (kind === "TYPE" || kind === "VENDOR") {
    return { type: "HTTP", url: `${FILTER_PATHS[kind]}?${new URLSearchParams({ q: rest ?? "" })}` };
  }
  if (DERIVED_TYPES.has(kind)) return { type: kind };
  if (kind === "HTTP") return { type: "HTTP", url: url.trim() };
  return { type: kind, resourceId: rest };
}

export const destinationKind = (destination: string) => destination.split(":")[0]!;

/* -------------------------------------------------------------------------- *
 * Stored ↔ draft
 * -------------------------------------------------------------------------- */

export function toDraft(item: StoredMenuItem): MenuDraft {
  const { destination, url } = readDestination(item);
  return {
    key: nextMenuKey(),
    ...(item.id ? { id: item.id } : {}),
    title: item.title,
    destination,
    url,
    tags: item.tags ?? [],
    children: (item.items ?? []).map(toDraft),
  };
}

export function blankDraft(title = ""): MenuDraft {
  return { key: nextMenuKey(), title, destination: "FRONTPAGE", url: "", tags: [], children: [] };
}

/** The whole tree, as `menuUpdate` / `menuCreate` take it. Tags only where Shopify allows them. */
export function toPayload(draft: MenuDraft): StoredMenuItem {
  const write = writeDestination(draft.destination, draft.url);
  return {
    ...(draft.id ? { id: draft.id } : {}),
    title: draft.title.trim(),
    ...write,
    ...(write.type === "COLLECTION" && draft.tags.length ? { tags: draft.tags } : {}),
    ...(draft.children.length ? { items: draft.children.map(toPayload) } : {}),
  };
}

/** For "unsaved changes": what is saved, without the local keys. */
export function comparable(items: MenuDraft[]): string {
  const strip = (draft: MenuDraft): unknown => ({
    id: draft.id ?? null,
    title: draft.title,
    destination: draft.destination,
    url: draft.url,
    tags: draft.tags,
    children: draft.children.map(strip),
  });
  return JSON.stringify(items.map(strip));
}

/* -------------------------------------------------------------------------- *
 * Measuring
 * -------------------------------------------------------------------------- */

export function flattenDrafts(items: MenuDraft[]): MenuDraft[] {
  return items.flatMap((item) => [item, ...flattenDrafts(item.children)]);
}

/** Levels in this item's own branch — 1 for a link with nothing under it. */
export function branchHeight(item: { children?: unknown[]; items?: unknown[] }): number {
  const below = (item.children ?? item.items ?? []) as { children?: unknown[]; items?: unknown[] }[];
  return 1 + Math.max(0, ...below.map(branchHeight));
}

export function treeDepth(items: { children?: unknown[]; items?: unknown[] }[]): number {
  return Math.max(0, ...items.map(branchHeight));
}

/* -------------------------------------------------------------------------- *
 * Flat view — what the drag list shows, one row per link with its depth
 * -------------------------------------------------------------------------- */

export type FlatItem = { key: string; parentKey: string | null; depth: number; draft: MenuDraft };

export function flatten(items: MenuDraft[], parentKey: string | null = null, depth = 0): FlatItem[] {
  return items.flatMap((draft) => [{ key: draft.key, parentKey, depth, draft }, ...flatten(draft.children, draft.key, depth + 1)]);
}

/** Back to a tree: each row under its `parentKey`, in row order. */
export function buildTree(flat: FlatItem[]): MenuDraft[] {
  const nodes = new Map(flat.map((row) => [row.key, { ...row.draft, children: [] as MenuDraft[] }]));
  const roots: MenuDraft[] = [];
  for (const row of flat) {
    const node = nodes.get(row.key)!;
    const parent = row.parentKey ? nodes.get(row.parentKey) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Every row under `key`, at any depth. */
export function descendantKeys(flat: FlatItem[], key: string): Set<string> {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of flat) {
      if (row.parentKey && (row.parentKey === key || out.has(row.parentKey)) && !out.has(row.key)) {
        out.add(row.key);
        grew = true;
      }
    }
  }
  return out;
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * Where a dragged row would land: dropped over `overKey`, moved `offsetDepth` levels
 * left (negative) or right by the pointer. Within what the rows around it allow — at
 * most one level deeper than the row above, at least as deep as the row below — and
 * never so deep that its own branch would pass the third level.
 *
 * `rows` is the list as shown while dragging: the dragged row's own branch folded away.
 */
export function projectDrop(
  rows: FlatItem[],
  activeKey: string,
  overKey: string,
  offsetDepth: number,
): { depth: number; parentKey: string | null } | null {
  const activeIndex = rows.findIndex((row) => row.key === activeKey);
  const overIndex = rows.findIndex((row) => row.key === overKey);
  if (activeIndex === -1 || overIndex === -1) return null;
  const active = rows[activeIndex]!;
  const moved = arrayMove(rows, activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const ceiling = MAX_MENU_DEPTH - branchHeight(active.draft);
  const maxDepth = Math.min(previous ? previous.depth + 1 : 0, ceiling);
  const minDepth = next ? next.depth : 0;
  if (minDepth > maxDepth) return null;
  const depth = Math.min(maxDepth, Math.max(minDepth, active.depth + offsetDepth));

  let parentKey: string | null = null;
  if (depth > 0 && previous) {
    if (previous.depth === depth) parentKey = previous.parentKey;
    else if (previous.depth < depth) parentKey = previous.key;
    else parentKey = moved.slice(0, overIndex).reverse().find((row) => row.depth === depth)?.parentKey ?? null;
  }
  return { depth, parentKey };
}

/** Applies a projected drop to the whole tree. Its branch travels with it. */
export function dropRow(
  items: MenuDraft[],
  activeKey: string,
  overKey: string,
  projection: { depth: number; parentKey: string | null },
): MenuDraft[] {
  const flat = flatten(items);
  const activeIndex = flat.findIndex((row) => row.key === activeKey);
  const overIndex = flat.findIndex((row) => row.key === overKey);
  if (activeIndex === -1 || overIndex === -1) return items;
  const updated = flat.map((row, index) =>
    index === activeIndex ? { ...row, depth: projection.depth, parentKey: projection.parentKey } : row,
  );
  const next = buildTree(arrayMove(updated, activeIndex, overIndex));
  return treeDepth(next) > MAX_MENU_DEPTH ? items : next;
}

/* -------------------------------------------------------------------------- *
 * Edits by key — what the buttons and the dialog do
 * -------------------------------------------------------------------------- */

type Located = { list: MenuDraft[]; index: number; parent: MenuDraft | null; depth: number };

function locate(items: MenuDraft[], key: string, parent: MenuDraft | null = null, depth = 0): Located | null {
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (item.key === key) return { list: items, index, parent, depth };
    const inside = locate(item.children, key, item, depth + 1);
    if (inside) return inside;
  }
  return null;
}

export function depthOf(items: MenuDraft[], key: string): number {
  return locate(items, key)?.depth ?? -1;
}

/** A copy of the tree with one item changed. */
export function updateItem(items: MenuDraft[], key: string, change: (item: MenuDraft) => MenuDraft): MenuDraft[] {
  return items.map((item) => (item.key === key ? change(item) : { ...item, children: updateItem(item.children, key, change) }));
}

export function removeItem(items: MenuDraft[], key: string): MenuDraft[] {
  return items.filter((item) => item.key !== key).map((item) => ({ ...item, children: removeItem(item.children, key) }));
}

/** Adds a link under `parentKey` (or at the top level), last. Refused past the third level. */
export function addItem(items: MenuDraft[], draft: MenuDraft, parentKey: string | null): MenuDraft[] {
  if (!parentKey) return [...items, draft];
  if (depthOf(items, parentKey) + 1 + branchHeight(draft) > MAX_MENU_DEPTH) return items;
  return updateItem(items, parentKey, (parent) => ({ ...parent, children: [...parent.children, draft] }));
}

/** Up or down among its siblings. */
export function shiftItem(items: MenuDraft[], key: string, delta: -1 | 1): MenuDraft[] {
  const found = locate(items, key);
  if (!found) return items;
  const target = found.index + delta;
  if (target < 0 || target >= found.list.length) return items;
  const reorder = (list: MenuDraft[]) => arrayMove(list, found.index, target);
  return found.parent ? updateItem(items, found.parent.key, (parent) => ({ ...parent, children: reorder(parent.children) })) : reorder(items);
}

/** Under the sibling above it, as that one's last link ("Move in"). */
export function canIndent(items: MenuDraft[], key: string): boolean {
  const found = locate(items, key);
  if (!found || found.index === 0) return false;
  return found.depth + 1 + branchHeight(found.list[found.index]!) <= MAX_MENU_DEPTH;
}

export function indentItem(items: MenuDraft[], key: string): MenuDraft[] {
  if (!canIndent(items, key)) return items;
  const found = locate(items, key)!;
  const item = found.list[found.index]!;
  const above = found.list[found.index - 1]!;
  return addItem(removeItem(items, key), item, above.key);
}

/** Out of its parent, right after it ("Move out"). */
export function canOutdent(items: MenuDraft[], key: string): boolean {
  return Boolean(locate(items, key)?.parent);
}

export function outdentItem(items: MenuDraft[], key: string): MenuDraft[] {
  const found = locate(items, key);
  if (!found?.parent) return items;
  const item = found.list[found.index]!;
  const parentFound = locate(items, found.parent.key)!;
  const without = removeItem(items, key);
  const insert = (list: MenuDraft[]) => [...list.slice(0, parentFound.index + 1), item, ...list.slice(parentFound.index + 1)];
  return parentFound.parent
    ? updateItem(without, parentFound.parent.key, (grand) => ({ ...grand, children: insert(grand.children) }))
    : insert(without);
}

/* -------------------------------------------------------------------------- *
 * Handles
 * -------------------------------------------------------------------------- */

/** "Shop by room" → "shop-by-room", as Shopify makes a handle. */
export function menuHandleFrom(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export const MENU_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* -------------------------------------------------------------------------- *
 * Addresses — `/admin/menus/<number>`
 * -------------------------------------------------------------------------- */

const MENU_GID_PREFIX = "gid://shopify/Menu/";

export function menuIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${MENU_GID_PREFIX}${param}` : null;
}

export function paramFromMenuId(gid: string): string {
  return gid.startsWith(MENU_GID_PREFIX) ? gid.slice(MENU_GID_PREFIX.length) : gid;
}
