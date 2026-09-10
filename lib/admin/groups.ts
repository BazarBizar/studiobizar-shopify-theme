import "server-only";

/**
 * Which sidebar group a metaobject type belongs to.
 *
 * WHY AN EXPLICIT MAP AND NOT A NAMING CONVENTION. The usual trick is to derive
 * grouping from the type name — `site_home_hero` implies a "home" group. This
 * store has no such convention: its types are bare nouns (`designer`, `project`,
 * `faq_item`) created by `schema-push`, so there is nothing to parse. Inventing a
 * prefix scheme now would mean renaming eight definitions and migrating their
 * entries, to save this table.
 *
 * The map is therefore a convenience, never a gate. Anything it does not mention
 * lands in `other` and is fully usable there — see `buildNavigation`. That is what
 * keeps the promise that a definition created in Shopify appears in the panel
 * with no code change.
 */

export type GroupKey = "catalogue" | "pages" | "library" | "inbox" | "settings" | "other";

type GroupDef = { key: GroupKey; label: string; types: string[] };

const GROUPS: GroupDef[] = [
  { key: "catalogue", label: "Catalogue", types: ["designer", "project"] },
  { key: "pages", label: "Pages", types: ["service", "faq_item", "location", "contact_channel"] },
  { key: "library", label: "Library", types: ["captioned_image"] },
  { key: "inbox", label: "Inbox", types: ["inquiry"] },
  {
    key: "settings",
    label: "Settings",
    // Classifying a type here is a convenience only — an unlisted one is already
    // reachable under "Other".
    types: ["site_settings"],
  },
];

/** Where an unmapped definition goes. Never empty-checked away: a type nobody
 *  has classified still has to be reachable and editable. */
const OTHER: GroupDef = { key: "other", label: "Other", types: [] };

export const GROUP_ORDER: GroupKey[] = ["catalogue", "pages", "library", "inbox", "settings", "other"];

const TYPE_TO_GROUP = new Map<string, GroupKey>(
  GROUPS.flatMap((group) => group.types.map((type) => [type, group.key] as const)),
);

export function groupFor(type: string): GroupKey {
  return TYPE_TO_GROUP.get(type) ?? OTHER.key;
}

export function groupLabel(key: GroupKey): string {
  return [...GROUPS, OTHER].find((group) => group.key === key)?.label ?? "Other";
}
