"use server";

import { currentStaff } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { toPlainText } from "@/lib/admin/field-values";
import { listAllEntries, listDefinitions, NotAllowedError } from "@/lib/admin/metaobjects";

/**
 * CSV export for one metaobject type.
 *
 * It RE-READS the whole collection rather than serialising the rows on screen.
 * "Export" means the collection; exporting the page that happens to be open — already
 * filtered, already paginated — produces a file whose contents depend on where the
 * operator had scrolled to, which is not a thing anyone can use twice.
 *
 * A server action rather than a route handler because there is nothing for a client to
 * assemble: the browser only needs the finished text.
 */

function csvCell(value: string): string {
  // Quote when the value contains a delimiter, a quote or a newline; double any quote.
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportEntriesCsv(
  type: string,
): Promise<{ filename: string; csv: string; rows: number }> {
  // A server action is a public endpoint. It repeats the session check for the same
  // reason every route handler does — the layout that protected the page did not run.
  const staff = await currentStaff();
  if (!staff) throw new Error("Sign in to continue.");

  const definition = (await listDefinitions()).find((candidate) => candidate.type === type);
  if (!definition) throw new NotAllowedError();

  const entries = await listAllEntries(type);
  const keys = definition.fieldDefinitions.map((field) => field.key);

  const header = ["handle", "updated_at", ...keys];

  const lines = [
    header.map(csvCell).join(","),
    ...entries.map((entry) => {
      const byKey = new Map(entry.fields.map((field) => [field.key, field]));

      return [
        entry.handle,
        entry.updatedAt,
        ...keys.map((key) => {
          const field = byKey.get(key);
          // Flattened to text, so rich text arrives as its words rather than as an AST
          // nobody can read in a spreadsheet.
          return toPlainText(field?.type ?? "single_line_text_field", field?.value);
        }),
      ]
        .map(csvCell)
        .join(",");
    }),
  ];

  audit({
    action: "metaobject.export",
    actor: staff.email,
    outcome: "ok",
    type,
    // Field KEYS only, and a row count. Never the exported values.
    fields: keys,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    filename: `${type}-${stamp}.csv`,
    csv: lines.join("\r\n"),
    rows: entries.length,
  };
}
