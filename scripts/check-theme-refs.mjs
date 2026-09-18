/**
 * Structural checks a theme needs and neither tsc nor eslint can give it.
 *
 * Liquid resolves everything at render time on Shopify's servers, and it fails
 * quietly: a `render` of a snippet that does not exist prints nothing, a section
 * type missing from a template drops silently, a malformed {% schema %} takes
 * the section out of the theme editor, a missing asset 404s, and a missing
 * translation key renders the words "translation missing" into the page. None of
 * it is visible locally until someone loads the affected page.
 *
 *   node scripts/check-theme-refs.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = process.argv[2] || "theme";

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
    else out.push(full);
  }
  return out;
}

const rel = (path) => relative(".", path).replace(/\\/g, "/");
const stem = (path) => basename(path).replace(/\.(liquid|json)$/, "");

const files = walk(ROOT);
const liquid = files.filter((f) => f.endsWith(".liquid"));
const json = files.filter((f) => f.endsWith(".json"));

const snippets = new Set(liquid.filter((f) => rel(f).includes("/snippets/")).map(stem));
const sectionTypes = new Set(liquid.filter((f) => rel(f).includes("/sections/")).map(stem));
const groups = new Set(json.filter((f) => rel(f).includes("/sections/")).map(stem));

const problems = [];
const stripComments = (src) =>
  src.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "");

/* 1 — every {% schema %} is valid JSON, and declares a name. */
for (const file of liquid.filter((f) => rel(f).includes("/sections/"))) {
  const match = /\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/.exec(readFileSync(file, "utf8"));
  if (!match) {
    problems.push(`${rel(file)}  has no {% schema %} — it cannot be used in a template`);
    continue;
  }
  try {
    const schema = JSON.parse(match[1]);
    if (!schema.name) problems.push(`${rel(file)}  schema has no "name"`);
  } catch (error) {
    problems.push(`${rel(file)}  schema is not valid JSON — ${error.message}`);
  }
}

/* 2 — every standalone .json parses. */
for (const file of json) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`${rel(file)}  is not valid JSON — ${error.message}`);
  }
}

/* 3 — every {% render %} and {% include %} resolves to a snippet. */
for (const file of liquid) {
  const source = stripComments(readFileSync(file, "utf8"));
  for (const [, name] of source.matchAll(/\{%-?\s*(?:render|include)\s+'([^']+)'/g)) {
    if (!snippets.has(name)) problems.push(`${rel(file)}  renders missing snippet '${name}'`);
  }
}

/* 4 — every {% sections %} group referenced by the layout exists. */
for (const file of liquid.filter((f) => rel(f).includes("/layout/"))) {
  const source = stripComments(readFileSync(file, "utf8"));
  for (const [, name] of source.matchAll(/\{%-?\s*sections\s+'([^']+)'/g)) {
    if (!groups.has(name)) problems.push(`${rel(file)}  references missing section group '${name}'`);
  }
}

/* 5 — every section type named by a template or group has a .liquid file, and
       every block type a group uses is declared by that section's schema. */
for (const file of json) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue; // already reported
  }
  for (const [key, section] of Object.entries(doc.sections ?? {})) {
    if (!section?.type) continue;
    if (!sectionTypes.has(section.type)) {
      problems.push(`${rel(file)}  "${key}" uses missing section type '${section.type}'`);
      continue;
    }

    const sectionFile = liquid.find(
      (f) => rel(f).includes("/sections/") && stem(f) === section.type,
    );
    const match = /\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/.exec(
      readFileSync(sectionFile, "utf8"),
    );
    if (!match) continue;

    let schema;
    try {
      schema = JSON.parse(match[1]);
    } catch {
      continue;
    }

    const declared = new Set((schema.blocks ?? []).map((b) => b.type));
    for (const [blockKey, block] of Object.entries(section.blocks ?? {})) {
      if (block?.type && !declared.has(block.type)) {
        problems.push(
          `${rel(file)}  "${key}" block "${blockKey}" uses type '${block.type}', which ${section.type} does not declare`,
        );
      }
    }
  }
}

/* 6 — every asset referenced by name exists. A missing one 404s at render. */
const assets = new Set(files.filter((f) => rel(f).includes("/assets/")).map((f) => basename(f)));
for (const file of liquid) {
  const source = stripComments(readFileSync(file, "utf8"));
  for (const [, name] of source.matchAll(/'([A-Za-z0-9._-]+\.(?:css|js|svg|png|jpg|woff2))'\s*\|\s*asset_url/g)) {
    if (!assets.has(name)) problems.push(`${rel(file)}  references missing asset '${name}'`);
  }
}

/* 7 — every 'key' | t resolves in the default locale. A missing key renders as
       "translation missing: en.foo.bar" in the page, which is easy to ship. */
const localeFile = files.find((f) => rel(f).endsWith("/locales/en.default.json"));
if (localeFile) {
  let dictionary = {};
  try {
    dictionary = JSON.parse(readFileSync(localeFile, "utf8"));
  } catch {
    // already reported by check 2
  }
  const resolves = (key) =>
    key
      .split(".")
      .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dictionary) !==
    undefined;

  for (const file of liquid) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const [, key] of source.matchAll(/'([a-z0-9_.]+)'\s*\|\s*t\b/g)) {
      if (!resolves(key)) problems.push(`${rel(file)}  missing translation key '${key}'`);
    }
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `${ROOT} resolves — ${sectionTypes.size} sections, ${snippets.size} snippets, ` +
    `${groups.size} section groups, ${assets.size} assets.`,
);
