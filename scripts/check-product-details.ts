/**
 * Content → Product details (`lib/shopify/product-details.ts`, `lib/admin/product-details.ts`,
 * the product page and the Liquid `sb-main-product`).
 *
 *   yarn check:product-details                 logic, and the Liquid blocks rendered
 *   CHECK_BASE_URL=http://localhost:3000 yarn check:product-details --ui
 *
 * The Liquid part renders the rows and panels blocks CUT FROM `theme/sections/sb-main-product.liquid`
 * itself (with liquidjs and the real `sb-accordion` snippet), with a saved list and
 * without one — so it tests the file, not a copy of it.
 *
 * `--ui` drives the admin screen against `yarn dev` (localhost only) and NEVER saves or
 * creates a field: both requests are blocked, and the check fails if one is sent.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Liquid } from "liquidjs";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";
import { DEFAULT_PRODUCT_DETAILS, detailKeyFor, parseProductDetails } from "../lib/shopify/product-details";
import { metafieldHtml } from "../lib/shopify/transforms";

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
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 300)}` : ""}`);
  if (!ok) failures += 1;
}

function logic() {
  check("a name becomes a field key", detailKeyFor("Weight (kg)", []) === "weight_kg");
  check("a taken key gets a number", detailKeyFor("Colour", ["colour", "colour_2"]) === "colour_3");
  check("a very short name still makes a valid key", /^[a-z0-9_]{3,}$/.test(detailKeyFor("Ø", [])));
  check("nothing saved → the page as built", parseProductDetails(null) === null && DEFAULT_PRODUCT_DETAILS.rows.length === 4);
  check("an unreadable list → the page as built", parseProductDetails('{"version":1,"rows":"x"}') === null);
  check(
    "a plain-text panel is escaped, in paragraphs",
    metafieldHtml(
      { notes: { key: "notes", namespace: "custom", type: "multi_line_text_field", value: "A <b>\nB\n\nC", reference: null, references: null } },
      "notes",
    ) === "<p>A &lt;b&gt;<br>B</p><p>C</p>",
  );
}

async function liquid() {
  const file = readFileSync(resolve(ROOT, "theme/sections/sb-main-product.liquid"), "utf8");
  const engine = new Liquid({ root: [resolve(ROOT, "theme/snippets")], extname: ".liquid" });
  // Translations: the key itself, so a label from them is recognisable in the output.
  engine.registerFilter("t", (key: string) => `t:${key}`);

  // Not the whole file: liquidjs refuses a `comment` inside `{% liquid %}`, which Shopify
  // allows and the file uses elsewhere. `yarn theme:lint` covers the file as a whole.
  const between = (start: string, end: string) => {
    const from = file.indexOf(start);
    const to = file.indexOf(end, from);
    return from >= 0 && to > from ? file.slice(from, to + end.length) : "";
  };
  const specs = between("{%- capture specs -%}", "{%- endcapture -%}");
  const panelsStart = file.indexOf("{%- if details.panels -%}");
  const panels = file.slice(panelsStart, file.indexOf("{%- if m.downloads.value != blank -%}", panelsStart));
  check("the rows and panels blocks are where the check expects them", Boolean(specs) && panelsStart > 0);

  const template = `{%- liquid
    assign m = product.metafields.custom
    assign availability = m.availability.value
    assign lead_time = m.lead_time_weeks.value
    if availability != blank and lead_time != blank
      assign availability = availability | append: ' | ' | append: lead_time
    endif
    assign details = shop.metafields.custom.product_details.value
    assign t_panel_tech = 'product.panel.technical_specifications' | t
    assign t_panel_dimensions = 'product.panel.dimensions' | t
    assign t_panel_care = 'product.panel.care_maintenance' | t
    assign t_panel_shipping = 'product.panel.shipping_delivery' | t
  -%}${specs}<dl>{{ specs }}</dl>${panels}`;

  const product = {
    metafields: {
      custom: {
        colour: { value: "Oak" },
        availability: { value: "Made to order" },
        lead_time_weeks: { value: "12 weeks" },
        weight: { value: "14 kg" },
        dimensions: { value: "<p>80 × 40</p>" },
        assembly: { value: "<p>Two screws</p>" },
      },
    },
  };

  const built = await engine.parseAndRender(template, { product, shop: { metafields: { custom: {} } } });
  check("without a saved list: the rows as built, labels from the theme", built.includes("t:product.spec.colour") && built.includes("Oak"));
  check("…availability with its lead time", built.includes("Made to order | 12 weeks"));
  check("…and the panels as built", built.includes("t:product.panel.dimensions"));

  const saved = await engine.parseAndRender(template, {
    product,
    shop: {
      metafields: {
        custom: {
          product_details: {
            value: {
              rows: [
                { key: "weight", label: "Weight" },
                { key: "availability", label: "Ready" },
                { key: "colour", label: "Kleur" },
                { key: "upholstery", label: "Upholstery" },
              ],
              panels: [{ key: "assembly", label: "Assembly" }],
            },
          },
        },
      },
    },
  });
  const order = ["Weight", "Ready", "Kleur"].map((label) => saved.indexOf(`>${label}<`));
  check("with a saved list: its rows, its labels, its order", order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1]!)), saved);
  check("…a new field's value", saved.includes("14 kg"));
  check("…availability keeps its lead time under a new label", saved.includes("Made to order | 12 weeks"));
  check("…an empty field skips its row", !saved.includes(">Upholstery<"));
  check("…its panels only", saved.includes("Assembly") && saved.includes("Two screws") && !saved.includes("t:product.panel.dimensions"));
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
  let sent = false;
  await page.route("**/api/admin/product-details", (route) => {
    sent = true;
    return route.abort();
  });

  try {
    await page.goto(`${BASE}/admin/product-details`, { waitUntil: "networkidle", timeout: 90000 });
    check("the screen opens", (await page.getByRole("heading", { name: "Product details", level: 1 }).count()) === 1);
    check("the sidebar has a row for it", (await page.getByRole("link", { name: "Product details", exact: true }).count()) >= 1);

    const labels = page.getByLabel("Name on the product page");
    check(
      "it lists what product pages show today",
      (await labels.count()) === DEFAULT_PRODUCT_DETAILS.rows.length + DEFAULT_PRODUCT_DETAILS.panels.length &&
        (await labels.first().inputValue()) === DEFAULT_PRODUCT_DETAILS.rows[0]!.label,
    );
    await labels.first().fill("Materiaal");
    check("renaming is an unsaved change", (await page.getByText("You have unsaved changes").count()) === 1);
    await page.getByRole("button", { name: /^Move Materiaal down/ }).click();
    check("…moving one down reorders", (await labels.nth(1).inputValue()) === "Materiaal");

    await page.getByRole("button", { name: "Add a fact" }).click();
    await page.getByRole("menuitem", { name: "A new field…" }).click();
    check("“A new field…” asks for its name", (await page.getByRole("dialog").getByText("A new fact").count()) === 1);
    await page.getByRole("button", { name: "Cancel" }).click();

    await labels.nth(1).fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    check("a fact without a name is refused before saving", (await page.getByText("Give it a name — this is what visitors read.").count()) === 1 && !sent);
    await page.getByRole("button", { name: "Discard" }).click();
    check("Discard restores the list", (await labels.first().inputValue()) === DEFAULT_PRODUCT_DETAILS.rows[0]!.label);

    // The product page still says what it always said.
    const shop = await (await fetch(`${BASE}/shop`)).text();
    const handle = /href="\/shop\/([a-z0-9-]+)"/.exec(shop)?.[1];
    if (handle) {
      await page.goto(`${BASE}/shop/${handle}`, { waitUntil: "networkidle", timeout: 90000 });
      const shown = await page.locator("dt").allTextContents();
      check(
        "the product page draws its facts under the original labels",
        shown.length > 0 && shown.every((label) => DEFAULT_PRODUCT_DETAILS.rows.some((row) => row.label === label.trim())),
        shown.join(", "),
      );
    }

    check("no errors in the browser", errors.length === 0, errors.join(" | "));
    check("nothing was saved or created", !sent);
  } finally {
    await browser.close();
  }
}

async function main() {
  logic();
  await liquid();
  if (process.argv.includes("--ui")) await ui();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll product detail checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
