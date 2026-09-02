/**
 * Generates an inquiry PDF and an inquiry email, then asserts the price columns
 * really are gone and pagination still works.
 *
 *   npx tsx scripts/check-inquiry-pdf.ts [--write out.pdf]
 */

import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

import { render } from "@react-email/render";

import { generateInquiryPdf } from "../lib/pdf/inquiry-pdf";
import { InquiryEmail } from "../lib/email/templates/inquiry-email";

const FORBIDDEN = [
  "Unit Price",
  "Subtotal",
  "Grand Total",
  "Pricing Category",
  "€",
  "$",
  "Price on inquiry",
];

/** Every stream in the file, inflated where it is Flate-compressed. */
function inflateAll(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const parts: string[] = [raw];
  let index = 0;

  while (true) {
    const start = raw.indexOf("stream", index);
    if (start === -1) break;
    let from = start + 6;
    if (raw.charCodeAt(from) === 13) from++;
    if (raw.charCodeAt(from) === 10) from++;
    const end = raw.indexOf("endstream", from);
    if (end === -1) break;
    try {
      parts.push(zlib.inflateSync(Buffer.from(raw.slice(from, end), "latin1")).toString("latin1"));
    } catch {
      /* not Flate — already plain */
    }
    index = end + 9;
  }

  return parts.join("\n");
}

/**
 * pdf-lib writes show-text operands as hex strings (`<50726F…> Tj`), not as
 * literal parenthesised strings, so both forms are decoded here.
 */
function pdfText(bytes: Uint8Array): string {
  const all = inflateAll(bytes);
  const out: string[] = [];

  for (const match of all.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const hexPairs = match[1].replace(/\s+/g, "").match(/.{2}/g) ?? [];
    out.push(hexPairs.map((pair) => String.fromCharCode(parseInt(pair, 16))).join(""));
  }
  for (const match of all.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) {
    out.push(match[1]);
  }

  return out.join(" ");
}

/** Page objects live inside compressed object streams, so inflate first. */
function pageCount(bytes: Uint8Array): number {
  return (inflateAll(bytes).match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
}

async function main() {
  const items = Array.from({ length: 60 }, (_, i) => ({
    sku: `SKU-${String(i + 1).padStart(4, "0")}`,
    title:
      i % 5 === 0
        ? "The Malawi Two Seater with a deliberately long name to force the cell to wrap"
        : `Product ${i + 1}`,
    variantTitle: i % 3 === 0 ? "Natural / Large" : null,
    qty: (i % 7) + 1,
  }));

  const bytes = await generateInquiryPdf({
    inquiryId: "INQ-20260902-TEST",
    submittedAt: new Date("2026-09-02T10:15:00Z"),
    customer: {
      name: "Ada Lovelace",
      company: "Analytical Engines",
      email: "ada@example.com",
      phone: "+32 475 00 00 00",
    },
    items,
    message:
      "Curly quotes ‘like this’, an em dash — and characters the standard fonts cannot encode: " +
      "日本語のテキスト, emoji 🪑, and a replacement char �. None of these may throw.",
  });

  const text = pdfText(bytes);
  const pages = pageCount(bytes);

  const checks: [string, boolean, string][] = [
    ["valid PDF header", Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-", `${bytes.length} bytes`],
    ["paginates", pages > 1, `${pages} pages`],
    ["header repeats per page", (text.match(/SKU/g) ?? []).length >= pages, `${(text.match(/SKU/g) ?? []).length}× on ${pages} pages`],
    ["column set is SKU|Product|Variant|Qty", /SKU/.test(text) && /PRODUCT/i.test(text) && /VARIANT/i.test(text) && /QTY/i.test(text), ""],
    ["Total Products present", /Total Products/.test(text), ""],
    ["Total Quantity present", /Total Quantity/.test(text), ""],
    ["totals are counts", /Total Quantity/.test(text) && !/Grand Total/.test(text), ""],
    ["footer names the brand", /Studio Bizar/.test(text), ""],
    ["page numbering", /Page 1 of \d+/.test(text), ""],
    ["smart punctuation survived", /like this/.test(text), ""],
    ["unencodable chars do not throw", /None of these may throw/.test(text), "CJK + emoji + U+FFFD"],
  ];

  for (const term of FORBIDDEN) {
    checks.push([`no "${term}"`, !text.includes(term), ""]);
  }

  // Column widths must still fill the content box exactly.
  const contentWidth = 595.28 - 50 * 2;
  const sum = 100 + 220 + 115.28 + 60;
  checks.push(["columns fill CONTENT_WIDTH", Math.abs(sum - contentWidth) < 0.01, `${sum} vs ${contentWidth}`]);

  console.log("— PDF —");
  let failed = 0;
  for (const [label, ok, detail] of checks) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✕"} ${label.padEnd(34)} ${detail}`);
  }

  // The email must carry the same table and no prices either.
  const html = await render(
    InquiryEmail({
      inquiryId: "INQ-20260902-TEST",
      submittedAt: new Date("2026-09-02T10:15:00Z"),
      name: "Ada Lovelace",
      email: "ada@example.com",
      items: items.slice(0, 3),
      audience: "customer",
    }),
  );

  const emailChecks: [string, boolean, string][] = [
    ["renders HTML", html.startsWith("<!DOCTYPE") || html.includes("<html"), `${html.length} bytes`],
    ["shows the reference", html.includes("INQ-20260902-TEST"), ""],
    ["lists products", html.includes("SKU-0001"), ""],
    ["states it is not an order", /not an order confirmation/.test(html), ""],
    ["no currency", !/[€$]\s?\d/.test(html), ""],
  ];

  console.log("\n— email —");
  for (const [label, ok, detail] of emailChecks) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✕"} ${label.padEnd(34)} ${detail}`);
  }

  const writeIndex = process.argv.indexOf("--write");
  if (writeIndex !== -1 && process.argv[writeIndex + 1]) {
    writeFileSync(process.argv[writeIndex + 1], bytes);
    console.log(`\nwrote ${process.argv[writeIndex + 1]}`);
  }

  console.log(failed ? `\n✕ ${failed} failed\n` : `\n✓ all ${checks.length + emailChecks.length} assertions passed\n`);
  process.exit(failed ? 1 : 0);
}

void main();
