// Serves the exact broken and fixed breadcrumb markup, then checks the scanner's verdict.
import { createServer } from "node:http";

const BROKEN = `<ol><li data-slot="breadcrumb-item"><li data-slot="breadcrumb-separator"></li>Projects</li></ol>`;
const FIXED  = `<ol><li data-slot="breadcrumb-separator"></li><li data-slot="breadcrumb-item">Projects</li></ol>`;
const PARA   = `<p>outer <p>inner</p></p>`;
const OK_P   = `<p>one</p><div><p>two</p></div>`;

const pages = { "/broken": BROKEN, "/fixed": FIXED, "/nested-p": PARA, "/ok-p": OK_P };

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><html><body>${pages[req.url] ?? ""}</body></html>`);
});

await new Promise((resolve) => server.listen(3999, resolve));

const { spawnSync } = await import("node:child_process");
for (const [path, expected] of [["broken", "FAIL"], ["fixed", "ok"], ["nested-p", "FAIL"], ["ok-p", "ok"]]) {
  const run = spawnSync(process.execPath, ["scripts/check-html-nesting.mjs", path], {
    env: { ...process.env, BASE_URL: "http://localhost:3999" },
    encoding: "utf8",
  });
  const got = run.stdout.includes("FAIL") ? "FAIL" : "ok";
  console.log(`  /${path.padEnd(10)} expected ${expected.padEnd(4)} got ${got.padEnd(4)} ${got === expected ? "PASS" : "*** SELFTEST FAILED ***"}`);
}

server.close();
