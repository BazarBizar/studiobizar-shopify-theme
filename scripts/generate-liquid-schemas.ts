/**
 * Writes the `{% schema %}` of every theme section that draws a page-builder
 * section, from the Next definition and its presets (see scripts/lib/liquid.ts).
 * The markup above the schema is hand-written and left alone.
 *
 *   yarn liquid:schemas           # rewrite the schemas
 *   yarn liquid:schemas --check   # fail if any schema is out of date (check:liquid runs this)
 *
 * Run it after changing a section's fields or presets in lib/page-builder/.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SectionType } from "../lib/page-builder/registry";

import { LIQUID_SECTIONS, SCHEMA_PATTERN, schemaBlock } from "./lib/liquid";

const ROOT = resolve(__dirname, "..");
const checkOnly = process.argv.includes("--check");
let stale = 0;

for (const [type, file] of Object.entries(LIQUID_SECTIONS) as [SectionType, string][]) {
  const path = resolve(ROOT, "theme/sections", `${file}.liquid`);
  if (!existsSync(path)) {
    console.error(`✗ theme/sections/${file}.liquid is missing — write its markup, ending in an empty {% schema %}{% endschema %}`);
    stale += 1;
    continue;
  }
  const source = readFileSync(path, "utf8");
  if (!SCHEMA_PATTERN.test(source)) {
    console.error(`✗ ${file}.liquid has no {% schema %} block to fill`);
    stale += 1;
    continue;
  }
  const next = source.replace(SCHEMA_PATTERN, schemaBlock(type));
  if (next === source) continue;
  if (checkOnly) {
    console.error(`✗ ${file}.liquid: schema is out of date — run: yarn liquid:schemas`);
    stale += 1;
  } else {
    writeFileSync(path, next, "utf8");
    console.log(`wrote the schema of ${file}.liquid`);
  }
}

if (stale) process.exit(1);
if (checkOnly) console.log("✓ every theme section schema matches the page builder");
