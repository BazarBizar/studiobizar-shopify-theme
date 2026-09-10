import "server-only";

import ExcelJS from "exceljs";

import { loadInquiries, type Inquiry } from "./inquiries";
import { resolveItemThumbnails } from "./inquiry-media";

/**
 * The `.xlsx` export for inquiries.
 *
 * SERVER-ONLY, and not by preference. It has to call the Admin API (line items store only
 * a variant gid, so thumbnails must be resolved) and then fetch the image bytes to embed
 * them — neither of which a browser can do without shipping a spreadsheet library to the
 * bundle and losing a fight with CORS on Shopify's CDN.
 *
 * SHEET ORDER IS DELIBERATE. "Inquiry items" comes FIRST and is the complete one: a row
 * per line item, with the customer's details repeated on every row. Whoever opens the file
 * lands on the full detail and never has to cross-reference between sheets. The
 * "Inquiries" rollup is second, for quick totals.
 *
 * Always the whole collection, never the rows on screen — "export" means the collection.
 *
 * A TYPE HAZARD WORTH KNOWING ABOUT: `exceljs`'s `index.d.ts` opens with
 * `declare interface Buffer extends ArrayBuffer {}`. Interface declarations merge
 * globally, so importing it anywhere widens the ambient `Buffer` type for the whole
 * program. Everything below therefore holds `Uint8Array` rather than `Buffer`, and the one
 * unavoidable contact point is marked rather than cast — a cast would silently keep
 * compiling if the library were fixed, whereas `@ts-expect-error` complains and tells us
 * to remove it.
 */

const CUSTOMER_COLUMNS = [
  { header: "Reference", key: "reference", width: 18 },
  { header: "Submitted", key: "submittedAt", width: 20 },
  { header: "Customer", key: "customerName", width: 24 },
  { header: "Company", key: "company", width: 24 },
  { header: "Email", key: "email", width: 28 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "Status", key: "status", width: 12 },
];

/** Small enough that a sheet of them stays openable; big enough to recognise. */
const THUMB_PX = 48;

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; extension: "png" | "jpeg" } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    // Shopify serves webp by default; asking for a format Excel understands avoids a
    // sheet full of blank cells.
    const extension = type.includes("png") ? "png" : "jpeg";

    return { bytes: new Uint8Array(await response.arrayBuffer()), extension };
  } catch {
    // A missing thumbnail must not fail the export.
    return null;
  }
}

export type ExcelExport = { filename: string; bytes: Uint8Array; rows: number };

export async function buildInquiryWorkbook(): Promise<ExcelExport> {
  const inquiries = await loadInquiries();

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  /* ---- Sheet 1: one row per line item, complete ------------------------- */

  const itemsSheet = workbook.addWorksheet("Inquiry items");
  itemsSheet.columns = [
    { header: "Image", key: "image", width: 8 },
    ...CUSTOMER_COLUMNS,
    { header: "Product", key: "product", width: 40 },
    { header: "Variant", key: "variant", width: 20 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Qty", key: "qty", width: 8 },
  ];
  itemsSheet.getRow(1).font = { bold: true };

  /** Fetched once per distinct URL — a catalogue repeats the same product across
   *  inquiries, and re-downloading it per row would make a large export crawl. */
  const imageCache = new Map<string, number | null>();

  let itemRowCount = 0;

  for (const inquiry of inquiries) {
    const items = await resolveItemThumbnails(inquiry.items);

    for (const item of items) {
      const row = itemsSheet.addRow({
        image: "",
        ...customerCells(inquiry),
        product: item.title ?? "",
        variant: item.variantTitle ?? "",
        sku: item.sku ?? "",
        qty: item.qty,
      });

      row.height = THUMB_PX * 0.78;
      itemRowCount += 1;

      if (!item.thumbnail) continue;

      let imageId = imageCache.get(item.thumbnail);

      if (imageId === undefined) {
        const image = await fetchImage(item.thumbnail);
        imageId = image
          ? workbook.addImage({
              // The one unavoidable contact point with the library's widened Buffer type.
              // @ts-expect-error exceljs types `buffer` as its own globally-merged Buffer; a Uint8Array is what it actually accepts.
              buffer: image.bytes,
              extension: image.extension,
            })
          : null;
        imageCache.set(item.thumbnail, imageId);
      }

      if (imageId !== null && imageId !== undefined) {
        itemsSheet.addImage(imageId, {
          tl: { col: 0.1, row: row.number - 0.9 },
          ext: { width: THUMB_PX, height: THUMB_PX },
        });
      }
    }
  }

  /* ---- Sheet 2: rollup per inquiry --------------------------------------- */

  const rollup = workbook.addWorksheet("Inquiries");
  rollup.columns = [
    ...CUSTOMER_COLUMNS,
    { header: "Products", key: "totalProducts", width: 12 },
    { header: "Total quantity", key: "totalQuantity", width: 16 },
    { header: "Message", key: "message", width: 60 },
  ];
  rollup.getRow(1).font = { bold: true };

  for (const inquiry of inquiries) {
    rollup.addRow({
      ...customerCells(inquiry),
      totalProducts: inquiry.totalProducts,
      totalQuantity: inquiry.totalQuantity,
      message: inquiry.message,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    filename: `inquiries-${stamp}.xlsx`,
    bytes: new Uint8Array(buffer as ArrayBuffer),
    rows: itemRowCount,
  };
}

/** Repeated on every item row, so the items sheet stands alone. */
function customerCells(inquiry: Inquiry) {
  return {
    reference: inquiry.reference,
    // A plain ISO date: a spreadsheet reader can sort it, and it does not depend on the
    // server's locale the way a formatted date would.
    submittedAt: inquiry.submittedAt ? inquiry.submittedAt.slice(0, 19).replace("T", " ") : "",
    customerName: inquiry.customerName,
    company: inquiry.company,
    email: inquiry.email,
    phone: inquiry.phone,
    status: inquiry.status,
  };
}
