/**
 * Builds theme-build/sb-theme.css → theme/assets/sb-theme.css.
 *
 * A Shopify theme has no build step: it serves assets/ verbatim. So the Tailwind
 * output is compiled here and COMMITTED, and the committed file is what the
 * store loads. Run this after touching any .liquid file, because Tailwind only
 * emits the utilities it can see — a class that appears for the first time in a
 * section will be missing from the stylesheet until the next build.
 *
 *   node theme-build/build.mjs          # once
 *   node theme-build/build.mjs --watch  # while working on sections
 *   node theme-build/build.mjs --check  # CI: fail if the committed file is stale
 *
 * Uses @tailwindcss/postcss, already a devDependency of the Next app, rather
 * than adding @tailwindcss/cli — one fewer thing to keep in step with Tailwind's
 * version.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const INPUT = join(here, "sb-theme.css");
const OUTPUT = join(root, "theme", "assets", "sb-theme.css");
const THEME_DIR = join(root, "theme");

const mode = process.argv.includes("--watch")
  ? "watch"
  : process.argv.includes("--check")
    ? "check"
    : "build";

const digest = (text) => createHash("sha256").update(text).digest("hex").slice(0, 12);

async function compile() {
  const css = await readFile(INPUT, "utf8");
  const result = await postcss([tailwind()]).process(css, {
    from: INPUT,
    to: OUTPUT,
  });

  for (const warning of result.warnings()) {
    console.warn(`  warning: ${warning.toString()}`);
  }

  return result.css;
}

async function readOutput() {
  try {
    return await readFile(OUTPUT, "utf8");
  } catch {
    return null;
  }
}

async function build({ quiet = false } = {}) {
  const started = Date.now();
  const css = await compile();

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, css, "utf8");

  if (!quiet) {
    const kb = (Buffer.byteLength(css) / 1024).toFixed(1);
    console.log(
      `built ${relative(root, OUTPUT)} — ${kb} kB, ${digest(css)}, ${Date.now() - started}ms`,
    );
  }
  return css;
}

async function check() {
  const fresh = await compile();
  const committed = await readOutput();

  if (committed === null) {
    console.error(`missing ${relative(root, OUTPUT)} — run: node theme-build/build.mjs`);
    process.exit(1);
  }
  if (committed !== fresh) {
    console.error(
      `${relative(root, OUTPUT)} is stale\n` +
        `  committed ${digest(committed)}\n` +
        `  rebuilt   ${digest(fresh)}\n` +
        `  run: node theme-build/build.mjs`,
    );
    process.exit(1);
  }
  console.log(`${relative(root, OUTPUT)} is up to date — ${digest(fresh)}`);
}

async function startWatch() {
  await build();
  console.log("watching theme/**/*.liquid and theme-build/sb-theme.css — ctrl-c to stop");

  // Coalesce the burst of events an editor save produces into one rebuild.
  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      build().catch((error) => console.error(`  build failed: ${error.message}`));
    }, 60);
  };

  watch(THEME_DIR, { recursive: true }, (_event, filename) => {
    // The build writes into theme/assets itself; reacting to that would loop.
    if (!filename || filename.replace(/\\/g, "/").startsWith("assets/")) return;
    schedule();
  });
  watch(INPUT, schedule);
}

await stat(INPUT).catch(() => {
  console.error(`missing ${relative(root, INPUT)}`);
  process.exit(1);
});

if (mode === "check") await check();
else if (mode === "watch") await startWatch();
else await build();
