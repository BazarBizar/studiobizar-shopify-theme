import "server-only";

import { detectFacetKeys, kindForFieldType } from "@/components/admin/data-table/filters";
import type { EntryRow, FieldColumn } from "@/components/admin/entry-table/columns";
import { fieldCopy } from "@/lib/admin/field-copy";
import { choicesFrom, paramFromEntryId, parseList, toPlainText } from "@/lib/admin/field-values";
import { resolveColumns, type Definition, type Entry } from "@/lib/admin/metaobjects";
import { isDeletable, moduleFor } from "@/lib/admin/modules";
import { labelForDefinition } from "@/lib/admin/navigation";

/**
 * Everything `EntryTableShell` needs for one metaobject type, built from the definition
 * Shopify reports. Shared by the type's own list screen and by the Site-wide tabs that
 * embed the same table, so the two can never drift.
 */
export type EntryTableData = {
  fields: FieldColumn[];
  rows: EntryRow[];
  linkKey: string | null;
  readOnly: boolean;
  deletable: boolean;
  orderField: string | null;
  excelExport: boolean;
  /** Plural display name, "Locations". */
  label: string;
  /** Lower-case singular for buttons, "location". */
  singular: string;
};

export function buildEntryTableData(definition: Definition, entries: Entry[]): EntryTableData {
  const moduleDef = moduleFor(definition.type);
  const resolved = resolveColumns(definition);
  const byKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));

  const columnKinds = resolved.map((column) => ({
    key: column.key,
    kind: kindForFieldType(column.type),
  }));

  /**
   * Distinct-value counts, so `detectFacetKeys` can decide which columns cluster
   * usefully and which are effectively unique per row.
   */
  const distinctCounts: Record<string, number> = {};
  for (const { key } of columnKinds) {
    const values = new Set<string>();
    for (const entry of entries) {
      const field = entry.fields.find((candidate) => candidate.key === key);
      values.add(toPlainText(field?.type ?? "single_line_text_field", field?.value));
    }
    distinctCounts[key] = values.size;
  }

  const facetKeys = new Set(
    detectFacetKeys({
      columns: columnKinds,
      rowCount: entries.length,
      distinctCounts,
      explicit: moduleDef.facets ?? [],
      hasChoices: (key) => choicesFrom(byKey.get(key)?.validations).length > 0,
    }),
  );

  const fields: FieldColumn[] = resolved.map((column) => ({
    key: column.key,
    label: fieldCopy(definition.type, column.key).label ?? column.label,
    kind: kindForFieldType(column.type),
    facetable: facetKeys.has(column.key),
    // The order column only repeats what the drag handles already show.
    visible: column.visible && column.key !== moduleDef.orderField,
    width: kindForFieldType(column.type) === "media" ? "4rem" : undefined,
  }));

  /**
   * Which column doubles as the link into the record.
   *
   * Taken from Shopify's `displayNameKey` — the definition's own answer to "what
   * identifies one of these" — so this is right for every type at once rather than a
   * per-type list that goes stale the moment a definition is added. It is `name` on
   * designer, `title` on project and service, `caption` on captioned_image,
   * `question` on faq_item, `inquiry_id` on inquiry.
   *
   * Restricted to text kinds: a definition whose display name is a reference or a file
   * renders as a badge or a thumbnail, and wrapping either in a link would fight the
   * cell renderer. When nothing qualifies, the first visible text column takes the job,
   * and failing that the actions column is still there.
   */
  const linkable = (field: FieldColumn) => field.kind === "text" || field.kind === "longtext";

  const linkKey =
    fields.find((field) => field.key === definition.displayNameKey && linkable(field))?.key ??
    fields.find((field) => field.visible && linkable(field))?.key ??
    null;

  /**
   * Flattened here rather than in the client component, so the table receives only what
   * it renders — no reference payloads, no rich text ASTs it would drop.
   */
  const rows: EntryRow[] = entries.map((entry) => {
    const cells: EntryRow["cells"] = {};

    for (const column of resolved) {
      const field = entry.fields.find((candidate) => candidate.key === column.key);
      const kind = kindForFieldType(column.type);

      const references = field?.references?.nodes ?? (field?.reference ? [field.reference] : []);

      const choiceLabels = fieldCopy(definition.type, column.key).choiceLabels;

      cells[column.key] = {
        kind,
        // A stored code like `product_inquiry` is shown by its name.
        value: (field?.value && choiceLabels?.[field.value]) || (field?.value ?? null),
        // A list of references is labelled by what it points at; a list of plain
        // values — emails, text — by the values themselves.
        labels: references.length
          ? references.map(
              (reference) =>
                reference.displayName ||
                reference.title ||
                reference.alt ||
                reference.handle ||
                "Untitled",
            )
          : kind === "list"
            ? parseList(field?.value)
            : [],
        thumbnail: field?.reference?.image?.url ?? references[0]?.image?.url ?? null,
      };
    }

    return {
      id: entry.id,
      param: paramFromEntryId(entry.id),
      handle: entry.handle,
      displayName: entry.displayName,
      updatedAt: entry.updatedAt,
      cells,
    };
  });

  const label = labelForDefinition(definition);

  return {
    fields,
    rows,
    linkKey,
    readOnly: moduleDef.readOnly === true,
    deletable: isDeletable(definition.type),
    orderField:
      moduleDef.orderField && byKey.has(moduleDef.orderField) ? moduleDef.orderField : null,
    excelExport: moduleDef.excelExport === true,
    label,
    singular: moduleDef.singular ?? label.replace(/s$/, "").toLowerCase(),
  };
}
