/**
 * Website → Redirects (`lib/redirects.ts`, `lib/redirect-map.ts`, `lib/admin/redirects.ts`, `proxy.ts`).
 *
 *   yarn check:redirects                 the logic, and the proxy's query against the store (read only)
 *   CHECK_BASE_URL=http://localhost:3000 yarn check:redirects --ui
 *
 * `--ui` asks `yarn dev` (localhost only) for addresses and reads the answers — Shopify's
 * own addresses redirect with 308, pages, files and the panel are left alone — and drives
 * the admin screen up to the point of saving. The only "add" it sends is one the server
 * must refuse (an address that still shows a product); should one ever be accepted, it
 * is deleted again and the check fails.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";
import { fetchRedirectRows } from "../lib/redirect-map";
import {
  buildRedirectMap,
  normalizePath,
  redirectSourceProblem,
  redirectSources,
  redirectTargetProblem,
  shopifyAddressRoute,
} from "../lib/redirects";

const ROOT = resolve(__dirname, "..");
const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("=")).trim();
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (/^".*"$/.test(value)) value = value.slice(1, -1);
  process.env[key] ??= value;
}

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 240)}` : ""}`);
  if (!ok) failures += 1;
}

function logic() {
  check("addresses compare without case, slash, query or domain", normalizePath("https://x.be/Old-Page/?a=1") === "/old-page");
  check("an escaped address compares as typed", normalizePath("/caf%C3%A9") === "/café");
  check(
    "a Shopify product redirect answers on its own path and on the shop's",
    JSON.stringify(redirectSources("/products/old")) === JSON.stringify(["/products/old", "/shop/old"]),
  );
  check("a Shopify page redirect answers on the page's route", redirectSources("/pages/our-services").includes("/services"));

  const map = buildRedirectMap([
    { path: "/products/old-chair", target: "/products/new-chair" },
    { path: "/old-page", target: "https://example.com/x" },
    { path: "/old-page", target: "/second" },
    { path: "/collections/same", target: "/collections/same" },
    { path: "/admin/x", target: "/y" },
  ]);
  check("Shopify's paths become the site's, on both ends", map.get("/shop/old-chair") === "/shop/new-chair");
  check("another website stays as it is", map.get("/old-page") === "https://example.com/x");
  check("a redirect onto itself is dropped", !map.has("/collections/same"));
  check("the panel is never redirected", !map.has("/admin/x"));

  check("/products/x goes to /shop/x", shopifyAddressRoute("/products/x") === "/shop/x");
  check("/pages/our-story goes to /our-story", shopifyAddressRoute("/pages/our-story") === "/our-story");
  check("the site's own addresses are left alone", shopifyAddressRoute("/shop/x") === null && shopifyAddressRoute("/collections/x") === null);

  check("the home page cannot be redirected", redirectSourceProblem("/") !== null);
  check("the panel cannot be redirected", redirectSourceProblem("/admin/pages") !== null);
  check("an address on another site cannot be the old one", redirectSourceProblem("//evil.example") !== null);
  check("a plain old address is fine", redirectSourceProblem("/old-page") === null);
  check("javascript: is no destination", redirectTargetProblem("javascript:alert(1)") !== null);
  check("http:// is refused, https:// is fine", redirectTargetProblem("http://x.be") !== null && redirectTargetProblem("https://x.be") === null);
}

async function store() {
  try {
    const rows = await fetchRedirectRows();
    check(`the proxy's query reads the store's redirects (${rows.length})`, Array.isArray(rows));
  } catch (error) {
    check("the proxy's query reads the store's redirects", false, error);
  }
}

async function ui() {
  const { hostname } = new URL(BASE);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(`✗ ${BASE} is not a local server. The UI part only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }

  const status = async (path: string) => {
    const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
    return { code: response.status, location: response.headers.get("location") ?? "" };
  };

  // A real product, from the shop's own listing.
  const shop = await (await fetch(`${BASE}/shop`)).text();
  const handle = /href="\/shop\/([a-z0-9-]+)"/.exec(shop)?.[1];
  if (handle) {
    const product = await status(`/products/${handle}?ref=check`);
    check(
      "/products/<handle> → 308 to /shop/<handle>, query kept",
      product.code === 308 && product.location.endsWith(`/shop/${handle}?ref=check`),
      `${product.code} ${product.location}`,
    );
  } else {
    check("the Shop page lists a product", false);
  }
  const page = await status("/pages/our-story");
  check("/pages/our-story → 308 to /our-story", page.code === 308 && page.location.endsWith("/our-story"), `${page.code} ${page.location}`);
  check("a page is not redirected", (await status("/shop")).code === 200);
  check("a file is not redirected", (await status("/products/x.svg")).code !== 308);
  const admin = await status("/admin");
  check("the panel's own gate is unchanged", admin.code === 307 && admin.location.includes("/staff/login"), `${admin.code} ${admin.location}`);

  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: STAFF_COOKIE,
      value: await encode({ token: { email, sub: email }, secret, salt: STAFF_COOKIE, maxAge: 3600 }),
      domain: hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const tab = await context.newPage();
  const errors: string[] = [];
  tab.on("pageerror", (error) => errors.push(error.message));
  tab.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ws://127.0.0.1") && !message.text().includes("422")) {
      errors.push(message.text());
    }
  });
  const created: string[] = [];
  tab.on("response", async (response) => {
    if (!response.url().endsWith("/api/admin/redirects") || !response.ok()) return;
    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    if (body?.id) created.push(body.id);
  });

  try {
    await tab.goto(`${BASE}/admin/redirects`, { waitUntil: "networkidle", timeout: 90000 });
    check("the screen opens", (await tab.getByRole("heading", { name: "Redirects", level: 1 }).count()) === 1);
    check("the sidebar has a row for it", (await tab.getByRole("link", { name: "Redirects", exact: true }).count()) >= 1);

    const from = tab.getByLabel("Old address");
    const add = tab.getByRole("button", { name: "Add redirect" });
    await from.fill("/admin/secret");
    await add.click();
    check("the panel's address is refused at once", (await tab.getByRole("alert").filter({ hasText: "admin" }).count()) === 1);

    await from.fill("/an-old-page");
    await add.click();
    check("a redirect without a destination asks for one", (await tab.getByText("Choose where visitors should go.").count()) === 1);

    if (handle) {
      await from.fill(`/shop/${handle}`);
      await tab.getByLabel("Send visitors to").click();
      await tab.getByRole("option").first().click();
      await add.click();
      await tab.getByRole("alert").filter({ hasText: "still shows" }).waitFor({ timeout: 30000 }).catch(() => undefined);
      check(
        "an address that still shows a product is refused, and says why",
        (await tab.getByRole("alert").filter({ hasText: /still shows the product/ }).count()) === 1,
      );
    }
    check("no errors in the browser", errors.length === 0, errors.join(" | "));
  } finally {
    // Nothing should have been created; if something was, take it away again.
    for (const id of created) {
      await tab.evaluate(
        (redirectId) =>
          fetch("/api/admin/redirects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "redirectDelete", id: redirectId }),
          }),
        id,
      );
    }
    check("nothing was created", created.length === 0, created.join(", "));
    await browser.close();
  }
}

async function main() {
  logic();
  await store();
  if (process.argv.includes("--ui")) await ui();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll redirect checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
