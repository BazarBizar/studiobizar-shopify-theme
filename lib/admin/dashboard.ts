import "server-only";

import { listAllEntries, listDefinitions, type Entry } from "./metaobjects";
import { moduleFor } from "./modules";
import { isTrue } from "./field-values";

/**
 * What the dashboard needs, gathered deliberately cheaply.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: do not pull a table's worth of data to decorate
 * one number. The panel's landing screen is the page opened most often, so every query
 * here is one an operator pays for on every visit.
 *
 * Definition metadata comes from the request-memoised `listDefinitions()`, which the
 * sidebar has already fetched — so the counts of types and fields cost nothing extra.
 * Entries are loaded only for the handful of types the screen actually shows, and the
 * derived figures (selected projects, unread inquiries) are computed from those same
 * rows rather than fetched again.
 *
 * `metaobjectsCount` is deliberately not used anywhere here: measured against this store
 * it under-reported by 9 on one type and over-reported on another. See the note in
 * `lib/admin/navigation.ts`.
 */

export type PartToWhole = { label: string; value: number }[];

export type RecentEntry = {
  id: string;
  param: string;
  type: string;
  title: string;
  meta: string;
  thumbnail: string | null;
};

export type DashboardData = {
  definitionCount: number;
  fieldCount: number;
  /** Editable content entries across every writable type. */
  contentCount: number;
  readOnlyCount: number;
  /** Projects by their `is_selected` flag — the one genuine part-to-whole here. */
  projectSplit: PartToWhole;
  projectTotal: number;
  inquiriesNew: number;
  inquiriesTotal: number;
  imagesTotal: number;
  recentProjects: RecentEntry[];
  recentImages: RecentEntry[];
};

const fieldValue = (entry: Entry, key: string) =>
  entry.fields.find((field) => field.key === key)?.value ?? null;

const thumbnailOf = (entry: Entry) =>
  entry.fields.find((field) => field.reference?.image?.url)?.reference?.image?.url ?? null;

const toRecent = (entry: Entry, meta: string): RecentEntry => ({
  id: entry.id,
  param: entry.id.split("/").pop() ?? entry.id,
  type: entry.type,
  title: entry.displayName || entry.handle,
  meta,
  thumbnail: thumbnailOf(entry),
});

const byUpdatedDesc = (a: Entry, b: Entry) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export async function getDashboardData(): Promise<DashboardData> {
  const definitions = await listDefinitions();

  const writable = definitions.filter((definition) => !moduleFor(definition.type).readOnly);
  const readOnly = definitions.filter((definition) => moduleFor(definition.type).readOnly);

  /**
   * Only the types this screen reports on. Everything else contributes its definition
   * metadata but not its rows — loading all eight collections to show two lists would be
   * exactly the mistake this module is written to avoid.
   */
  const detailTypes = ["project", "captioned_image", "inquiry"].filter((type) =>
    definitions.some((definition) => definition.type === type),
  );

  const loaded = new Map<string, Entry[]>();
  await Promise.all(
    detailTypes.map(async (type) => {
      loaded.set(type, await listAllEntries(type).catch(() => []));
    }),
  );

  const projects = loaded.get("project") ?? [];
  const images = loaded.get("captioned_image") ?? [];
  const inquiries = loaded.get("inquiry") ?? [];

  const selected = projects.filter((entry) => isTrue(fieldValue(entry, "is_selected"))).length;

  /**
   * Computed from the same rows already in memory, and with the real rule rather than a
   * raw field: "new" is the status the storefront writes on submission, so anything else
   * has been dealt with.
   */
  const inquiriesNew = inquiries.filter((entry) => fieldValue(entry, "status") === "new").length;

  return {
    definitionCount: definitions.length,
    fieldCount: definitions.reduce(
      (total, definition) => total + definition.fieldDefinitions.length,
      0,
    ),
    contentCount: writable.length,
    readOnlyCount: readOnly.length,
    projectSplit: [
      { label: "Selected", value: selected },
      { label: "Not selected", value: projects.length - selected },
    ],
    projectTotal: projects.length,
    inquiriesNew,
    inquiriesTotal: inquiries.length,
    imagesTotal: images.length,
    recentProjects: [...projects]
      .sort(byUpdatedDesc)
      .slice(0, 4)
      .map((entry) =>
        toRecent(entry, [fieldValue(entry, "location"), fieldValue(entry, "year")].filter(Boolean).join(" · ")),
      ),
    recentImages: [...images]
      .sort(byUpdatedDesc)
      .slice(0, 4)
      .map((entry) => toRecent(entry, fieldValue(entry, "credit") || "No credit")),
  };
}
