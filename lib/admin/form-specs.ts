import "server-only";

import {
  choicesFrom,
  fileKindFrom,
  referenceDefinitionId,
  type FieldSpec,
} from "./form-fields";
import { listDefinitions, type Definition, type Entry, type EntryReference } from "./metaobjects";
import { moduleFor } from "./modules";

/**
 * Builds the form for a definition, resolved against the live Shopify definition
 * every time. There is no per-type form anywhere in this repo: a field added in
 * Shopify appears on the next page load, with the input its type implies.
 */

function referenceLabel(reference: EntryReference): string {
  return (
    reference.displayName ||
    reference.title ||
    reference.alt ||
    reference.handle ||
    reference.id ||
    "Untitled"
  );
}

function referenceThumbnail(reference: EntryReference): string | null {
  return reference.image?.url ?? null;
}

export async function buildFieldSpecs(
  definition: Definition,
  entry: Entry | null,
): Promise<FieldSpec[]> {
  const moduleDef = moduleFor(definition.type);
  const readOnly = moduleDef.readOnly === true;
  const editableFields = new Set(moduleDef.editableFields ?? []);

  /**
   * `metaobject_definition_id` validations carry a gid, and only the definition list
   * can turn one into a type the picker can query. Built once per form rather than
   * per field.
   */
  const typeByDefinitionId = new Map(
    (await listDefinitions()).map((candidate) => [candidate.id, candidate.type]),
  );

  return definition.fieldDefinitions.map((field) => {
    const stored = entry?.fields.find((candidate) => candidate.key === field.key);

    const single = stored?.reference ?? null;
    const many = stored?.references?.nodes ?? [];

    /**
     * Read-only is surfaced here so the form can dim the control, but this is NOT
     * the enforcement. `assertWritable` in `lib/admin/metaobjects.ts` refuses the
     * write itself, which is what stops a direct call to the API.
     *
     * On create, `editableFields` never applies: a read-only type cannot be authored
     * at all, so every field is locked.
     */
    const editable = !readOnly || (entry !== null && editableFields.has(field.key));

    return {
      key: field.key,
      name: field.name,
      description: field.description,
      required: field.required,
      type: field.type,
      choices: choicesFrom(field.validations),
      targetType: (() => {
        const definitionId = referenceDefinitionId(field.validations);
        if (!definitionId) return null;
        // Unresolvable means the target definition is not visible to this token;
        // the picker shows that plainly rather than offering an empty list.
        return typeByDefinitionId.get(definitionId) ?? null;
      })(),
      fileKind: fileKindFrom(field.validations),
      currentFile: single
        ? { thumbnail: referenceThumbnail(single), alt: single.alt ?? null }
        : null,
      currentRefs: (single ? [single] : many).map((reference) => ({
        id: reference.id ?? "",
        label: referenceLabel(reference),
        thumbnail: referenceThumbnail(reference),
      })),
      editable,
      initialValue: stored?.value ?? "",
    } satisfies FieldSpec;
  });
}
