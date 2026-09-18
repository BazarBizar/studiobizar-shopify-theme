import "server-only";

import { choicesFrom, fileKindFrom, referenceDefinitionId, type FieldSpec } from "./form-fields";
import { listDefinitions } from "./metaobjects";
import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

/**
 * PAGE metafields, as form fields. The sibling of `buildProductMetafieldSpecs`,
 * and for the same reason: SEEDED FROM THE DEFINITIONS, NOT FROM THE VALUES.
 *
 * That matters more here than it does for products. A page metafield is usually
 * empty until somebody fills it in — `home` carries eight of them and most pages
 * carry one or two — so a form built from what the page currently stores would
 * show almost nothing on exactly the screens people open to add something.
 *
 * `currentFile` and `currentRefs` are left empty, as in the product editor. The
 * client resolves what a reference points at through `/api/admin/files/resolve`,
 * which keeps this a single query no matter how many references a page holds —
 * `home` alone has three list-valued reference fields.
 */

type RawDefinition = {
  key: string;
  name: string;
  description: string | null;
  type: { name: string };
  validations: { name: string; type: string; value: string | null }[];
};

export async function buildPageMetafieldSpecs(
  stored: { key: string; type: string; value: string }[],
): Promise<FieldSpec[]> {
  const [data, metaobjectDefinitions] = await Promise.all([
    adminGraphQL<{ metafieldDefinitions: { nodes: RawDefinition[] } }>(
      "pageMetafieldDefinitions",
      OPERATIONS.pageMetafieldDefinitions.document,
      {},
    ),
    listDefinitions(),
  ]);

  const byKey = new Map(stored.map((field) => [field.key, field]));

  /**
   * A METAOBJECT field names its target with `metaobject_definition_type` (a
   * handle); a METAFIELD names it with `metaobject_definition_id` (a gid).
   * Resolving the gid back to a type is what lets the reference picker know which
   * entries to offer — `hero_slides` points at `captioned_image`, `locations` at
   * `location`, and neither says so in a form the picker can read directly.
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
      // Shopify does not mark metafield definitions required the way metaobject
      // fields are; the form treats them as optional and lets Shopify judge validity.
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

/**
 * The metafield type for a key, needed because `pageUpdate` requires the type on
 * every metafield it writes and the browser only sends keys and values.
 *
 * Read from the DEFINITIONS rather than from what the page currently stores: a
 * field being written for the first time has no stored metafield to take a type
 * from, and that is the common case on these screens.
 */
export async function pageMetafieldTypes(): Promise<Map<string, string>> {
  const data = await adminGraphQL<{ metafieldDefinitions: { nodes: RawDefinition[] } }>(
    "pageMetafieldDefinitions",
    OPERATIONS.pageMetafieldDefinitions.document,
    {},
  );

  return new Map(data.metafieldDefinitions.nodes.map((node) => [node.key, node.type.name]));
}
