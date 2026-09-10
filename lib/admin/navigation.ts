import "server-only";

import { GROUP_ORDER, groupFor, groupLabel, type GroupKey } from "./groups";
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

export function typeForSlug(slug: string): string {
  return slug;
}

export function labelForDefinition(definition: Definition): string {
  return moduleFor(definition.type).label ?? definition.name;
}

function toItem(definition: Definition): NavItem {
  return {
    href: `/admin/${slugForType(definition.type)}`,
    label: labelForDefinition(definition),
    readOnly: moduleFor(definition.type).readOnly === true,
  };
}

export async function buildNavigation(): Promise<NavGroup[]> {
  const definitions = await listDefinitions();

  const byGroup = new Map<GroupKey, NavItem[]>();
  for (const definition of definitions) {
    const key = groupFor(definition.type);
    const items = byGroup.get(key) ?? [];
    items.push(toItem(definition));
    byGroup.set(key, items);
  }

  const groups: NavGroup[] = [
    { key: "root", label: null, items: [{ href: "/admin", label: "Dashboard", readOnly: false }] },
  ];

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
