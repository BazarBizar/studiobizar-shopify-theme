/**
 * The contract between the server that builds a form and the client that renders it.
 *
 * NO `server-only`: both halves need this type, and the pure derivations below are
 * used on the server while the type is used in the browser. Nothing here touches
 * Shopify or reads a secret — the parts that do live in `lib/admin/form-specs.ts`.
 */

import { choicesFrom, parseList, validationValue } from "./field-values";

export type FieldSpec = {
  key: string;
  name: string;
  description: string | null;
  required: boolean;
  /** Shopify field type, e.g. `single_line_text_field`, `list.file_reference`. */
  type: string;
  /** Empty unless the field has a `choices` validation. */
  choices: string[];
  /** For metaobject references: the target definition's type. Resolved server-side. */
  targetType: string | null;
  /** For file references, narrowed from `file_type_options`. */
  fileKind: "image" | "video" | "any";
  /** What the stored value points at now, so the form shows it without a round trip. */
  currentFile: { thumbnail: string | null; alt: string | null } | null;
  currentRefs: { id: string; label: string; thumbnail: string | null }[];
  /** False when the type is read-only and this field is not in `editableFields`. */
  editable: boolean;
  initialValue: string;
};

type Validations = { name: string; value: string | null }[];

/**
 * Narrows a `file_reference` picker to what the field will actually accept.
 * Shopify expresses this as a `file_type_options` validation holding a JSON array
 * like `["Image"]`. Getting this wrong is not cosmetic: offering a video for an
 * image-only field produces a save Shopify rejects with an opaque message.
 */
export function fileKindFrom(validations: Validations): "image" | "video" | "any" {
  const options = parseList(validationValue(validations, "file_type_options")).map((option) =>
    option.toLowerCase(),
  );

  if (options.length === 1 && options[0] === "image") return "image";
  if (options.length === 1 && options[0] === "video") return "video";
  return "any";
}

/** The gid of the metaobject definition a reference field points at, if any. */
export function referenceDefinitionId(validations: Validations): string | null {
  return validationValue(validations, "metaobject_definition_id");
}

export { choicesFrom };
