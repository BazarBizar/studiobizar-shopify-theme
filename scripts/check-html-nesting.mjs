/**
 * Checks the server-rendered HTML of the admin screens for element nesting that HTML
 * forbids.
 *
 *   yarn build && yarn start   # in one terminal
 *   yarn check:nesting         # in another
 *
 * WHY THIS EXISTS. React reports invalid nesting as a HYDRATION error in the browser
 * console — not at build time, not in the server log, and not in a status code. A page can
 * return 200, contain every element you grepped for, and still be broken. That is exactly
 * how a `<li>` nested inside a `<li>` shipped from the breadcrumb component: every check
 * that had been run was a status code or a substring search, and neither can see structure.
 *
 * Deliberately a small hand-rolled scanner rather than a parser dependency: a real parser
 * silently CORRECTS invalid nesting while building its tree, which is the one behaviour
 * that would hide the bug being looked for.
 *
 * NO AUTO-CLOSING IS MODELLED, and that is the point. A browser really does close an open
 * `<p>` when it meets another `<p>`, so by the time markup is parsed the nesting has been
 * repaired and there is nothing left to find. React validates the tree as AUTHORED, which
 * is why it warns about cases the parsed document no longer contains. Since React always
 * emits explicitly closed elements, matching close tags are enough and inferring more only
 * suppresses findings — an earlier version of this file modelled `<p>` auto-closing and
 * scored a clean pass on `<p>outer <p>inner</p></p>`.
 */

/** Nesting HTML forbids. Key = element, value = ancestors it may not appear inside. */
const FORBIDDEN = {
  li: ["li"],
  p: ["p"],
  a: ["a"],
  button: ["button", "a"],
  form: ["form"],
};

/**
 * Ancestors that END the search for a forbidden one.
 *
 * A submenu — `<li><ul><li>…` — is perfectly valid: the inner `<li>` belongs to the inner
 * `<ul>`, not to the outer `<li>`. Without this the scanner flags every dropdown nav on
 * the storefront, and a checker that cries wolf is a checker nobody runs.
 */
const SCOPE_RESET = {
  li: ["ul", "ol", "menu"],
};

/** Void elements never open a scope. */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

export function scan(html) {
  const problems = [];
  const stack = [];

  // Script and style contents are not markup; their text would produce phantom tags.
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  for (const match of cleaned.matchAll(TAG)) {
    const [, closing, rawName, , selfClosing] = match;
    const name = rawName.toLowerCase();

    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at !== -1) stack.length = at;
      continue;
    }

    if (VOID.has(name) || selfClosing) continue;

    const forbidden = FORBIDDEN[name] ?? [];
    if (forbidden.length > 0) {
      const resets = SCOPE_RESET[name] ?? [];

      // Walk outwards from the nearest ancestor and stop at the first scope reset, so
      // only an ancestor in the SAME scope counts.
      for (let depth = stack.length - 1; depth >= 0; depth -= 1) {
        const ancestor = stack[depth];
        if (resets.includes(ancestor)) break;
        if (forbidden.includes(ancestor)) {
          problems.push({ name, ancestor, index: match.index ?? 0 });
          break;
        }
      }
    }

    stack.push(name);
  }

  return problems;
}

/** Imported by the self-test; only the direct invocation runs the CLI below. */
if (!import.meta.main) {
  // Nothing else to do when imported.
} else {
  await main();
}

async function main() {
const base = process.env.BASE_URL ?? "http://localhost:3000";
const cookie = process.env.ADMIN_COOKIE ?? "";

/**
 * Accepts paths with or without a leading slash. Git Bash on Windows rewrites a bare
 * `/admin` argument into `C:/Program Files/Git/admin` before node ever sees it, so the
 * usable form there is `admin admin/project` — normalised here rather than in the caller.
 */
const paths = process.argv.slice(2).map((arg) => (arg.startsWith("/") ? arg : `/${arg}`));
if (paths.length === 0) {
  console.error("Usage: node scripts/check-html-nesting.mjs admin admin/project ...");
  process.exit(2);
}

let failures = 0;

for (const path of paths) {
  const response = await fetch(base + path, { headers: cookie ? { cookie } : {} });
  const html = await response.text();
  const problems = scan(html);

  if (problems.length === 0) {
    console.log(`ok    ${path}  (${response.status})`);
    continue;
  }

  failures += 1;
  console.log(`FAIL  ${path}  (${response.status})`);

  for (const problem of problems.slice(0, 5)) {
    const context = html.slice(Math.max(0, problem.index - 90), problem.index + 60).replace(/\s+/g, " ");
    console.log(`        <${problem.name}> inside <${problem.ancestor}>`);
    console.log(`        …${context}…`);
  }
  if (problems.length > 5) console.log(`        (+${problems.length - 5} more)`);
}

console.log("-".repeat(58));
console.log(failures === 0 ? `no invalid nesting in ${paths.length} page(s)` : `${failures} page(s) with invalid nesting`);
process.exit(failures === 0 ? 0 : 1);
}
