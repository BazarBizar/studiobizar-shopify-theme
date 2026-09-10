import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/admin/entry-form";
import { entryIdFromParam, formatDate } from "@/lib/admin/field-values";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import {
  getEntry,
  listDefinitions,
  NotAllowedError,
  NotFoundError,
} from "@/lib/admin/metaobjects";
import { moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";

/**
 * Edit one entry. Generic: the fields, their inputs and their validation all come
 * from the Shopify definition, so this file never needs touching when the content
 * model changes.
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

    // An id of the right shape but belonging to another type would otherwise render
    // one definition's form over another definition's data.
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

  return {
    title: loaded ? (loaded.entry.displayName || loaded.entry.handle) : "Not found",
  };
}

export default async function EntryEditPage({ params }: PageProps<"/admin/[slug]/[id]">) {
  const { slug, id } = await params;
  const loaded = await load(slug, id);
  if (!loaded) notFound();

  const { definition, entry } = loaded;
  const moduleDef = moduleFor(definition.type);
  const specs = await buildFieldSpecs(definition, entry);

  const readOnlyNotice = moduleDef.readOnly
    ? moduleDef.editableFields?.length
      ? `Submitted by a customer. Only ${moduleDef.editableFields.join(", ")} can be changed — the rest is kept as it was sent.`
      : "Submitted by a customer and not editable here."
    : null;

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/admin/${definition.type}`}
          className="text-admin-muted hover:text-admin-fg text-xs"
        >
          ← {labelForDefinition(definition)}
        </Link>

        <h1 className="text-admin-fg mt-1 text-lg font-semibold">
          {entry.displayName || entry.handle}
        </h1>

        <p className="text-admin-muted mt-0.5 text-xs">
          <code>{entry.handle}</code> · updated {formatDate(entry.updatedAt, true)}
          {entry.status ? ` · ${entry.status.toLowerCase()}` : ""}
        </p>
      </div>

      <EntryForm
        mode="update"
        type={definition.type}
        typeLabel={labelForDefinition(definition)}
        entryId={entry.id}
        specs={specs}
        readOnlyNotice={readOnlyNotice}
      />
    </div>
  );
}
