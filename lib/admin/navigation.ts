import "server-only";

import { GROUP_ORDER, groupFor, groupLabel, type GroupKey } from "./groups";
import { countUnreadInquiries, INQUIRY_TYPE } from "./inquiries";
import { listDefinitions, type Definition } from "./metaobjects";
import { moduleFor } from "./modules";

/**
 * Builds the sidebar from the definitions that exist in the store right now.
 *
 * There is no hardcoded list of screens anywhere. A definition added in Shopify
 * appears on the next page load; one deleted in Shopify stops appearing. The
 * module table in `modules.ts` only supplies a nicer label and ordering — a type
 * it has never heard of still gets a row, under "Other".
 */

/**
 * NO ENTRY COUNT HERE, on purpose.
 *
 * `MetaobjectDefinition.metaobjectsCount` looks like the obvious source for a
 * badge, and it is not trustworthy: measured against this store it reported 1
 * designer where there are 10, 8 projects where there are 10, and 2 inquiries
 * where there are none. It is stale in both directions.
 *
 * A count that reads low is worse than no count, because an operator concludes
 * rows are missing and goes looking for a bug. Getting a true count means one
 * query per type on every page load, which is a lot of Admin API budget for a
 * decoration. The list screen counts the rows it actually loaded, which is the
 * place the number matters.
 */
export type NavItem = {
  href: string;
  label: string;
  readOnly: boolean;
  /** Metaobject type, or null for a bespoke screen. Picks the row's icon. */
  type?: string | null;
  /**
   * An "needs attention" count, shown as a badge. Distinct from the entry count removed
   * above: this is COMPUTED FROM ROWS THE PANEL ACTUALLY LOADED, so it is accurate, and it
   * means something an operator can act on rather than just how big a table is.
   */
  badge?: number;
};

/** `key` is the group key from `lib/admin/groups.ts` — the sidebar uses it to pick
 *  the icon and the series tint, so presentation stays out of `groups.ts`. */
export type NavGroup = { key: string; label: string | null; items: NavItem[] };

/**
 * The URL segment for a type.
 *
 * Deliberately the Shopify type verbatim, underscores and all — `/admin/faq_item`,
 * not `/admin/faq-item`. A prettier slug needs a slug-to-type mapping, and any
 * such mapping is ambiguous the moment a type legitimately contains the character
 * used as the separator. An internal tool can afford an underscore in a URL; it
 * cannot afford a screen that resolves to the wrong definition.
 */
export function slugForType(type: string): string {
  return type;
}

/**
 * Segments under `/admin/` that belong to a bespoke screen. Next resolves a static
 * segment before `[slug]`, so a metaobject type with one of these names would be
 * unreachable — its sidebar link would silently open the bespoke screen instead.
 *
 * No store has such a type today. This exists so that if one is ever created, the
 * sidebar says so rather than leading somewhere else.
 */
const RESERVED_SLUGS = new Set(["collections", "products", "customers", "pages", "menus", "media"]);

export function reservedSlug(type: string): boolean {
  return RESERVED_SLUGS.has(type);
}

export function typeForSlug(slug: string): string {
  return slug;
}

export function labelForDefinition(definition: Definition): string {
  return moduleFor(definition.type).label ?? definition.name;
}

function toItem(definition: Definition): NavItem {
  const shadowed = reservedSlug(definition.type);

  return {
    href: `/admin/${slugForType(definition.type)}`,
    type: definition.type,
    // Named plainly rather than hidden: a type nobody can open is worth seeing.
    label: shadowed
      ? `${labelForDefinition(definition)} (shadowed by a built-in screen)`
      : labelForDefinition(definition),
    readOnly: moduleFor(definition.type).readOnly === true,
  };
}

/**
 * Screens that are not metaobjects, so auto-discovery cannot find them. Standard Shopify
 * resources have a stable shape and a bespoke screen each; they are listed here rather
 * than discovered because there is nothing to discover.
 */
const BESPOKE: { group: GroupKey; item: NavItem }[] = [
  {
    group: "catalogue",
    item: { href: "/admin/products", label: "Products", readOnly: false, type: null },
  },
  {
    group: "catalogue",
    item: { href: "/admin/collections", label: "Collections", readOnly: false, type: null },
  },
  {
    group: "pages",
    /**
     * Sits at the top of its group because the metaobjects grouped under "Pages"
     * are the PARTS of a page — services, FAQ items, locations, contact channels —
     * while this is the page itself and the metafields that assemble them.
     */
    item: { href: "/admin/pages", label: "Pages", readOnly: false, type: null },
  },
  {
    group: "pages",
    /** Next to Pages: the two together are what a visitor can reach and how. */
    item: { href: "/admin/menus", label: "Menus", readOnly: false, type: null },
  },
  {
    group: "library",
    /** Sits beside the `captioned_image` entries, which are metaobjects ABOUT files;
     *  this is the files themselves. */
    item: { href: "/admin/media", label: "Media", readOnly: false, type: null },
  },
  {
    group: "inbox",
    // Read-only apart from the panel's own note and tags.
    item: { href: "/admin/customers", label: "Customers", readOnly: true, type: null },
  },
];

export async function buildNavigation(): Promise<NavGroup[]> {
  const definitions = await listDefinitions();

  /**
   * Shares the request-memoised inquiry list with the Inquiries screen, so opening one
   * costs no extra query and the badge drops on every page the sidebar renders on — not
   * only on the list it came from.
   */
  const unread = definitions.some((definition) => definition.type === INQUIRY_TYPE)
    ? await countUnreadInquiries()
    : 0;

  const byGroup = new Map<GroupKey, NavItem[]>();
  for (const definition of definitions) {
    const key = groupFor(definition.type);
    const items = byGroup.get(key) ?? [];
    const item = toItem(definition);
    if (definition.type === INQUIRY_TYPE && unread > 0) item.badge = unread;
    items.push(item);
    byGroup.set(key, items);
  }

  const groups: NavGroup[] = [
    { key: "root", label: null, items: [{ href: "/admin", label: "Dashboard", readOnly: false }] },
  ];

  for (const bespoke of BESPOKE) {
    const items = byGroup.get(bespoke.group) ?? [];
    items.push(bespoke.item);
    byGroup.set(bespoke.group, items);
  }

  for (const key of GROUP_ORDER) {
    const items = byGroup.get(key);
    if (!items?.length) continue;

    // Within a group, the module table's order wins where it has an opinion;
    // everything else falls back to alphabetical so the list is stable.
    groups.push({
      key,
      label: groupLabel(key),
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  return groups;
}
