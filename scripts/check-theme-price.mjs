/**
 * The Liquid half of scripts/check-no-price.ts.
 *
 * That script guards the GraphQL side: no Storefront query may request price,
 * inventory or availability, so the data never reaches the browser instead of
 * merely being hidden by CSS. A theme has no queries — Liquid hands every
 * object straight to the template, price included — so the same rule has to be
 * enforced one layer later, on what the templates actually print.
 *
 * This matters more here than it did in Next. The theme is built from a
 * skeleton rather than Dawn precisely because Dawn is organised around price
 * and cart, but Dawn remains in the repo as a reference, and a snippet lifted
 * from it will bring `{{ product.price | money }}` along without anyone
 * noticing. This is what notices.
 *
 *   node scripts/check-theme-price.mjs
 *   node scripts/check-theme-price.mjs "Shopify Dawn Theme/snippets"
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Defaults to the theme; take a path argument to vet a snippet before lifting
// it out of "Shopify Dawn Theme", which is what this is most useful for.
const ROOT = process.argv[2] || "theme";

/**
 * Two classes of violation.
 *
 * `output` is anything that would render a price or a stock state. The money
 * filters are listed because they are unambiguous — a template that reaches for
 * `| money` has already decided to show a number.
 *
 * `cart` is the checkout machinery. There is no cart in this storefront: a
 * visitor collects products into an inquiry list held in their browser. A form
 * posting to /cart/add means someone reintroduced one.
 */
const FORBIDDEN = [
  // price output
  { pattern: /\|\s*money(_with_currency|_without_currency|_without_trailing_zeros)?\b/, label: "money filter" },
  { pattern: /\b(product|variant|item|line_item)\.price\b/, label: "price" },
  { pattern: /\bcompare_at_price\b/, label: "compare_at_price" },
  { pattern: /\bprice_min\b|\bprice_max\b|\bprice_varies\b/, label: "price range" },
  { pattern: /\bunit_price\b/, label: "unit_price" },

  // inventory
  { pattern: /\b(available|inventory_quantity|inventory_policy|inventory_management)\b/, label: "inventory" },

  // cart and checkout
  { pattern: /\/cart\/add/, label: "cart endpoint" },
  { pattern: /\bcart\.(items|item_count|total_price|checkout)/, label: "cart object" },
  { pattern: /\{%-?\s*form\s+['"]product['"]/, label: "product form (add to cart)" },
  { pattern: /\bcheckout_url\b/, label: "checkout" },
];

/** Where the words are discussed rather than used. */
const EXEMPT = [/^theme\/locales\//];

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(liquid|json|js)$/.test(full)) out.push(full);
  }
  return out;
}

/** A Liquid comment block, or a line inside one, is prose — not output. */
function stripComments(source) {
  return source
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, (match) =>
      match.replace(/[^\n]/g, " "),
    )
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, " "));
}

const violations = [];

for (const file of walk(ROOT)) {
  const rel = relative(".", file).replace(/\\/g, "/");
  if (EXEMPT.some((pattern) => pattern.test(rel))) continue;

  const lines = stripComments(readFileSync(file, "utf8")).split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${rel}:${index + 1}  ${label}  →  ${line.trim()}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`NO PRICE, NO CART — ${violations.length} violation(s):\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "\nThis storefront is a catalogue. If a price genuinely belongs on a page,\n" +
      "that is a decision to make deliberately — change this script and the note\n" +
      "at the top of lib/shopify/fragments.ts together, not one of them.",
  );
  process.exit(1);
}

console.log(`${ROOT} is clean — no price, no inventory, no cart.`);
