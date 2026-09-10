import "server-only";

import { parseList } from "./field-values";
import { listEntries, updateEntry } from "./metaobjects";

/**
 * The `site_settings` singleton, created by `scripts/add-collection-tiers.mjs`.
 *
 * Store-wide defaults live here rather than as a Shop-level metafield with a bespoke
 * screen, because a metaobject singleton already gets the generic form for free — so
 * adding a new setting later is a field in Shopify, not a new page in this panel.
 */

export const SITE_SETTINGS_TYPE = "site_settings";

export type FeaturedCollectionsState = {
  /** null when the migration has not been run on this store. */
  settingsId: string | null;
  /** Collection gids, in the order the storefront should show them. */
  selected: string[];
};

async function loadSingleton() {
  const page = await listEntries({ type: SITE_SETTINGS_TYPE, first: 2 });
  return page.entries[0] ?? null;
}

export async function getFeaturedCollections(): Promise<FeaturedCollectionsState> {
  const entry = await loadSingleton();
  if (!entry) return { settingsId: null, selected: [] };

  const field = entry.fields.find((candidate) => candidate.key === "featured_collections");

  return {
    settingsId: entry.id,
    // Stored as a JSON array of gids, like every `list.*` value.
    selected: parseList(field?.value),
  };
}

/**
 * Writes the featured list back.
 *
 * Goes through `updateEntry`, so the metaobject data layer's own rules still apply —
 * `assertWritable` and the type allowlist are not bypassed just because this happens to
 * be reached from the Collections screen.
 */
export async function setFeaturedCollections(id: string, collectionIds: string[]) {
  return updateEntry(id, [
    { key: "featured_collections", value: JSON.stringify(collectionIds) },
  ]);
}
