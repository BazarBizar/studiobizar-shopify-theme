import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/admin/entry-form";
import { buildFieldSpecs } from "@/lib/admin/form-specs";
import { listDefinitions } from "@/lib/admin/metaobjects";
import { isReadOnly } from "@/lib/admin/modules";
import { labelForDefinition, typeForSlug } from "@/lib/admin/navigation";

/**
 * Create one entry. Safe as a sibling of `[id]` because an entry id is always
 * digits, so `new` can never be mistaken for one.
 */

async function load(slug: string) {
  const type = typeForSlug(slug);
  const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
  if (!definition) return null;

  /**
   * A read-only type has no create screen at all — not a form with a disabled
   * button. `assertWritable` refuses the write regardless, but sending an operator
   * to a form they cannot submit is its own small cruelty.
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
  if (!definition) notFound();

  const specs = await buildFieldSpecs(definition, null);
  const label = labelForDefinition(definition);
  const singular = label.replace(/s$/, "");

  return (
    <div>
      <div className="mb-5">
        <Link href={`/admin/${definition.type}`} className="text-admin-muted hover:text-admin-fg text-xs">
          ← {label}
        </Link>

        <h1 className="text-admin-fg mt-1 text-lg font-semibold">New {singular.toLowerCase()}</h1>
        <p className="text-admin-muted mt-0.5 text-xs">
          <code>{definition.type}</code>
        </p>
      </div>

      <EntryForm
        mode="create"
        type={definition.type}
        typeLabel={singular.toLowerCase()}
        entryId={null}
        specs={specs}
        readOnlyNotice={null}
      />
    </div>
  );
}
