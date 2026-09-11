import { PlusIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { detectFacetKeys, kindForFieldType } from "@/components/admin/data-table/filters";
import type { FieldColumn, EntryRow } from "@/components/admin/entry-table/columns";
import { EntryTableShell } from "@/components/admin/entry-table/entry-table-shell";
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { choicesFrom } from "@/lib/admin/field-values";
import { paramFromEntryId, toPlainText } from "@/lib/admin/field-values";
import {
  listAllEntries,
  listDefinitions,
  resolveColumns,
  NotAllowedError,
  type Definition,
  type Entry,
} from "@/lib/admin/metaobjects";
import { isDeletable, moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";

/**
 * The generic list screen: one table per metaobject definition, built from the
 * definition Shopify reports rather than from anything hardcoded here. Every definition
 * in the store gets this screen, including ones added after this file was written.
 */

async function load(slug: string): Promise<{ definition: Definition; entries: Entry[] } | null> {
  const type = typeForSlug(slug);

  try {
    // `assertAllowedType` would do, but the list is memoised for this request and the
    // sidebar has already paid for it.
    const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
    if (!definition) return null;

    return { definition, entries: await listAllEntries(type) };
  } catch (error) {
    // A type outside the allowlist reads as "no such screen" to the operator; the
    // distinction between NOT_ALLOWED and NOT_FOUND matters to the API, not here.
    if (error instanceof NotAllowedError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const loaded = await load(slug);

  return { title: loaded ? labelForDefinition(loaded.definition) : "Not found" };
}

export default async function EntryListPage({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const loaded = await load(slug);
  if (!loaded) return <ScreenNotFound description="That content type does not exist. It may have been deleted in Shopify." />;

  const { definition, entries } = loaded;
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
    label: column.label,
    kind: kindForFieldType(column.type),
    facetable: facetKeys.has(column.key),
    visible: column.visible,
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

      cells[column.key] = {
        kind,
        value: field?.value ?? null,
        labels: references.map(
          (reference) =>
            reference.displayName ||
            reference.title ||
            reference.alt ||
            reference.handle ||
            "Untitled",
        ),
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

  const readOnly = moduleDef.readOnly === true;
  const label = labelForDefinition(definition);
  const singular = label.replace(/s$/, "").toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title={label}
        meta={definition.type}
        description={
          readOnly
            ? `Submitted by customers. ${
                moduleDef.editableFields?.length
                  ? `Only ${moduleDef.editableFields.join(", ")} can be changed here.`
                  : "These entries cannot be edited here."
              }`
            : `${definition.fieldDefinitions.length} fields, edited straight on Shopify.`
        }
        actions={
          /* Hidden for read-only types as a courtesy. The refusal that matters is
             `assertWritable` in the data layer, which rejects a create for this type
             even when called directly with curl. */
          readOnly ? null : (
            <Button asChild size="sm">
              <AppLink href={`/admin/${definition.type}/new`} showPending={false}>
                <PlusIcon className="size-3.5" />
                New {singular}
              </AppLink>
            </Button>
          )
        }
      />

      <EntryTableShell
        type={definition.type}
        fields={fields}
        rows={rows}
        readOnly={readOnly}
        linkKey={linkKey}
        typeLabel={singular}
        /* A courtesy, so an operator is not offered a button that will refuse. The
           refusal itself lives in `assertDeletable`, which answers curl the same way. */
        deletable={isDeletable(definition.type)}
        orderField={
          moduleDef.orderField && byKey.has(moduleDef.orderField) ? moduleDef.orderField : null
        }
        excelExport={moduleDef.excelExport === true}
      />
    </div>
  );
}
