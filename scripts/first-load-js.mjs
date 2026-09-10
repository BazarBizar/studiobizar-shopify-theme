/**
 * Per-route first-load JS, for every prerendered route.
 *
 *   yarn build && yarn measure:first-load
 *
 * Next 16 with Turbopack no longer prints the First Load JS table and emits no
 * app-build-manifest, so this measures the thing that actually matters instead:
 * the total size of every <script src> the route's prerendered HTML references.
 *
 * It exists to answer one question — did adding the admin panel make the public
 * storefront heavier? Save the output before a change, compare after. Sizes are
 * uncompressed bytes on disk, so treat them as a relative measure.
 */
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.argv[2] ?? ".";
const appDir = join(root, ".next/server/app");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const SCRIPT = new RegExp('src="/_next/(static/[^"]+[.]js)"', "g");

const rows = [];
for (const html of walk(appDir)) {
  const src = readFileSync(html, "utf8");
  const files = new Set([...src.matchAll(SCRIPT)].map((m) => m[1]));
  let bytes = 0;
  for (const f of files) {
    const p = join(root, ".next", f);
    if (existsSync(p)) bytes += statSync(p).size;
  }
  const route = "/" + relative(appDir, html).split(sep).join("/").replace(/[.]html$/, "");
  rows.push([route, files.size, bytes]);
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
for (const [route, n, bytes] of rows) {
  console.log(`${route.padEnd(34)} ${String(n).padStart(3)} chunks ${(bytes / 1024).toFixed(1).padStart(9)} kB`);
}
console.log("-".repeat(62));
console.log(`${"routes measured".padEnd(34)} ${String(rows.length).padStart(3)}`);
