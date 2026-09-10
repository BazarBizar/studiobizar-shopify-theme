/**
 * Field value helpers shared by the table, the form and the server.
 *
 * NO `server-only` here, deliberately: the table and the form are Client
 * Components and need exactly the same interpretation of a stored value as the
 * server does. Two implementations of "is this boolean true" is how a row comes to
 * disagree with the form that edits it. There is nothing secret in this file —
 * only parsing rules.
 *
 * EVERY value crosses the wire as a STRING, because that is how Shopify stores and
 * accepts metaobject field values:
 *
 *   boolean          "true" / "false"
 *   number_integer   "12"
 *   list.*           a JSON array of strings
 *   rich_text_field  a JSON string holding Shopify's AST
 *   date / date_time an ISO 8601 string
 *
 * Coercing them to real JS types on the way in and back on the way out invents two
 * conversion points where a value can be mangled — an empty string becoming 0, or
 * a missing list becoming `[]` and wiping a field. They stay strings end to end.
 */

export const METAOBJECT_GID_PREFIX = "gid://shopify/Metaobject/";

/**
 * URLs carry the numeric part of a Shopify gid, not the whole thing. The full gid
 * needs escaping in a path segment and reads terribly in the address bar; the
 * numeric id is stable and unambiguous. Reconstruction is exact, and anything that
 * is not digits is rejected rather than passed to Shopify.
 */
export function entryIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${METAOBJECT_GID_PREFIX}${param}` : null;
}

export function paramFromEntryId(gid: string): string {
  return gid.startsWith(METAOBJECT_GID_PREFIX) ? gid.slice(METAOBJECT_GID_PREFIX.length) : gid;
}

/** Shopify writes booleans as the strings "true"/"false". */
export function isTrue(value: string | null | undefined): boolean {
  return value === "true";
}

/** A `list.*` value is a JSON array of strings. Returns [] for anything else
 *  rather than throwing — a malformed value must not break a whole table. */
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function isListType(type: string): boolean {
  return type.startsWith("list.");
}

/** The element type behind a list, e.g. `list.file_reference` -> `file_reference`. */
export function elementType(type: string): string {
  return isListType(type) ? type.slice("list.".length) : type;
}

/** Validation values arrive as strings; `choices` holds a JSON array. */
export function choicesFrom(
  validations: { name: string; value: string | null }[] | undefined,
): string[] {
  const raw = validations?.find((validation) => validation.name === "choices")?.value;
  return parseList(raw);
}

export function validationValue(
  validations: { name: string; value: string | null }[] | undefined,
  name: string,
): string | null {
  return validations?.find((validation) => validation.name === name)?.value ?? null;
}

/**
 * Plain text for a value, for table cells, CSV and search. Never HTML: the caller
 * decides how to render, and a helper that returned markup would be an injection
 * point in every consumer.
 */
export function toPlainText(type: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  if (type === "boolean") return isTrue(value) ? "Yes" : "No";

  if (isListType(type)) {
    const items = parseList(value);
    return items.length ? `${items.length}` : "";
  }

  if (type === "rich_text_field") return richTextToPlainText(value);

  if (type === "json") {
    // Length is the only honest summary of arbitrary JSON in one cell.
    const items = safeJson(value);
    if (Array.isArray(items)) return `${items.length} item${items.length === 1 ? "" : "s"}`;
    return items && typeof items === "object" ? `${Object.keys(items).length} keys` : value;
  }

  if (type === "date" || type === "date_time") return formatDate(value, type === "date_time");

  return value;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Locale-independent formatting, on purpose. `toLocaleString` resolves differently
 * on the server and in the browser, and a value that renders one way in the
 * server-rendered HTML and another after hydration is a React hydration error.
 */
export function formatDate(value: string, withTime: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const iso = date.toISOString();
  return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
}

type RichTextNode = { type?: string; value?: string; children?: RichTextNode[] };

/**
 * Flattens Shopify's rich text AST to text, for search and table cells.
 *
 * The node vocabulary matches `lib/shopify/transforms.ts`, which is what the
 * storefront renders. If the two ever disagree, the storefront is right — it is
 * the side a customer sees.
 */
export function richTextToPlainText(value: string): string {
  const node = safeJson(value);
  if (!node || typeof node !== "object") return value;

  const walk = (current: RichTextNode): string => {
    if (current.type === "text") return current.value ?? "";
    return (current.children ?? []).map(walk).join(current.type === "paragraph" ? "" : " ");
  };

  return walk(node as RichTextNode).replace(/\s+/g, " ").trim();
}

/** Truncation for a table cell, on a word boundary where there is one nearby. */
export function truncate(value: string, max = 80): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
