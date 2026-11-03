/**
 * Settings → Site texts (`lib/site-texts.ts`, `lib/admin/site-texts.ts`).
 *
 *   yarn check:site-texts                 the logic, and that every text is used
 *   CHECK_BASE_URL=http://localhost:3000 yarn check:site-texts --ui
 *
 * "Every text is used": each key in the list must appear in the code that draws the
 * site, so the panel never offers a field that changes nothing.
 *
 * `--ui` drives the admin screen and the storefront pages that show the texts, in
 * Chromium against `yarn dev` (localhost only). It NEVER presses Save — a save would
 * change the live site — so it checks everything up to it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";
import {
  DEFAULT_SITE_TEXTS,
  fillText,
  onlyChanges,
  parseSiteTexts,
  resolveSiteTexts,
  SITE_TEXT_GROUPS,
} from "../lib/site-texts";

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

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function logic() {
  const keys = SITE_TEXT_GROUPS.flatMap((group) => group.texts.map((text) => text.key));
  check("every text has its own key", new Set(keys).size === keys.length);
  check(
    "every placeholder a text uses is offered as a button",
    SITE_TEXT_GROUPS.every((group) =>
      group.texts.every((text) =>
        [...text.value.matchAll(/\{(\w+)\}/g)].every((match) => "vars" in text && (text.vars as readonly string[]).includes(match[1]!)),
      ),
    ),
  );

  const code = [...sources(join(ROOT, "app")), ...sources(join(ROOT, "components")), ...sources(join(ROOT, "lib"))]
    .filter((path) => !path.endsWith(join("lib", "site-texts.ts")) && !path.includes(join("components", "admin")))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const unused = keys.filter((key) => !code.includes(`"${key}"`));
  check("every text is used by the site", unused.length === 0, unused.join(", "));

  check("only real changes are kept", JSON.stringify(onlyChanges({ "product.idea": "  ", "shop.title": "Products", nope: "x", "search.title": " Zoeken " })) === '{"search.title":"Zoeken"}');
  check("nothing saved → the originals", JSON.stringify(resolveSiteTexts(null)) === JSON.stringify(DEFAULT_SITE_TEXTS));
  check("unreadable → the originals", parseSiteTexts("{oops") === null && parseSiteTexts('{"version":2,"texts":{}}') === null);
  check(
    "a saved change wins, the rest stays",
    resolveSiteTexts({ version: 1, texts: { "shop.title": "Producten" } })["shop.title"] === "Producten" &&
      resolveSiteTexts({ version: 1, texts: { "shop.title": "Producten" } })["search.title"] === "Search",
  );
  check("placeholders are filled", fillText("Hello {name}, ref {reference}", { name: "Ann", reference: "SB-1" }) === "Hello Ann, ref SB-1");
  check("an unknown placeholder is left alone", fillText("Hi {nobody}", { name: "Ann" }) === "Hi {nobody}");
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
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => {
    // The 404 page logs its own status as a failed resource load.
    if (message.type() === "error" && !message.text().includes("ws://127.0.0.1") && !message.text().includes("404")) {
      errors.push(`${page.url()}: ${message.text()}`);
    }
  });
  let saved = false;
  await page.route("**/api/admin/site-texts", (route) => {
    saved = true;
    return route.abort();
  });

  try {
    await page.goto(`${BASE}/admin/site-texts`, { waitUntil: "networkidle", timeout: 90000 });
    check("the screen opens", (await page.getByRole("heading", { name: "Site texts" }).count()) > 0);
    check("the sidebar has a row for it", (await page.getByRole("link", { name: "Site texts", exact: true }).count()) >= 1);

    const search = page.getByLabel("Find a text");
    await search.fill("price on");
    const price = page.getByLabel("Where a price would be");
    check("searching by the words on the site finds the text", (await price.count()) === 1 && (await page.getByLabel("Heading", { exact: true }).count()) === 0);
    check("…showing the words the site uses now", (await price.inputValue()) === DEFAULT_SITE_TEXTS["product.priceOnRequest"]);
    await price.fill("Prijs op aanvraag");
    check("a change is unsaved", (await page.getByText("You have unsaved changes").count()) === 1);
    check("…and shows the original under it", (await page.getByText(`Original: ${DEFAULT_SITE_TEXTS["product.priceOnRequest"]}`).count()) === 1);
    await page.getByRole("button", { name: "Back to original" }).click();
    check("Back to original undoes it", (await price.inputValue()) === DEFAULT_SITE_TEXTS["product.priceOnRequest"] && (await page.getByText("All changes saved").count()) === 1);

    await search.fill("");
    await search.fill("opening text");
    const intro = page.getByLabel("To the customer: opening text");
    await intro.fill("Dear customer, thanks.");
    check("removing a placeholder warns what goes missing", (await page.getByText(/Without \{name\} the customer’s name is not shown/).count()) === 1);
    await page.getByRole("button", { name: "Customer’s name" }).click();
    check("the button puts the placeholder back", (await intro.inputValue()).includes("{name}"));
    await intro.fill("");
    check("an emptied text says the original is used", (await page.getByText("Empty — the original text is used.").count()) === 1);
    check("…and is not an unsaved change", (await page.getByText("All changes saved").count()) === 1);
    await search.fill("zzzz nothing");
    check("a search with no match says where else to look", (await page.getByText(/No text contains/).count()) === 1);

    // The storefront still says what it always said.
    await page.goto(`${BASE}/inquiry`, { waitUntil: "networkidle", timeout: 90000 });
    check("/inquiry: heading", (await page.getByRole("heading", { name: DEFAULT_SITE_TEXTS["inquiry.title"], level: 1 }).count()) === 1);
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle", timeout: 90000 });
    check("/contact: the form's fields", (await page.getByPlaceholder(DEFAULT_SITE_TEXTS["contact.fieldFirstName"]).count()) === 1);
    // Sent empty: the browser-side check answers, nothing reaches the server.
    await page.getByRole("button", { name: DEFAULT_SITE_TEXTS["contact.send"] }).click();
    check(
      "/contact: an empty form says what is missing, in the Site texts' words",
      (await page.getByText(DEFAULT_SITE_TEXTS["form.errorFirstName"]).count()) === 1 &&
        (await page.getByText(DEFAULT_SITE_TEXTS["form.errorEmail"]).count()) === 1,
    );
    await page.goto(`${BASE}/no-such-page-check`, { waitUntil: "networkidle", timeout: 90000 });
    check("404: heading", (await page.getByRole("heading", { name: DEFAULT_SITE_TEXTS["notFound.title"] }).count()) === 1);
    await page.goto(`${BASE}/inquiry/success?id=SB-CHECK`, { waitUntil: "networkidle", timeout: 90000 });
    check(
      "after sending: the reference sits inside its sentence",
      (await page.locator("strong", { hasText: "SB-CHECK" }).count()) === 1 && (await page.getByText(/Your reference is/).count()) === 1,
    );
    await page.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 90000 });
    const product = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    if (product) {
      await page.goto(`${BASE}${product}`, { waitUntil: "networkidle", timeout: 90000 });
      check("product page: price line", (await page.getByText(DEFAULT_SITE_TEXTS["product.priceOnRequest"]).count()) === 1);
      check("product page: enquire button", (await page.getByRole("button", { name: DEFAULT_SITE_TEXTS["product.enquire"] }).count()) === 1);
    } else {
      check("the Shop page links to a product", false);
    }

    check("no errors in the browser", errors.length === 0, errors.join(" | "));
    check("nothing was saved", !saved);
  } finally {
    await browser.close();
  }
}

async function main() {
  logic();
  if (process.argv.includes("--ui")) await ui();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll site text checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
