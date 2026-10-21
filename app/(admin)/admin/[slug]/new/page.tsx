
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { DetailHeader } from "@/components/admin/detail-header";
import { EntryForm } from "@/components/admin/entry-form";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import { listDefinitions } from "@/lib/admin/metaobjects";
import { isReadOnly, moduleFor } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";
import { listHrefFor, siteWideSection } from "@/lib/admin/site-wide";

/**
 * Create one entry. Safe as a sibling of `[id]` because an entry id is always digits, so
 * `new` can never be mistaken for one.
 */

async function load(slug: string) {
  const type = typeForSlug(slug);
  const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
  if (!definition) return null;

  /**
   * A read-only type has no create screen at all — not a form with a disabled button.
   * `assertWritable` refuses the write regardless, but sending an operator to a form they
   * cannot submit is its own small cruelty.
   */
  if (isReadOnly(type)) return null;

  return definition;
}

export async function generateMetadata({ params }: PageProps<"/admin/[slug]/new">) {
  const { slug } = await params;
  const definition = await load(slug);

  return { title: definition ? `New ${labelForDefinition(definition)}` : "Not found" };
}

export default async function EntryCreatePage({ params }: PageProps<"/admin/[slug]/new">) {
  const { slug } = await params;
  const definition = await load(slug);
  if (!definition) return <ScreenNotFound description="This can’t be created here." />;

  const specs = await buildFieldSpecs(definition, null);
  const label = labelForDefinition(definition);
  const singular = moduleFor(definition.type).singular ?? label.replace(/s$/, "").toLowerCase();

  return (
    <div className="w-full max-w-3xl space-y-6">
      <DetailHeader
        // A Site-wide type has no list screen of its own; back goes to its tab.
        backHref={listHrefFor(definition.type)}
        backLabel={siteWideSection(definition.type)?.label ?? label}
        title={`New ${singular}`}
      />

      <EntryForm
        mode="create"
        type={definition.type}
        typeLabel={singular}
        entryId={null}
        specs={specs}
      />
    </div>
  );
}
