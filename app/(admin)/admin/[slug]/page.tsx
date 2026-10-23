import { PlusIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppLink } from "@/components/admin/app-link";
import { EntryTableShell } from "@/components/admin/entry-table/entry-table-shell";
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { buildEntryTableData } from "@/lib/admin/entry-table-data";
import {
  listAllEntries,
  listDefinitions,
  NotAllowedError,
  type Definition,
  type Entry,
} from "@/lib/admin/metaobjects";
import { fieldCopy } from "@/lib/admin/field-copy";
import { moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";
import { isSiteWide, siteWideTabHref } from "@/lib/admin/site-wide";

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

  // Before loading anything: a Site-wide type's list lives in its tab, and this URL is
  // still where the breadcrumb and old bookmarks point.
  if (isSiteWide(typeForSlug(slug))) redirect(siteWideTabHref(typeForSlug(slug)));

  const loaded = await load(slug);
  if (!loaded) return <ScreenNotFound description="We couldn’t find that list. The link may be wrong." />;

  const { definition, entries } = loaded;
  const moduleDef = moduleFor(definition.type);
  const table = buildEntryTableData(definition, entries);

  return (
    <div className="space-y-6">
      <PageHeader
        title={table.label}
        description={
          table.readOnly
            ? `Submitted by customers. ${
                moduleDef.editableFields?.length
                  ? `You can only change the ${moduleDef.editableFields
                      .map((key) => (fieldCopy(definition.type, key).label ?? key).toLowerCase())
                      .join(", ")} here.`
                  : "They can be read here but not changed."
              }`
            : (moduleDef.description ?? "Changes you save here go live on the site straight away.")
        }
        actions={
          /* Hidden for read-only types as a courtesy. The refusal that matters is
             `assertWritable` in the data layer, which rejects a create for this type
             even when called directly with curl. */
          table.readOnly ? null : (
            <Button asChild size="sm">
              <AppLink href={`/admin/${definition.type}/new`} showPending={false}>
                <PlusIcon className="size-3.5" />
                New {table.singular}
              </AppLink>
            </Button>
          )
        }
      />

      <EntryTableShell
        type={definition.type}
        fields={table.fields}
        rows={table.rows}
        readOnly={table.readOnly}
        linkKey={table.linkKey}
        typeLabel={table.singular}
        /* A courtesy, so an operator is not offered a button that will refuse. The
           refusal itself lives in `assertDeletable`, which answers curl the same way. */
        deletable={table.deletable}
        orderField={table.orderField}
        excelExport={table.excelExport}
      />
    </div>
  );
}
