/**
 * Menus, without a browser or a store: the tree the editor changes, the destinations
 * it writes, and the addresses the storefront makes of them.
 *
 *   yarn check:menus
 */

import {
  addItem,
  blankDraft,
  canIndent,
  dropRow,
  flatten,
  indentItem,
  menuHandleFrom,
  outdentItem,
  projectDrop,
  readDestination,
  toDraft,
  toPayload,
  treeDepth,
  writeDestination,
  type MenuDraft,
} from "../lib/admin/menu-tree";
import { shopifyUrlToRoute } from "../lib/routes";
import {
  catalogueFilterQuery,
  catalogueProductFilters,
  combineQueries,
  readCatalogueFilter,
} from "../lib/shopify/catalogue-filter";
import { normalizeMenuItem } from "../lib/shopify/transforms";

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`);
  if (!ok) failures += 1;
}

/* --- addresses: Shopify's menu urls → the storefront's routes --- */

const routes: [string, string][] = [
  ["https://studiobizar.be/collections/types?q=Dining%20Chairs", "/shop?type=Dining+Chairs"],
  ["/collections/vendors?q=Atelier+X", "/shop?vendor=Atelier+X"],
  ["https://x.myshopify.com/collections/chairs/oak+handmade", "/shop?view=collection&collection=chairs&tag=oak%2Chandmade"],
  ["/collections/all/oak", "/shop?tag=oak"],
  ["/collections/chairs", "/collections/chairs"],
  ["/collections/all", "/shop"],
  ["/collections", "/collections"],
  ["/products/chair", "/shop/chair"],
  ["https://studiobizar.be/pages/designers/anna-berg", "/designers/anna-berg"],
  ["/pages/projects/casa-lentisco", "/projects/casa-lentisco"],
  ["mailto:hello@studiobizar.be", "mailto:hello@studiobizar.be"],
  ["https://www.instagram.com/studiobizar", "https://www.instagram.com/studiobizar"],
  ["https://studio-bizar-be.myshopify.com/", "/"],
  ["https://studiobizar.be/pages/our-story", "/our-story"],
  ["/", "/"],
];
for (const [url, expected] of routes) {
  const got = shopifyUrlToRoute(url);
  check(`${url} → ${expected}`, got === expected, got);
}

const tagged = normalizeMenuItem({
  id: "1",
  title: "Oak chairs",
  type: "COLLECTION",
  url: "https://x.myshopify.com/collections/chairs/solid-oak",
  tags: ["Solid Oak"],
  items: [{ id: "2", title: "Third", type: "PAGE", url: "/pages/our-story", items: [{ id: "3", title: "Deep", type: "SEARCH", url: "/search" }] }],
});
check(
  "a collection filtered by tag uses the tag itself, not its handle",
  tagged.href === "/shop?view=collection&collection=chairs&tag=Solid+Oak",
  tagged.href,
);
check("a menu item keeps three levels", tagged.items[0]?.items[0]?.title === "Deep" && tagged.items[0]?.items[0]?.items.length === 0);

/* --- the shop's filter --- */

const filter = readCatalogueFilter((key) => ({ type: " Dining Chairs ", vendor: "", tag: 'oak, say "hi",' })[key]);
check("the filter reads type and tags, ignores an empty vendor", filter.type === "Dining Chairs" && filter.vendor === null && filter.tags.length === 2, filter);
check(
  "a filter becomes Storefront search syntax, quotes escaped",
  catalogueFilterQuery(filter) === 'product_type:"Dining Chairs" AND tag:"oak" AND tag:"say \\"hi\\""',
  catalogueFilterQuery(filter),
);
check(
  "inside a collection it becomes product filters",
  JSON.stringify(catalogueProductFilters(filter)) === JSON.stringify([{ productType: "Dining Chairs" }, { tag: "oak" }, { tag: 'say "hi"' }]),
);
check("a category and a filter must both hold", combineQueries("a OR b", "c") === "(a OR b) AND (c)" && combineQueries(undefined, "c") === "c");

/* --- destinations --- */

check("a product type is stored as Shopify's own web link", JSON.stringify(writeDestination("TYPE:Dining Chairs", "")) === JSON.stringify({ type: "HTTP", url: "/collections/types?q=Dining+Chairs" }));
check("…and read back as a type", readDestination({ type: "HTTP", url: "/collections/types?q=Dining+Chairs" }).destination === "TYPE:Dining Chairs");
check("a vendor too", readDestination({ type: "HTTP", url: "https://shop/collections/vendors?q=Atelier" }).destination === "VENDOR:Atelier");
check("an ordinary web link stays one", readDestination({ type: "HTTP", url: "https://instagram.com" }).destination === "HTTP");
check("a page keeps its gid", JSON.stringify(writeDestination("PAGE:gid://shopify/Page/1", "")) === JSON.stringify({ type: "PAGE", resourceId: "gid://shopify/Page/1" }));
check("Home takes neither url nor resource", JSON.stringify(writeDestination("FRONTPAGE", "x")) === JSON.stringify({ type: "FRONTPAGE" }));

const collection = toDraft({ id: "gid://shopify/MenuItem/1", title: "Chairs", type: "COLLECTION", resourceId: "gid://shopify/Collection/5", tags: ["oak"] });
check("a collection's tags survive the round trip", JSON.stringify(toPayload(collection).tags) === '["oak"]');
const page = { ...toDraft({ title: "Story", type: "PAGE", resourceId: "gid://shopify/Page/1" }), tags: ["stray"] };
check("tags are only sent on a collection", toPayload(page).tags === undefined);

/* --- the tree --- */

const make = (title: string, children: MenuDraft[] = []): MenuDraft => ({ ...blankDraft(title), children });
const a = make("A");
const b = make("B");
const c = make("C");
let tree: MenuDraft[] = [a, b, c];

check("the first link cannot move in", !canIndent(tree, a.key));
tree = indentItem(tree, b.key);
check("Move in puts B under A", tree.length === 2 && tree[0]!.children[0]!.title === "B");
tree = indentItem(tree, c.key);
check("C goes under A too, after B", tree[0]!.children.map((item) => item.title).join() === "B,C");
tree = indentItem(tree, c.key);
check("…and further in, under B — the third level", tree[0]!.children[0]!.children[0]!.title === "C" && treeDepth(tree) === 3);
const d = make("D");
check("a fourth level is refused", addItem(tree, d, c.key) === tree);
tree = outdentItem(tree, c.key);
check("Move out puts C back beside B, right after it", tree[0]!.children.map((item) => item.title).join() === "B,C");

// Dragging: a two-level branch may not go under a link that is already second level.
const deep = make("Deep", [make("Child")]);
const host = make("Host", [make("Second")]);
const dragTree = [host, deep];
const rows = flatten(dragTree).filter((row) => row.key !== deep.children[0]!.key);
const secondKey = host.children[0]!.key;
const projection = projectDrop(rows, deep.key, deep.key, 5);
check("a branch two levels tall can go one level in at most", projection?.depth === 1, projection);
const under = projectDrop(rows, deep.key, deep.key, 1);
check("dragging right puts it under the link above", under?.depth === 1 && under.parentKey === host.key, under);
const moved = under ? dropRow(dragTree, deep.key, deep.key, under) : dragTree;
check("its own link comes along", moved.length === 1 && moved[0]!.children[1]?.title === "Deep" && moved[0]!.children[1]?.children[0]?.title === "Child");
check("nothing passes three levels after a drag", treeDepth(moved) <= 3);
void secondKey;

check("a handle from a name", menuHandleFrom("Shop by Room — Été") === "shop-by-room-ete");

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll menu checks passed.");
process.exit(failures ? 1 : 0);
