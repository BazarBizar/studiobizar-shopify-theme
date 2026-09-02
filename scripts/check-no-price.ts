/**
 * Guards the inquiry-only model: no GraphQL query may request price, inventory
 * or availability. Catching it here is the difference between the data never
 * reaching the browser and it merely being hidden by CSS.
 *
 *   npx tsx scripts/check-no-price.ts
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
    // Skip this checker's own list of forbidden names.
    if (file.replace(/\\/g, "/").endsWith("scripts/check-no-price.ts")) continue;

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
