import { PlusIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { EntryForm } from "@/components/admin/entry-form";
import { EntryTableShell } from "@/components/admin/entry-table/entry-table-shell";
import { PageHeader } from "@/components/admin/page-header";
import { SiteWideTabs } from "@/components/admin/site-wide/site-wide-tabs";
import { Button } from "@/components/admin/ui/button";
import { buildEntryTableData } from "@/lib/admin/entry-table-data";
import { formatDate } from "@/lib/admin/field-values";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import {
  getEntry,
  listAllEntries,
  listDefinitions,
  type Definition,
} from "@/lib/admin/metaobjects";
import { SITE_WIDE_SECTIONS, type SiteWideSection } from "@/lib/admin/site-wide";

export const metadata = { title: "Site-wide" };

/**
 * Settings for the whole site, one tab per type — see `lib/admin/site-wide.ts` for which
 * types, in what order, and why a singleton tab is a form while a collection tab is a
 * table. A static segment, so it wins over `/admin/[slug]`; `site-wide` is reserved in
 * `navigation.ts` for the same reason `media` is.
 */
export default async function SiteWidePage({ searchParams }: PageProps<"/admin/site-wide">) {
  const { tab } = await searchParams;

  // A tab only for a type that exists in THIS store. A section whose definition has not
  // been created yet would otherwise be a tab that can only say "not found".
  const definitions = await listDefinitions();
  const byType = new Map(definitions.map((definition) => [definition.type, definition]));
  const available = SITE_WIDE_SECTIONS.filter((section) => byType.has(section.type));

  const active = available.find((section) => section.type === tab) ?? available[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site-wide"
        description="Settings that belong to the whole site rather than to one page. Each tab is a metaobject in Shopify."
      />

      {active ? (
        <>
          <SiteWideTabs
            tabs={available.map((section) => ({ value: section.type, label: section.label }))}
            active={active.type}
          />

          <p className="text-muted-foreground max-w-3xl text-sm">{active.description}</p>

          {/* Keyed by type, so moving between two singleton tabs mounts a fresh form
              rather than carrying one form's state into the other. */}
          <div key={active.type}>
            {active.kind === "singleton" ? (
              <SingletonPane section={active} definition={byType.get(active.type)!} />
            ) : (
              <CollectionPane section={active} definition={byType.get(active.type)!} />
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground rounded-md border p-6 text-sm">
          None of the Site-wide types exist in this store yet.
        </p>
      )}
    </div>
  );
}

async function SingletonPane({
  section,
  definition,
}: {
  section: SiteWideSection;
  definition: Definition;
}) {
  const entries = await listAllEntries(definition.type);
  const first = entries[0];

  if (!first) {
    return (
      <div className="max-w-3xl rounded-md border p-6 text-sm">
        <p>This setting has no entry yet, so there is nothing to edit.</p>
        {section.setup ? (
          <p className="text-muted-foreground mt-2">
            Create it with <code className="font-mono text-xs">{section.setup}</code>.
          </p>
        ) : null}
      </div>
    );
  }

  // The full record, as the edit screen reads it — the listing's copy of an entry is
  // shaped for a table, not for a form.
  const entry = await getEntry(first.id);
  const specs = await buildFieldSpecs(definition, entry);

  return (
    <div className="w-full max-w-3xl space-y-4">
      <p className="text-muted-foreground text-xs">
        Updated {formatDate(entry.updatedAt, true)}
        {entries.length > 1
          ? ` · ${entries.length} entries exist; this is the first, and the only one the site reads.`
          : ""}
      </p>

      <EntryForm
        mode="update"
        type={definition.type}
        typeLabel={section.label}
        entryId={entry.id}
        specs={specs}
      />
    </div>
  );
}

async function CollectionPane({
  section,
  definition,
}: {
  section: SiteWideSection;
  definition: Definition;
}) {
  const table = buildEntryTableData(definition, await listAllEntries(definition.type));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {table.rows.length} {table.rows.length === 1 ? "entry" : "entries"}
        </p>
        {table.readOnly ? null : (
          <Button asChild size="sm">
            <AppLink href={`/admin/${definition.type}/new`} showPending={false}>
              <PlusIcon className="size-3.5" />
              New {section.label.replace(/s$/, "").toLowerCase()}
            </AppLink>
          </Button>
        )}
      </div>

      <EntryTableShell
        type={definition.type}
        fields={table.fields}
        rows={table.rows}
        readOnly={table.readOnly}
        linkKey={table.linkKey}
        typeLabel={table.singular}
        deletable={table.deletable}
        orderField={table.orderField}
        excelExport={table.excelExport}
      />
    </div>
  );
}
