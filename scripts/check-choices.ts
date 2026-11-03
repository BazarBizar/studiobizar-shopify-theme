/**
 * "Add a choice" (`lib/admin/choices.ts`) and the Projects page's category chips.
 *
 *   CHECK_BASE_URL=http://localhost:3000 yarn check:choices
 *
 * Against `yarn dev`, localhost only. It never adds a choice: the dialog is opened and
 * cancelled, and the only request it sends is one the server must refuse (a field no
 * module opens) before anything is written.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";

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

async function main() {
  const { hostname } = new URL(BASE);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(`✗ ${BASE} is not a local server.`);
    process.exit(1);
  }
  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");

  // The storefront: one chip per category in use, none empty.
  const projects = await (await fetch(`${BASE}/projects`)).text();
  const chips = [...projects.matchAll(/aria-pressed="(?:true|false)"[^>]*>([a-z][a-z &-]*?)\s*<!-- -->\s*<span[^>]*>(\d+)</g)];
  check(
    "/projects: a chip per category in use, each with projects",
    chips.length > 1 && chips.every((chip) => Number(chip[2]) > 0),
    chips.map((chip) => `${chip[1]} ${chip[2]}`).join(", "),
  );

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
  let added = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/metaobjects/choices") && request.postData()?.includes('"project"')) added = true;
  });

  try {
    await page.goto(`${BASE}/admin/project`, { waitUntil: "networkidle", timeout: 90000 });
    const entry = await page.locator('a[href^="/admin/project/"]:not([href$="/new"])').first().getAttribute("href");
    if (!entry) throw new Error("no project to open");
    await page.goto(`${BASE}${entry}`, { waitUntil: "networkidle", timeout: 90000 });

    const dirtyBefore = await page.getByText("You have unsaved changes").count();
    check("the entry opens with nothing unsaved", dirtyBefore === 0);
    await page.locator("#category").click();
    const add = page.getByRole("option", { name: "Add a choice…" });
    check("a project's Category offers “Add a choice…”", (await add.count()) === 1);
    await add.click();
    check("…which asks for the new choice", (await page.getByRole("dialog").getByText(/^Add a choice to/).count()) === 1);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    check("…and Cancel leaves the entry unsaved-free", (await page.getByText("You have unsaved changes").count()) === 0);

    const refused = await page.evaluate(async () => {
      const response = await fetch("/api/admin/metaobjects/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "choiceAdd", type: "inquiry", key: "status", choice: "Check" }),
      });
      return response.status;
    });
    check("a field no module opens (an inquiry's status) is refused", refused === 403, refused);

    check("no errors in the browser", errors.length === 0, errors.join(" | "));
    check("no choice was added", !added);
  } finally {
    await browser.close();
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll choice checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
