import "server-only";

import {
  choicesFrom,
  fileKindFrom,
  referenceDefinitionId,
  type FieldSpec,
} from "./form-fields";
import { fieldCopy } from "./field-copy";
import { referenceLabel, referenceThumbnail, withCollectionOptions } from "./reference-previews";
import {
  listAllEntries,
  listDefinitions,
  type Definition,
  type Entry,
} from "./metaobjects";
import { moduleFor } from "./modules";

/**
 * Builds the form for a definition, resolved against the live Shopify definition
 * every time. There is no per-type form anywhere in this repo: a field added in
 * Shopify appears on the next page load, with the input its type implies.
 */


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

  /**
   * The manual order is set by dragging rows in the list, so the form never shows it.
   * A NEW entry still needs a value — it goes to the end of the list.
   */
  const orderField = definition.fieldDefinitions.some((field) => field.key === moduleDef.orderField)
    ? moduleDef.orderField
    : undefined;
  const nextPosition =
    orderField && entry === null ? await nextOrderValue(definition.type, orderField) : null;

  const specs = definition.fieldDefinitions.map((field) => {
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
    const copy = fieldCopy(definition.type, field.key);

    return {
      key: field.key,
      name: copy.label ?? field.name,
      description: copy.help ?? field.description,
      hidden: copy.hidden === true || field.key === orderField,
      choiceLabels: copy.choiceLabels ?? {},
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
      collectionOptions: [],
      editable,
      initialValue:
        stored?.value ?? (field.key === orderField && nextPosition !== null ? String(nextPosition) : ""),
    } satisfies FieldSpec;
  });

  return withCollectionOptions(specs);
}

/** One past the highest position in use, so a new entry lands at the end of the list. */
async function nextOrderValue(type: string, key: string): Promise<number> {
  try {
    const entries = await listAllEntries(type);
    const positions = entries
      .map((entry) => Number(entry.fields.find((field) => field.key === key)?.value))
      .filter((value) => Number.isFinite(value));
    return positions.length ? Math.max(...positions) + 1 : 1;
  } catch {
    return 1;
  }
}
