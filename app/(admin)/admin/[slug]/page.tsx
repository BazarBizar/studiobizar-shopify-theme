import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryTable, type Facet, type TableEntry } from "@/components/admin/entry-table";
import { toPlainText } from "@/lib/admin/field-values";
import {
  listAllEntries,
  listDefinitions,
  resolveColumns,
  NotAllowedError,
  type Definition,
  type Entry,
} from "@/lib/admin/metaobjects";
import { moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";

/**
 * The generic list screen: one table per metaobject definition, built from the
 * definition Shopify reports rather than from anything hardcoded here. Every
 * definition in the store gets this screen, including ones added after this file
 * was written.
 */

async function load(slug: string): Promise<{ definition: Definition; entries: Entry[] } | null> {
  const type = typeForSlug(slug);

  try {
    // `assertAllowedType` would do, but the list is memoised for this request and
    // the sidebar has already paid for it.
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
  if (!loaded) notFound();

  const { definition, entries } = loaded;
  const moduleDef = moduleFor(definition.type);
  const columns = resolveColumns(definition);

  const byKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));

  /**
   * Flattened here rather than in the client component so the table receives only
   * what it renders — no reference payloads, no rich text ASTs it would drop.
   */
  const rows: TableEntry[] = entries.map((entry) => {
    const cells: TableEntry["cells"] = {};

    for (const column of columns) {
      const field = entry.fields.find((candidate) => candidate.key === column.key);
      const image = field?.reference?.image?.url ?? null;

      cells[column.key] = {
        value: field?.value ?? null,
        type: field?.type ?? column.type,
        thumbnail: image,
      };
    }

    return {
      id: entry.id,
      handle: entry.handle,
      updatedAt: entry.updatedAt,
      displayName: entry.displayName,
      status: entry.status,
      cells,
    };
  });

  /**
   * Facet options come from the values actually present, unioned with any `choices`
   * validation. A choice nobody has used yet still needs to be selectable, and a
   * legacy value no longer in `choices` still needs to be findable.
   */
  const facets: Facet[] = (moduleDef.facets ?? [])
    .filter((key) => byKey.has(key))
    .map((key) => {
      const field = byKey.get(key)!;
      const present = new Set(
        entries
          .map((entry) => {
            const value = entry.fields.find((candidate) => candidate.key === key);
            return toPlainText(value?.type ?? field.type, value?.value);
          })
          .filter(Boolean),
      );

      return {
        key,
        label: field.name,
        options: [...present].sort((a, b) => a.localeCompare(b)),
      };
    })
    .filter((facet) => facet.options.length > 1);

  const searchFields = (moduleDef.searchFields ?? [])
    .filter((key) => byKey.has(key))
    .concat(
      // With no nominated search fields, fall back to every plain text field, so
      // search is never dead on a screen nobody has configured.
      moduleDef.searchFields
        ? []
        : definition.fieldDefinitions
            .filter((field) => field.type === "single_line_text_field")
            .map((field) => field.key),
    );

  const readOnly = moduleDef.readOnly === true;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-admin-fg text-lg font-semibold">{labelForDefinition(definition)}</h1>
          <p className="text-admin-muted mt-0.5 text-xs">
            <code>{definition.type}</code> · {definition.fieldDefinitions.length} fields
            {readOnly ? " · read-only" : ""}
          </p>
        </div>

        {/* Hidden for read-only types as a courtesy. The refusal that matters is
            `assertWritable` in the data layer, which rejects a create for this type
            even when called directly with curl. */}
        {readOnly ? (
          <p className="bg-admin-warn-bg text-admin-warn rounded-admin max-w-md px-3 py-2 text-xs">
            These entries are submitted by customers.
            {moduleDef.editableFields?.length
              ? ` Only ${moduleDef.editableFields.join(", ")} can be changed here.`
              : " They cannot be edited here."}
          </p>
        ) : (
          <Link
            href={`/admin/${definition.type}/new`}
            className="bg-admin-accent text-admin-accent-fg rounded-admin px-3 py-2"
          >
            New {labelForDefinition(definition).replace(/s$/, "").toLowerCase()}
          </Link>
        )}
      </div>

      <EntryTable
        type={definition.type}
        columns={columns}
        entries={rows}
        facets={facets}
        searchFields={[...new Set(searchFields)]}
        orderField={moduleDef.orderField && byKey.has(moduleDef.orderField) ? moduleDef.orderField : null}
        readOnly={readOnly}
        load={moduleDef.load ?? "client"}
      />
    </div>
  );
}
