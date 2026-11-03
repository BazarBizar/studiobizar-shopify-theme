import "server-only";

import { z } from "zod";

import { choicesFrom } from "./field-values";
import { assertAllowedType } from "./metaobjects";
import { moduleFor } from "./modules";
import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * "Add a choice": grows the fixed list of a field like a project's Category, which
 * Shopify keeps as a `choices` validation on the definition — so that adding
 * "Retail" to the list no longer means a developer editing the schema.
 *
 * Only for fields a module opens with `addableChoices`, only ever ADDING: removing or
 * renaming a choice would leave entries holding a value the definition refuses, and the
 * next save of any of them would fail.
 */

export class ChoiceError extends Error {
  readonly code: "INVALID" | "NOT_ALLOWED";
  constructor(code: ChoiceError["code"], message: string) {
    super(message);
    this.name = "ChoiceError";
    this.code = code;
  }
}

export const MAX_CHOICE_LENGTH = 60;
const MAX_CHOICES = 64;

export const addChoiceInput = z.strictObject({
  type: z.string().min(1).max(100),
  key: z.string().min(1).max(64),
  choice: z
    .string()
    .trim()
    .min(1, "Type the new choice.")
    .max(MAX_CHOICE_LENGTH, `A choice can be at most ${MAX_CHOICE_LENGTH} characters.`),
});

export async function addFieldChoice({ type, key, choice }: z.infer<typeof addChoiceInput>): Promise<string[]> {
  if (!moduleFor(type).addableChoices?.includes(key)) {
    throw new ChoiceError("NOT_ALLOWED", "New choices cannot be added to this field.");
  }
  const definition = await assertAllowedType(type);
  const field = definition.fieldDefinitions.find((candidate) => candidate.key === key);
  const current = choicesFrom(field?.validations);
  if (!field || current.length === 0) throw new ChoiceError("NOT_ALLOWED", "This field has no list of choices.");

  const existing = current.find((value) => value.toLowerCase() === choice.toLowerCase());
  if (existing) return current;
  if (current.length >= MAX_CHOICES) throw new ChoiceError("INVALID", `This list already has ${MAX_CHOICES} choices.`);

  const next = [...current, choice];
  // `update` replaces the field's validations, so every other one goes back as it was.
  const validations = [
    ...(field.validations ?? [])
      .filter((validation) => validation.name !== "choices")
      .map((validation) => ({ name: validation.name, value: validation.value ?? "" })),
    { name: "choices", value: JSON.stringify(next) },
  ];

  const data = await adminGraphQL<{
    metaobjectDefinitionUpdate: { userErrors: { field?: string[] | null; message: string; code?: string | null }[] };
  }>("metaobjectFieldChoicesUpdate", OPERATIONS.metaobjectFieldChoicesUpdate.document, {
    id: definition.id,
    definition: { fieldDefinitions: [{ update: { key, validations } }] },
  });
  assertNoUserErrors(data.metaobjectDefinitionUpdate.userErrors);
  return next;
}
