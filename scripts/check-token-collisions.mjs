/**
 * Catches the one failure mode that made the storefront render white-on-white:
 * a Tailwind utility name that the admin panel and the storefront both claim.
 *
 *   node scripts/check-token-collisions.mjs
 *
 * WHAT WENT WRONG, so the check is not mistaken for generic hygiene. Section K of
 * globals.css publishes the panel's tokens into the GLOBAL Tailwind namespace, on the
 * stated grounds that those names are "ones the storefront does not use". One of them,
 * `--color-secondary`, collided not with a storefront COLOUR but with its FONT SIZE:
 * `--text-secondary` is the shop's 16px/13px type scale, used 60 times. Tailwind
 * resolves `text-*` against `--color-*` before `--text-*` whatever the declaration
 * order, so the colour won, the type scale vanished, and those 60 elements were painted
 * oklch(0.97 0 0) on a white page. Switching the panel to dark flipped the same variable
 * and the change followed the operator out to /shop, because `.dark` sits on <html>.
 *
 * None of that is visible to tsc, to eslint, or to a build. Only to an eye on the page.
 *
 * TWO CHECKS:
 *  1. no name section K publishes globally is written by storefront code;
 *  2. no `--color-*` it publishes shares a name with the storefront's `--text-*` scale,
 *     since `text-<name>` is the single utility both namespaces claim.
 */

import fs from "node:fs";
import path from "node:path";

const CSS = "app/globals.css";
const ROOTS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

/** Panel code is allowed to use panel names; that is the whole point of them. */
const PANEL_PATHS = [path.join("components", "admin"), path.join("app", "(admin)")];

const UTILITY_PREFIXES = {
  color: ["bg", "text", "border", "ring", "fill", "stroke", "from", "to", "via", "divide",
          "outline", "placeholder", "shadow", "caret", "decoration", "accent"],
  font: ["font"],
  radius: ["rounded"],
  text: ["text"],
};

const css = fs.readFileSync(CSS, "utf8");

/* ---- what section K publishes globally --------------------------------- */

const sectionStart = css.indexOf("K. ADMIN PANEL");
if (sectionStart === -1) {
  console.error(`Could not find section K in ${CSS}. If it was renamed, update this script.`);
  process.exit(1);
}

const blockStart = css.indexOf("@theme inline {", sectionStart);
const blockEnd = css.indexOf("\n}", blockStart);
const block = css.slice(blockStart, blockEnd);

const published = [...block.matchAll(/--(color|font|radius|text)-([a-z0-9-]+)\s*:/g)].map((m) => ({
  ns: m[1],
  name: m[2],
}));

if (published.length === 0) {
  console.error("Parsed zero published names — the section K block moved. Fix this script.");
  process.exit(1);
}

/* ---- the storefront's type scale, declared before section K ------------- */

const typeScale = new Set(
  [...css.slice(0, sectionStart).matchAll(/--text-([a-z0-9-]+)\s*:/g)]
    .map((m) => m[1])
    .filter((name) => !name.endsWith("--line-height")),
);

/* ---- storefront sources ------------------------------------------------- */

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (/\.tsx?$/.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

const storefrontFiles = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (PANEL_PATHS.some((panel) => file.startsWith(panel))) continue;
    storefrontFiles.push(file);
  }
}

/**
 * Comments are stripped before matching. The prose in app/layout.tsx says the words
 * "font-sans" while explaining that the storefront does not use it, and a checker that
 * reports its own documentation is a checker people learn to ignore.
 */
const sources = storefrontFiles.map((file) => ({
  file,
  text: fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 "),
}));

/* ---- check 1: is a published name written by the shop? ------------------ */

let failures = 0;

for (const { ns, name } of published) {
  const prefixes = UTILITY_PREFIXES[ns];
  if (!prefixes) continue;

  const pattern = new RegExp(`(?:^|[\\s"'\`:])(?:${prefixes.join("|")})-${name}(?:/|\\b)`);

  const hits = sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
  if (hits.length === 0) continue;

  failures += 1;
  console.log(`COLLISION  --${ns}-${name} is published globally and written by the storefront`);
  for (const file of hits.slice(0, 5)) console.log(`             ${file}`);
  if (hits.length > 5) console.log(`             ...and ${hits.length - 5} more`);
}

/* ---- check 2: colour name vs the shop's type scale ---------------------- */

for (const { ns, name } of published) {
  if (ns !== "color" || !typeScale.has(name)) continue;

  failures += 1;
  console.log(
    `COLLISION  --color-${name} shadows the storefront's --text-${name} type scale;` +
      ` \`text-${name}\` will compile to a colour, not a size`,
  );
}

/* ---- report ------------------------------------------------------------- */

console.log("-".repeat(70));
console.log(
  failures === 0
    ? `ok  ${published.length} globally published names, none claimed by the storefront ` +
        `(${storefrontFiles.length} files, ${typeScale.size} type-scale names)`
    : `${failures} collision(s) — rename the panel's token, as --color-admin-secondary was`,
);

process.exit(failures === 0 ? 0 : 1);
