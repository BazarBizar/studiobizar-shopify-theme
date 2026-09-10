"use client";

import { exportEntriesCsv } from "@/app/(admin)/admin/[slug]/actions";

import { EntryTable } from "./entry-table";
import type { EntryRow, FieldColumn } from "./columns";

/**
 * Thin client boundary between the server screen and the table.
 *
 * It exists for one reason: the table needs an `onExport` it can call, and turning the
 * returned CSV into a download is browser work (`Blob` + a synthetic click) that a
 * server action cannot do. Keeping it here leaves `EntryTable` free of any file-saving
 * concern and leaves the screen free of `"use client"`.
 */
export function EntryTableShell({
  type,
  fields,
  rows,
  readOnly,
  orderField,
  excelExport = false,
}: {
  type: string;
  fields: FieldColumn[];
  rows: EntryRow[];
  readOnly: boolean;
  orderField: string | null;
  excelExport?: boolean;
}) {
  async function onExport() {
    const { filename, csv, rows: count } = await exportEntriesCsv(type);

    // A BOM, so Excel opens UTF-8 correctly instead of mangling accented characters —
    // which this catalogue is full of.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return count;
  }

  return (
    <EntryTable
      type={type}
      fields={fields}
      rows={rows}
      readOnly={readOnly}
      orderField={orderField}
      onExport={onExport}
      excelHref={excelExport ? "/api/admin/inquiries/export" : null}
    />
  );
}
