import {
  PDFDocument,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { BRAND } from "@/lib/brand";

/**
 * The "Product Inquiry" PDF attached to both inquiry emails.
 *
 * Adapted from the reference generator, with everything price-shaped removed:
 * no Unit Price or Subtotal columns, no grand total, no discount labels, no
 * customer pricing category. This storefront quotes nothing — the document is a
 * record of what was asked for.
 *
 * Built directly with pdf-lib rather than rendering HTML, so every glyph is real
 * selectable vector text in one of the 14 standard PDF fonts. No font embedding,
 * so the file stays small and stays sharp at any zoom.
 */

export type InquiryPdfCustomer = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export type InquiryPdfItem = {
  sku: string | null;
  title: string;
  variantTitle?: string | null;
  qty: number;
};

export type InquiryPdfData = {
  inquiryId: string;
  submittedAt: Date;
  customer: InquiryPdfCustomer;
  items: InquiryPdfItem[];
  message?: string | null;
};

// ── Layout constants (A4 portrait, in PDF points — 1pt = 1/72in) ────────────
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 495.28
const FOOTER_ZONE = 30;
const BODY_SIZE = 9;
const LINE_HEIGHT = BODY_SIZE * 1.35;
const ROW_PAD_V = 6;
const CELL_PAD_X = 5;

function hex(h: string): Color {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const COLOR = {
  ink: hex(BRAND.ink),
  heading: hex(BRAND.heading),
  muted: hex(BRAND.muted),
  line: hex(BRAND.border),
  headerBg: hex(BRAND.headerBg),
  zebra: hex(BRAND.zebra),
};

type Col = { key: string; label: string; width: number; align: "left" | "right" };

/**
 * Re-divided across the full CONTENT_WIDTH now that Unit Price and Subtotal are
 * gone — Product and SKU absorb the freed 115pt.
 * 100 + 220 + 115.28 + 60 = 495.28
 */
const COLS: Col[] = [
  { key: "sku", label: "SKU", width: 100, align: "left" },
  { key: "product", label: "Product", width: 220, align: "left" },
  { key: "variant", label: "Variant", width: 115.28, align: "left" },
  { key: "qty", label: "Qty", width: 60, align: "right" },
];

/** The standard PDF fonts are WinAnsi — anything outside it throws on draw. */
function toWinAnsi(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/**
 * Greedy word-wrap. Sanitises first: `widthOfTextAtSize` throws on any
 * character the standard fonts cannot encode, so measuring raw input would take
 * the whole PDF down on a message containing CJK, an emoji, or a mojibake byte.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = toWinAnsi(String(text ?? ""))
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDate(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}


export async function generateInquiryPdf(data: InquiryPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Product Inquiry");
  doc.setSubject(`Inquiry ${data.inquiryId}`);
  doc.setProducer(BRAND.name);
  doc.setCreator(BRAND.name);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  function addPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(height: number, opts?: { redrawHeader?: boolean }) {
    if (y - height < MARGIN + FOOTER_ZONE) {
      addPage();
      if (opts?.redrawHeader) drawTableHeader();
    }
  }

  function drawText(
    str: string,
    x: number,
    size: number,
    opts: { font?: PDFFont; color?: Color; align?: "left" | "right"; boxWidth?: number } = {},
  ) {
    const f = opts.font ?? font;
    const safe = toWinAnsi(str);
    const drawX =
      opts.align === "right" && opts.boxWidth !== undefined
        ? x + opts.boxWidth - f.widthOfTextAtSize(safe, size)
        : x;

    page.drawText(safe, { x: drawX, y, size, font: f, color: opts.color ?? COLOR.ink });
  }

  function drawTableHeader() {
    const headerHeight = LINE_HEIGHT + ROW_PAD_V * 2;
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: COLOR.headerBg,
    });

    let colX = MARGIN;
    const textY = y - ROW_PAD_V - BODY_SIZE + 1;

    for (const col of COLS) {
      const savedY = y;
      y = textY;
      drawText(col.label.toUpperCase(), colX + CELL_PAD_X, 7.5, {
        font: fontBold,
        color: COLOR.muted,
        align: col.align,
        boxWidth: col.width - CELL_PAD_X * 2,
      });
      y = savedY;
      colX += col.width;
    }

    y -= headerHeight;
  }

  function drawRow(item: InquiryPdfItem, index: number) {
    const cellText: Record<string, string> = {
      sku: item.sku || "—",
      product: item.title || "—",
      variant: item.variantTitle || "—",
      qty: String(item.qty),
    };

    const wrapped = Object.fromEntries(
      COLS.map((col) => [
        col.key,
        wrapText(cellText[col.key]!, font, BODY_SIZE, col.width - CELL_PAD_X * 2),
      ]),
    ) as Record<string, string[]>;

    const lineCount = Math.max(...COLS.map((col) => wrapped[col.key]!.length), 1);
    const rowHeight = lineCount * LINE_HEIGHT + ROW_PAD_V * 2;

    ensureSpace(rowHeight, { redrawHeader: true });

    const topY = y;
    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: topY - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: COLOR.zebra,
      });
    }

    let colX = MARGIN;
    for (const col of COLS) {
      wrapped[col.key]!.forEach((line, i) => {
        y = topY - ROW_PAD_V - BODY_SIZE + 1 - i * LINE_HEIGHT;
        drawText(line, colX + CELL_PAD_X, BODY_SIZE, {
          align: col.align,
          boxWidth: col.width - CELL_PAD_X * 2,
        });
      });
      colX += col.width;
    }

    y = topY - rowHeight;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 0.5,
      color: COLOR.line,
    });
  }

  // ── Page 1: title + meta block ──────────────────────────────────────────
  addPage();

  drawText("Product Inquiry", MARGIN, 22, { font: fontBold, color: COLOR.heading });
  y -= 16;
  drawText(BRAND.tagline, MARGIN, 9, { color: COLOR.muted });
  y -= 26;

  const metaRows: [string, string][] = [
    ["Inquiry ID", data.inquiryId],
    ["Submitted", formatDate(data.submittedAt)],
    ["Name", data.customer.name || "—"],
    ...(data.customer.company ? ([["Company", data.customer.company]] as [string, string][]) : []),
    ...(data.customer.email ? ([["Email", data.customer.email]] as [string, string][]) : []),
    ...(data.customer.phone ? ([["Phone", data.customer.phone]] as [string, string][]) : []),
  ];

  for (const [label, value] of metaRows) {
    drawText(`${label}:`, MARGIN, 10, { font: fontBold, color: COLOR.muted });
    drawText(value, MARGIN + 110, 10, { color: COLOR.ink });
    y -= 16;
  }
  y -= 14;

  // ── Product table ────────────────────────────────────────────────────────
  drawTableHeader();
  data.items.forEach((item, index) => drawRow(item, index));

  // ── Totals — counts only, never a value ─────────────────────────────────
  const totalProducts = data.items.length;
  const totalQuantity = data.items.reduce((total, item) => total + item.qty, 0);

  ensureSpace(64);
  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 1,
    color: COLOR.line,
  });

  y -= 20;
  drawText("Total Products:", MARGIN, 10, { font: fontBold, color: COLOR.muted });
  drawText(String(totalProducts), MARGIN + 110, 10, { color: COLOR.ink });
  y -= 16;
  drawText("Total Quantity:", MARGIN, 10, { font: fontBold, color: COLOR.muted });
  drawText(String(totalQuantity), MARGIN + 110, 10, { color: COLOR.ink });
  y -= 24;

  if (data.message) {
    const lines = wrapText(data.message, font, 9, CONTENT_WIDTH);
    ensureSpace(lines.length * LINE_HEIGHT + 24);
    drawText("Message", MARGIN, 10, { font: fontBold, color: COLOR.muted });
    y -= 16;
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      drawText(line, MARGIN, 9, { color: COLOR.ink });
      y -= LINE_HEIGHT;
    }
  }

  // ── Footer (page numbers need the final count, so this runs last) ───────
  const total = pages.length;
  pages.forEach((p, index) => {
    p.drawText(toWinAnsi(`${BRAND.name} — this is an inquiry, not an order confirmation.`), {
      x: MARGIN,
      y: MARGIN - 15,
      size: 8,
      font,
      color: COLOR.muted,
    });

    const label = `Page ${index + 1} of ${total}`;
    p.drawText(label, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 8),
      y: MARGIN - 15,
      size: 8,
      font,
      color: COLOR.muted,
    });
  });

  return doc.save();
}
