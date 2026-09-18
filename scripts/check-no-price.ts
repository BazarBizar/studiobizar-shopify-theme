/**
 * Guards the inquiry-only model: no STOREFRONT query may request price,
 * inventory or availability. Catching it here is the difference between the data
 * never reaching the browser and it merely being hidden by CSS.
 *
 *   npx tsx scripts/check-no-price.ts
 *
 * THE ADMIN HALF IS EXEMPT, and that is a rule about audience rather than a hole
 * in this one. The inquiry-only model is a promise to VISITORS: the public
 * storefront shows no price and no stock, so the data is stripped at the query.
 * An operator in `/admin` is the person who needs to know a product is at zero,
 * and the Products screen has a Stock column that says so — see
 * `components/admin/products-table/products-table.tsx`.
 *
 * The exclusion mirrors the import boundary ESLint already enforces in the other
 * direction: nothing outside the admin half may import `lib/admin`, and nothing
 * inside it serves a public page. Without this the check reported three
 * long-standing violations on every run, which is the state in which a check
 * stops being read at all.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["lib", "app", "components", "store"];

/** Field names that must never appear in a Storefront selection set. */
const FORBIDDEN = [
  "priceRange",
  "compareAtPriceRange",
  "compareAtPrice",
  "availableForSale",
  "quantityAvailable",
  "totalInventory",
  "currentlyNotInStock",
  "quantityPriceBreaks",
  "unitPrice",
];

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const violations: string[] = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const path = file.replace(/\\/g, "/");

    // Skip this checker's own list of forbidden names.
    if (path.endsWith("scripts/check-no-price.ts")) continue;

    // The admin half serves an operator, never a visitor. See the note above.
    if (path.startsWith("lib/admin/") || path.startsWith("components/admin/")) continue;
    if (path.startsWith("app/(admin)/") || path.startsWith("app/api/admin/")) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const field of FORBIDDEN) {
        // Match the field as a GraphQL selection, not as prose in a comment.
        if (new RegExp(`(^|[\\s{(])${field}\\b`).test(line) && !line.trimStart().startsWith("*")) {
          violations.push(`${file}:${index + 1}  ${field}  →  ${line.trim()}`);
        }
      }
    });
  }
}

if (violations.length) {
  console.error(`\n✕ ${violations.length} price/inventory field(s) found:\n`);
  for (const violation of violations) console.error("  " + violation);
  console.error("\nThe storefront is inquiry-only. Remove these from the query.\n");
  process.exit(1);
}

console.log("✓ No price, inventory or availability fields in any query.");
