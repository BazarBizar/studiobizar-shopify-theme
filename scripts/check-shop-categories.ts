/**
 * Content → Shop categories (`lib/admin/shop-categories.ts`, `lib/shopify/categories.ts`).
 *
 *   yarn check:shop-categories                 the logic only
 *   CHECK_BASE_URL=http://localhost:3000 yarn check:shop-categories --ui
 *
 * The logic: slugs made from names, kept on rename, never shared; a saved list that
 * cannot be read falls back to the original; product types are escaped in the query.
 *
 * `--ui` drives the admin screen and the Shop page in Chromium against `yarn dev`
 * (localhost only, signed in like `check-theme-builder-ui.ts`). It NEVER presses Save —
 * a save would change the live store's Shop page — so it checks everything up to it:
 * the warning for product types in no category and its "Add to…" fix, the unsaved
 * state, the refusal of an empty category, Discard, and the chips on /shop.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";
import {
  assignSlugs,
  categoryQuery,
  DEFAULT_CATEGORIES,
  findCategory,
  parseShopCategories,
  slugifyCategory,
} from "../lib/shopify/categories";

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
  check("a name becomes an address", slugifyCategory("Dressers, Cabinets & Consoles") === "dressers-cabinets-consoles");
  check("accents are dropped", slugifyCategory("Décoration") === "decoration");
  check("a name with no letters still gets an address", slugifyCategory("&&") === "category");

  const renamed = assignSlugs([{ slug: "lighting", label: "lamps & lights", types: ["Floor Lamps"] }]);
  check("renaming keeps the old address", renamed[0]!.slug === "lighting");

  const clash = assignSlugs([
    { slug: null, label: "Lamps", types: ["A"] },
    { slug: "lamps", label: "Lighting", types: ["B"] },
    { slug: null, label: "lamps", types: ["C"] },
  ]);
  check(
    "a new category never takes an existing address",
    clash[1]!.slug === "lamps" && clash[0]!.slug === "lamps-2" && clash[2]!.slug === "lamps-3",
    clash.map((c) => c.slug).join(","),
  );
  check("a type listed twice is kept once", assignSlugs([{ slug: null, label: "x", types: ["A", "A"] }])[0]!.types.length === 1);

  check("nothing saved → the original list", parseShopCategories(null) === null && parseShopCategories("") === null);
  check("unreadable → the original list", parseShopCategories("{not json") === null && parseShopCategories('{"version":9}') === null);
  check(
    "an emptied list is still a list",
    parseShopCategories(JSON.stringify({ version: 1, categories: [] }))?.categories.length === 0,
  );

  check(
    "types are quoted and escaped",
    categoryQuery({ slug: "a", label: "a", types: ['Say "hi"', "Bar Tables"] }) === 'product_type:"Say \\"hi\\"" OR product_type:"Bar Tables"',
  );
  check("an unknown chip is no filter", findCategory(DEFAULT_CATEGORIES, "nope") === null);
}

async function ui() {
  const { hostname } = new URL(BASE);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(`✗ ${BASE} is not a local server. The UI part only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }
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
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ws://127.0.0.1")) errors.push(message.text());
  });
  // Belt and braces: the check must never save.
  let saved = false;
  await page.route("**/api/admin/shop-categories", (route) => {
    saved = true;
    return route.abort();
  });

  try {
    await page.goto(`${BASE}/admin/shop-categories`, { waitUntil: "networkidle", timeout: 90000 });
    check("the screen opens", (await page.getByRole("heading", { name: "Shop categories" }).count()) > 0);
    check("the sidebar has a row for it", (await page.getByRole("link", { name: "Shop categories", exact: true }).count()) >= 1);

    const names = page.getByPlaceholder("Category name, e.g. lamps");
    const count = await names.count();
    check("every category has a row", count > 0, count);

    const warning = page.getByText(/product types? (is|are) not in any category/);
    if ((await warning.count()) > 0) {
      const before = await warning.textContent();
      const first = page.locator('[data-slot="card"]').filter({ has: warning }).getByRole("button").first();
      const type = (await first.textContent())?.trim() ?? "";
      await first.click();
      await page.getByRole("menuitem").first().click();
      const after = (await warning.count()) ? await warning.textContent() : "gone";
      check(`"Add to…" puts “${type}” in a category`, after !== before, `${before} → ${after}`);
      check("…and the change is unsaved", (await page.getByText("You have unsaved changes").count()) === 1);
      await page.getByRole("button", { name: "Discard" }).click();
      check("Discard brings the warning back", (await warning.textContent()) === before);
    } else {
      console.log("– every product type is in a category; the warning has nothing to show");
    }

    await names.first().fill("UI check name");
    check("renaming makes the list unsaved", (await page.getByText("You have unsaved changes").count()) === 1);
    await page.getByRole("button", { name: "Add category" }).click();
    check("Add category adds a row", (await names.count()) === count + 1);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    check("a category without a name or types is refused before saving", (await page.getByText("Give this category a name.").count()) === 1 && !saved);
    check("…and says why", (await page.getByText(/Add at least one product type/).count()) === 1);
    await page.getByRole("button", { name: "Discard" }).click();
    check("Discard restores the list", (await names.count()) === count && (await page.getByText("All changes saved").count()) === 1);

    await page.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 90000 });
    const chip = page.getByRole("button", { name: DEFAULT_CATEGORIES[0]!.label, exact: true });
    check("the Shop page draws the category chips", (await chip.count()) === 1);
    await page.goto(`${BASE}/shop?category=${DEFAULT_CATEGORIES[5]!.slug}`, { waitUntil: "networkidle", timeout: 90000 });
    check(
      "a chip's address filters the grid",
      (await page.getByRole("button", { name: DEFAULT_CATEGORIES[5]!.label, exact: true, pressed: true }).count()) === 1,
    );

    check("no errors in the browser", errors.length === 0, errors.join(" | "));
    check("nothing was saved", !saved);
  } finally {
    await browser.close();
  }
}

async function main() {
  logic();
  if (process.argv.includes("--ui")) await ui();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll shop category checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
