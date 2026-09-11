import "server-only";

import { cache } from "react";

import { isDeletable, isHeavyType, moduleFor } from "./modules";
import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * The metaobject data layer.
 *
 * This module enforces its OWN rules and does not trust its callers. A route
 * handler that forgets a check is a bug; a data layer that relies on callers
 * remembering is a design flaw. Specifically:
 *
 *  - Only types that exist as definitions in this store can be addressed. An
 *    unknown type answers `NOT_ALLOWED`, deliberately not `NOT_FOUND` — the two
 *    answers together would let anyone map which definitions a store has by
 *    probing names.
 *  - Read-only types reject writes here, in `assertWritable`, not by hiding a
 *    button in the UI. The button is a courtesy; this is the rule.
 */

export class NotAllowedError extends Error {
  readonly code = "NOT_ALLOWED";

  constructor(message = "That type is not available in this panel.") {
    super(message);
    this.name = "NotAllowedError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "That entry no longer exists.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type Validation = { name: string; type: string; value: string | null };

export type FieldDefinition = {
  key: string;
  name: string;
  description: string | null;
  required: boolean;
  /** Shopify field type, e.g. `single_line_text_field`, `list.file_reference`. */
  type: string;
  category: string;
  validations: Validation[];
};

export type Definition = {
  id: string;
  type: string;
  name: string;
  displayNameKey: string | null;
  /**
   * Shopify's `metaobjectsCount`. DO NOT show this to an operator: measured
   * against this store it reported 1 designer where there are 10, and 2 inquiries
   * where there are none. It is stale in both directions. Count the rows you
   * actually loaded instead — see the note in `lib/admin/navigation.ts`.
   */
  entriesCount: number;
  publishable: boolean;
  fieldDefinitions: FieldDefinition[];
};

export type EntryReference = {
  __typename: string;
  id?: string;
  alt?: string | null;
  handle?: string | null;
  type?: string | null;
  title?: string | null;
  displayName?: string | null;
  url?: string | null;
  mimeType?: string | null;
  image?: {
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  sources?: { url: string; mimeType: string }[] | null;
};

export type EntryField = {
  key: string;
  type: string;
  value: string | null;
  /** Populated for a single reference field; null for a `list.*` one. */
  reference: EntryReference | null;
  /** Populated for a `list.*` reference field; null for a single one. */
  references: { nodes: EntryReference[] } | null;
};

export type Entry = {
  id: string;
  handle: string;
  type: string;
  updatedAt: string;
  displayName: string | null;
  /** null when the definition has no publishable capability. */
  status: string | null;
  fields: EntryField[];
};

type RawDefinition = {
  id: string;
  type: string;
  name: string;
  displayNameKey: string | null;
  metaobjectsCount: number;
  capabilities: { publishable: { enabled: boolean } | null } | null;
  fieldDefinitions: {
    key: string;
    name: string;
    description: string | null;
    required: boolean;
    type: { name: string; category: string };
    validations: Validation[];
  }[];
};

function normalizeDefinition(raw: RawDefinition): Definition {
  return {
    id: raw.id,
    type: raw.type,
    name: raw.name,
    displayNameKey: raw.displayNameKey,
    entriesCount: raw.metaobjectsCount,
    publishable: raw.capabilities?.publishable?.enabled ?? false,
    fieldDefinitions: raw.fieldDefinitions.map((field) => ({
      key: field.key,
      name: field.name,
      description: field.description,
      required: field.required,
      type: field.type.name,
      category: field.type.category,
      validations: field.validations,
    })),
  };
}

/**
 * Memoised per request with React's `cache`, and NOT cached across requests.
 * Several things in one render need the definition list — the sidebar, the screen
 * title, the column set — and they must agree with each other; but two page views
 * a minute apart have to be free to disagree, because somebody may have added a
 * field in Shopify in between.
 */
export const listDefinitions = cache(async (): Promise<Definition[]> => {
  const definitions: Definition[] = [];
  let after: string | null = null;

  // Paged even though this store has eight definitions: the loop is three lines,
  // and the alternative is a sidebar that silently loses everything past the
  // first page on the day somebody adds a fiftieth.
  for (;;) {
    // Annotated rather than inferred: `after` is both an input to this call and
    // assigned from its result, and TypeScript reports that as a circular
    // reference (TS7022) if it has to infer the type here.
    const data: {
      metaobjectDefinitions: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawDefinition[];
      };
    } = await adminGraphQL("metaobjectDefinitions", OPERATIONS.metaobjectDefinitions.document, {
      first: 50,
      after,
    });

    definitions.push(...data.metaobjectDefinitions.nodes.map(normalizeDefinition));

    if (!data.metaobjectDefinitions.pageInfo.hasNextPage) break;
    after = data.metaobjectDefinitions.pageInfo.endCursor;
    if (!after) break;
  }

  return definitions;
});

/**
 * THE TYPE ALLOWLIST. It is the set of definitions that actually exist in the
 * store, resolved at runtime — not a hardcoded list. That is what lets a
 * definition created in Shopify appear in the panel without a deploy, while still
 * refusing anything a caller invents.
 */
export async function assertAllowedType(type: string): Promise<Definition> {
  const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
  if (!definition) throw new NotAllowedError();
  return definition;
}

export type WriteMode = "create" | "update";

/**
 * Refuses a write the module layer marks read-only.
 *
 * `create` has no exception list, on purpose. `editableFields` exists so an
 * operator can annotate a record somebody else authored — marking an inquiry
 * "contacted" — and an annotation only makes sense on a record that already
 * exists. Allowing create-with-only-editable-fields would let the panel
 * manufacture a customer submission that never happened.
 */
export function assertWritable(type: string, fieldKeys: string[], mode: WriteMode) {
  const moduleDef = moduleFor(type);
  if (!moduleDef.readOnly) return;

  if (mode === "create") {
    throw new NotAllowedError("Entries of this type are created by customers, not here.");
  }

  const editable = new Set(moduleDef.editableFields ?? []);
  const refused = fieldKeys.filter((key) => !editable.has(key));

  if (refused.length) {
    throw new NotAllowedError(
      editable.size
        ? `Only ${[...editable].join(", ")} can be changed on this type.`
        : "Entries of this type cannot be edited here.",
    );
  }
}

export type ListEntriesArgs = {
  type: string;
  first?: number;
  after?: string | null;
  /** Shopify's own query syntax. Only used by server-load screens. */
  query?: string | null;
  sortKey?: string | null;
  reverse?: boolean;
};

export type EntryPage = {
  entries: Entry[];
  hasNextPage: boolean;
  endCursor: string | null;
};

type RawEntry = Omit<Entry, "status"> & {
  capabilities: { publishable: { status: string } | null } | null;
};

const normalizeEntry = (raw: RawEntry): Entry => ({
  id: raw.id,
  handle: raw.handle,
  type: raw.type,
  updatedAt: raw.updatedAt,
  displayName: raw.displayName,
  status: raw.capabilities?.publishable?.status ?? null,
  fields: raw.fields,
});

export async function listEntries({
  type,
  first = 50,
  after = null,
  query = null,
  sortKey = null,
  reverse = false,
}: ListEntriesArgs): Promise<EntryPage> {
  await assertAllowedType(type);

  const data = await adminGraphQL<{
    metaobjects: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RawEntry[];
    };
  }>("metaobjects", OPERATIONS.metaobjects.document, {
    type,
    first: Math.min(Math.max(first, 1), 250),
    after,
    query,
    sortKey,
    reverse,
  });

  return {
    entries: data.metaobjects.nodes.map(normalizeEntry),
    hasNextPage: data.metaobjects.pageInfo.hasNextPage,
    endCursor: data.metaobjects.pageInfo.endCursor,
  };
}

/**
 * Every entry of a type, for the `load: "client"` screens — where filtering and
 * sorting happen in the browser and are only correct over the complete set.
 */
export async function listAllEntries(type: string): Promise<Entry[]> {
  const all: Entry[] = [];
  let after: string | null = null;

  for (;;) {
    const page = await listEntries({ type, first: 250, after });
    all.push(...page.entries);
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }

  return all;
}

export async function getEntry(id: string): Promise<Entry> {
  const data = await adminGraphQL<{ metaobject: RawEntry | null }>(
    "metaobject",
    OPERATIONS.metaobject.document,
    { id },
  );

  if (!data.metaobject) throw new NotFoundError();

  // The id came from a caller, so the entry's own type still has to clear the
  // allowlist — otherwise an id is simply a way around it.
  await assertAllowedType(data.metaobject.type);

  return normalizeEntry(data.metaobject);
}

export type FieldInput = { key: string; value: string };

type MutationResult = {
  metaobject: { id: string; handle: string; type: string } | null;
  userErrors: { field?: string[] | null; message: string; code?: string | null }[];
};

export async function createEntry(type: string, fields: FieldInput[]) {
  await assertAllowedType(type);
  assertWritable(
    type,
    fields.map((field) => field.key),
    "create",
  );

  const data = await adminGraphQL<{ metaobjectCreate: MutationResult }>(
    "metaobjectCreate",
    OPERATIONS.metaobjectCreate.document,
    { metaobject: { type, fields } },
  );

  assertNoUserErrors(data.metaobjectCreate.userErrors);
  if (!data.metaobjectCreate.metaobject) throw new NotFoundError("Shopify created nothing.");

  return data.metaobjectCreate.metaobject;
}

/**
 * Refuses a delete for any type this panel does not author.
 *
 * Separate from `assertWritable` on purpose. That one negotiates per FIELD, because an
 * operator may annotate somebody else's record; this one cannot, because a record either
 * survives or it does not. An inquiry whose `status` is editable is still a customer's
 * submission, and must not be removable.
 */
export function assertDeletable(type: string) {
  if (isDeletable(type)) return;

  throw new NotAllowedError(
    moduleFor(type).readOnly
      ? "Entries of this type are sent by customers and cannot be deleted here."
      : "Entries of this type cannot be deleted here.",
  );
}

/**
 * IRREVERSIBLE — Shopify keeps no copy — so everything that can refuse happens before
 * the mutation is sent.
 */
export async function deleteEntry(id: string) {
  // The type is read from the STORE, never taken from the request, for the same reason
  // `updateEntry` does it: a caller who could name the type could name a deletable one
  // and use it to reach an entry of a protected one.
  const existing = await getEntry(id);
  assertDeletable(existing.type);

  const data = await adminGraphQL<{
    metaobjectDelete: { deletedId: string | null; userErrors: MutationResult["userErrors"] };
  }>("metaobjectDelete", OPERATIONS.metaobjectDelete.document, { id });

  assertNoUserErrors(data.metaobjectDelete.userErrors);
  if (!data.metaobjectDelete.deletedId) throw new NotFoundError();

  // Handle and type come from the entry as it WAS: after this call there is nothing left
  // to ask, and the caller needs the type to know which cache tags to drop.
  return { id: data.metaobjectDelete.deletedId, handle: existing.handle, type: existing.type };
}

export async function updateEntry(id: string, fields: FieldInput[]) {
  // The type is read from the STORE, never taken from the request. A caller who
  // could name the type could name a writable one and use it to edit an entry of
  // a read-only one.
  const existing = await getEntry(id);

  assertWritable(
    existing.type,
    fields.map((field) => field.key),
    "update",
  );

  const data = await adminGraphQL<{ metaobjectUpdate: MutationResult }>(
    "metaobjectUpdate",
    OPERATIONS.metaobjectUpdate.document,
    { id, metaobject: { fields } },
  );

  assertNoUserErrors(data.metaobjectUpdate.userErrors);
  if (!data.metaobjectUpdate.metaobject) throw new NotFoundError();

  return { ...data.metaobjectUpdate.metaobject, type: existing.type };
}

/* -------------------------------------------------------------------------- *
 * Column resolution — where module hints meet the live definition
 * -------------------------------------------------------------------------- */

export type ResolvedColumn = {
  key: string;
  label: string;
  type: string;
  /** False for columns kept behind the column menu rather than shown by default. */
  visible: boolean;
};

/**
 * Resolves the module's preferred columns against the fields Shopify actually
 * has, which is the entire point of keeping the hints separate from the schema:
 *
 *  - a preferred key that no longer exists in Shopify is dropped, not rendered as
 *    an empty column;
 *  - a field the module never mentions is still returned, with `visible: false`,
 *    so it can be switched on from the column menu rather than disappearing.
 */
export function resolveColumns(definition: Definition): ResolvedColumn[] {
  const moduleDef = moduleFor(definition.type);
  const byKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));
  const never = new Set(moduleDef.neverColumn ?? []);

  const preferred = (moduleDef.columns ?? []).filter((key) => byKey.has(key) && !never.has(key));
  const seen = new Set(preferred);

  const rest = definition.fieldDefinitions
    .map((field) => field.key)
    .filter((key) => !seen.has(key) && !never.has(key));

  const label = (key: string) => byKey.get(key)?.name ?? key;
  const typeOf = (key: string) => byKey.get(key)?.type ?? "single_line_text_field";

  return [
    ...preferred.map((key) => ({ key, label: label(key), type: typeOf(key), visible: true })),
    ...rest.map((key) => ({
      key,
      label: label(key),
      type: typeOf(key),
      // A module with no opinion gets a sensible default: show the light fields,
      // keep paragraphs and reference lists behind the menu.
      visible: moduleDef.columns ? false : !isHeavyType(typeOf(key)),
    })),
  ];
}
