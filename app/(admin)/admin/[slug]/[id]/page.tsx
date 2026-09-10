import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/admin/detail-header";
import { EntryForm } from "@/components/admin/entry-form";
import { Badge } from "@/components/admin/ui/badge";
import { entryIdFromParam, formatDate } from "@/lib/admin/field-values";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import { getEntry, listDefinitions, NotAllowedError, NotFoundError } from "@/lib/admin/metaobjects";
import { moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";

/**
 * Edit one entry. Generic: the fields, their inputs and their validation all come from
 * the Shopify definition, so this file never needs touching when the content model
 * changes.
 */

async function load(slug: string, idParam: string) {
  const type = typeForSlug(slug);

  // Rejected before Shopify is called: the URL segment is the numeric part of a
  // metaobject gid, and anything else is not worth a round trip.
  const id = entryIdFromParam(idParam);
  if (!id) return null;

  const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
  if (!definition) return null;

  try {
    const entry = await getEntry(id);

    // An id of the right shape but belonging to another type would otherwise render one
    // definition's form over another definition's data.
    if (entry.type !== type) return null;

    return { definition, entry };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof NotAllowedError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/admin/[slug]/[id]">) {
  const { slug, id } = await params;
  const loaded = await load(slug, id);

  return { title: loaded ? loaded.entry.displayName || loaded.entry.handle : "Not found" };
}

export default async function EntryEditPage({ params }: PageProps<"/admin/[slug]/[id]">) {
  const { slug, id } = await params;
  const loaded = await load(slug, id);
  if (!loaded) notFound();

  const { definition, entry } = loaded;
  const moduleDef = moduleFor(definition.type);
  const specs = await buildFieldSpecs(definition, entry);
  const label = labelForDefinition(definition);

  return (
    /* No `max-w-3xl` on a read-only record: those are for reading, and a form that has
       nothing to submit does not need to be held to a comfortable typing width. */
    <div className={moduleDef.readOnly ? "w-full space-y-6" : "w-full max-w-3xl space-y-6"}>
      <DetailHeader
        backHref={`/admin/${definition.type}`}
        backLabel={label}
        title={entry.displayName || entry.handle}
        meta={entry.handle}
        readOnly={moduleDef.readOnly === true}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-xs">
          Updated {formatDate(entry.updatedAt, true)}
        </p>
        {entry.status ? (
          <Badge variant="outline" className="text-[11px] font-normal">
            {entry.status.toLowerCase()}
          </Badge>
        ) : null}
        {moduleDef.readOnly && moduleDef.editableFields?.length ? (
          <p className="text-muted-foreground text-xs">
            Only {moduleDef.editableFields.join(", ")} can be changed — the rest is kept as
            the customer sent it.
          </p>
        ) : null}
      </div>

      <EntryForm
        mode="update"
        type={definition.type}
        typeLabel={label}
        entryId={entry.id}
        specs={specs}
      />
    </div>
  );
}
