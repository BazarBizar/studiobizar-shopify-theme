import "server-only";

import { parseList } from "./field-values";
import type { FieldSpec } from "./form-fields";
import { listCollections } from "./collections";
import type { EntryReference } from "./metaobjects";
import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

export function referenceLabel(reference: EntryReference): string {
  return (
    reference.displayName ||
    reference.title ||
    reference.alt ||
    reference.handle ||
    reference.id ||
    "Untitled"
  );
}

export function referenceThumbnail(reference: EntryReference): string | null {
  return (
    reference.image?.url ??
    reference.preview?.image?.url ??
    reference.featuredMedia?.preview?.image?.url ??
    // A captioned image, a designer, a project: its first photo stands for it.
    reference.fields?.find((field) => field.reference?.image?.url)?.reference?.image?.url ??
    null
  );
}

/**
 * Fills `currentRefs` for forms whose stored values are bare gids — product and page
 * metafields — so a chosen designer or collection shows as its name and picture, never
 * as `gid://shopify/…`. Best effort: a failed lookup leaves the form usable, with the
 * picker resolving what it can on its own.
 */
export async function withReferencePreviews(specs: FieldSpec[]): Promise<FieldSpec[]> {
  const isReference = (spec: FieldSpec) =>
    spec.type.endsWith("_reference") && !spec.type.endsWith("file_reference");

  const idsOf = (spec: FieldSpec) =>
    spec.type.startsWith("list.") ? parseList(spec.initialValue) : spec.initialValue ? [spec.initialValue] : [];

  const ids = [...new Set(specs.filter(isReference).flatMap(idsOf))];
  if (ids.length === 0) return withCollectionOptions(specs);

  let byId = new Map<string, EntryReference>();
  try {
    const data = await adminGraphQL<{ nodes: (EntryReference | null)[] }>(
      "referencePreviews",
      OPERATIONS.referencePreviews.document,
      { ids },
    );
    byId = new Map(
      data.nodes.filter((node): node is EntryReference => Boolean(node?.id)).map((node) => [node.id!, node]),
    );
  } catch (error) {
    console.error("[admin] could not resolve reference previews", error);
    return withCollectionOptions(specs);
  }

  const resolved = specs.map((spec) =>
    isReference(spec)
      ? {
          ...spec,
          currentRefs: idsOf(spec).flatMap((id) => {
            const reference = byId.get(id);
            return reference
              ? [{ id, label: referenceLabel(reference), thumbnail: referenceThumbnail(reference) }]
              : [];
          }),
        }
      : spec,
  );

  return withCollectionOptions(resolved);
}

/**
 * Collections are few, so a collection field's picker gets the whole list up front
 * rather than a search endpoint of its own. Loaded only when a form has such a field.
 */
export async function withCollectionOptions(specs: FieldSpec[]): Promise<FieldSpec[]> {
  if (!specs.some((spec) => spec.type.endsWith("collection_reference"))) return specs;

  let options: FieldSpec["collectionOptions"] = [];
  try {
    options = (await listCollections()).map((collection) => ({
      id: collection.id,
      label: collection.title,
      thumbnail: collection.image?.url ?? null,
    }));
  } catch (error) {
    console.error("[admin] could not list collections for a picker", error);
  }

  return specs.map((spec) =>
    spec.type.endsWith("collection_reference") ? { ...spec, collectionOptions: options } : spec,
  );
}
