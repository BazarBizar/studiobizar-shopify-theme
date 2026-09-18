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
/**
 * Blanks out comments while KEEPING THE LINE COUNT, by replacing everything but
 * the newlines with spaces. Deleting them outright shifts every line number
 * after the first comment, and a checker that reports the wrong line is worse
 * than one that reports none — it sends you to read code that is fine.
 *
 * Two forms, because Liquid has two. `{% comment %}…{% endcomment %}` is the tag
 * pair; inside a `{% liquid %}` block the same thing is written as bare
 * `comment` … `endcomment` lines, which the tag-pair pattern does not see. Every
 * explanatory note this theme writes inside a `{% liquid %}` block was being
 * scanned as if it were code.
 */
const blank = (text) => text.replace(/[^\n]/g, " ");

const stripComments = (src) =>
  src
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, blank)
    .replace(/^[ \t]*comment\b[\s\S]*?^[ \t]*endcomment\b[ \t]*$/gm, blank);

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

/* 8 — no filters on `render` arguments.
       Liquid does not allow them, and the failure is a section that throws a
       syntax error at render time — invisible until the page is loaded. The fix
       is always the same: `{% assign x = ... | filter %}` first, then pass `x`.
       Caught here because it is easy to write `title: 'a.b' | t` by habit and
       nothing else in the toolchain looks inside a Liquid tag. */
for (const file of liquid) {
  const source = stripComments(readFileSync(file, "utf8"));

  for (const match of source.matchAll(/\{%-?\s*render\s+([\s\S]*?)-?%\}/g)) {
    // Strip quoted strings first, so a pipe inside a literal is not a filter.
    const args = match[1].replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    if (!args.includes("|")) continue;

    const line = source.slice(0, match.index).split("\n").length;
    problems.push(
      `${rel(file)}:${line}  filter used on a render argument — assign it first`,
    );
  }
}

/* 9 — settings rules Shopify enforces only at upload time.
       Both of these were found by `shopify theme push` rejecting the schema, not
       by theme-check, and an invalid schema takes the WHOLE SECTION out of the
       theme — which then cascades into "section type does not exist" on every
       template using it. Cheap to check here, expensive to discover there. */
function checkSettings(settings, where) {
  for (const setting of settings ?? []) {
    if (setting?.type === "range") {
      const { min, max, step, id } = setting;
      if ([min, max, step].some((n) => typeof n !== "number") || step <= 0) continue;

      // Floats lose precision here (0.1 steps over 0.8–1.3), so round before
      // testing for a whole number rather than comparing the raw quotient.
      const steps = Math.round(((max - min) / step) * 1e6) / 1e6;
      if (!Number.isInteger(steps)) {
        problems.push(`${where}  range '${id}': (max - min) is not divisible by step`);
      } else if (steps > 101) {
        problems.push(`${where}  range '${id}': ${steps} steps, Shopify allows at most 101`);
      }
    }

    // A `default` key that is present and empty is refused; omitting it is fine.
    if ("default" in (setting ?? {}) && setting.default === "") {
      problems.push(`${where}  setting '${setting.id}': default cannot be blank — omit the key`);
    }
  }
}

for (const file of liquid.filter((f) => rel(f).includes("/sections/"))) {
  const match = /\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/.exec(readFileSync(file, "utf8"));
  if (!match) continue;

  let schema;
  try {
    schema = JSON.parse(match[1]);
  } catch {
    continue; // already reported by check 1
  }

  checkSettings(schema.settings, rel(file));
  for (const block of schema.blocks ?? []) checkSettings(block.settings, rel(file));
}

{
  const file = files.find((f) => rel(f).endsWith("/config/settings_schema.json"));
  if (file) {
    try {
      for (const group of JSON.parse(readFileSync(file, "utf8"))) {
        checkSettings(group.settings, rel(file));
      }
    } catch {
      // already reported by check 2
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
