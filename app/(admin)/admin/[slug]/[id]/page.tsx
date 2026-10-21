
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { DetailHeader } from "@/components/admin/detail-header";
import { InquiryDetail } from "@/components/admin/inquiries/inquiry-detail";
import { EntryForm } from "@/components/admin/entry-form";
import { Badge } from "@/components/admin/ui/badge";
import { entryIdFromParam, formatDate } from "@/lib/admin/field-values";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import { fieldCopy } from "@/lib/admin/field-copy";
import { getEntry, listDefinitions, NotAllowedError, NotFoundError } from "@/lib/admin/metaobjects";
import { moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";
import { listHrefFor, siteWideSection } from "@/lib/admin/site-wide";

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
  if (!loaded) return <ScreenNotFound description="We couldn’t find that. It may have been deleted." />;

  const { definition, entry } = loaded;
  const moduleDef = moduleFor(definition.type);

  /**
   * Inquiries get a purpose-built read-only view rather than the generic form: the record
   * is a customer's own submission, and a JSON blob of line items is unreadable inside a
   * disabled textarea where the same data as a table is obvious.
   *
   * Delegated from here rather than given its own `/admin/inquiry/[id]` route, because a
   * static `inquiry/` folder would also shadow `/admin/[slug]` for the LIST screen.
   */
  if (definition.type === "inquiry") {
    return <InquiryDetail param={id} />;
  }
  const specs = await buildFieldSpecs(definition, entry);
  const label = labelForDefinition(definition);

  return (
    /* No `max-w-3xl` on a read-only record: those are for reading, and a form that has
       nothing to submit does not need to be held to a comfortable typing width. */
    <div className={moduleDef.readOnly ? "w-full space-y-6" : "w-full max-w-3xl space-y-6"}>
      <DetailHeader
        // A Site-wide type has no list screen of its own; back goes to its tab.
        backHref={listHrefFor(definition.type)}
        backLabel={siteWideSection(definition.type)?.label ?? label}
        title={entry.displayName || entry.handle}
        readOnly={moduleDef.readOnly === true}
        status={
          entry.status ? (
            <Badge
              variant="outline"
              className={entry.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"}
            >
              {entry.status === "ACTIVE" ? "Published" : "Draft — not on the site"}
            </Badge>
          ) : undefined
        }
        meta={
          <>
            Last saved {formatDate(entry.updatedAt, true)}
            {moduleDef.readOnly && moduleDef.editableFields?.length
              ? ` · You can only change the ${moduleDef.editableFields
                  .map((key) => (fieldCopy(definition.type, key).label ?? key).toLowerCase())
                  .join(", ")} here — the rest is kept as the customer sent it.`
              : ""}
          </>
        }
      />

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
