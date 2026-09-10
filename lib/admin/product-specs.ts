import "server-only";

import { choicesFrom, fileKindFrom, referenceDefinitionId, type FieldSpec } from "./form-fields";
import { listDefinitions } from "./metaobjects";
import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

/**
 * Product metafields, as form fields.
 *
 * SEEDED FROM THE DEFINITIONS, NOT FROM THE VALUES. A spec field nobody has filled in has
 * no metafield on that product at all — so building the form from the product's own
 * metafields would drop exactly the fields somebody opened the page to fill in.
 */

type RawDefinition = {
  key: string;
  name: string;
  description: string | null;
  type: { name: string };
  validations: { name: string; type: string; value: string | null }[];
};

export async function buildProductMetafieldSpecs(
  stored: { key: string; type: string; value: string }[],
): Promise<FieldSpec[]> {
  const [data, metaobjectDefinitions] = await Promise.all([
    adminGraphQL<{ metafieldDefinitions: { nodes: RawDefinition[] } }>(
      "productMetafieldDefinitions",
      OPERATIONS.productMetafieldDefinitions.document,
      {},
    ),
    listDefinitions(),
  ]);

  const byKey = new Map(stored.map((field) => [field.key, field]));

  /**
   * The two halves of the schema name the same thing differently: a METAOBJECT field
   * validates its target with `metaobject_definition_type` (a handle), while a PRODUCT
   * METAFIELD uses `metaobject_definition_id` (a gid). Resolving the id back to a type is
   * what lets the reference picker know which entries to offer.
   */
  const typeByDefinitionId = new Map(
    metaobjectDefinitions.map((definition) => [definition.id, definition.type]),
  );

  return data.metafieldDefinitions.nodes.map((definition) => {
    const definitionId = referenceDefinitionId(definition.validations);

    return {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      // Shopify does not mark metafield definitions required in the same way; the form
      // treats them all as optional and lets Shopify be the authority on validity.
      required: false,
      type: definition.type.name,
      choices: choicesFrom(definition.validations),
      targetType: definitionId ? (typeByDefinitionId.get(definitionId) ?? null) : null,
      fileKind: fileKindFrom(definition.validations),
      currentFile: null,
      currentRefs: [],
      editable: true,
      initialValue: byKey.get(definition.key)?.value ?? "",
    } satisfies FieldSpec;
  });
}
