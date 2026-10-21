/**
 * The page builder in a real browser, the way an editor uses it.
 *
 *   yarn dev                      # in another terminal
 *   yarn check:page-builder-ui
 *
 * WRITES TO THE STORE, and cleans up after itself: it creates ONE hidden page
 * through the UI (`pb-ui-test-<time>`), publishes it, and deletes it through the
 * Settings tab. If a step fails before the delete, the page is removed in
 * `finally` through the admin library instead.
 *
 * Covers what `check:page-builder-live` cannot: the editor's own behaviour —
 * autosave, undo, the preview, edits made just before switching tabs, Back from
 * Settings, and console errors.
 *
 * Signs in by minting a staff session with the project's own AUTH_SECRET, for the
 * first address on ADMIN_ALLOWED_EMAILS — the same cookie a real sign-in sets.
 * It refuses any server but localhost: this is a development check, never a way
 * into a deployed admin. Screenshots of each step, and of any failure, go to the
 * system temp folder; the path is printed at the end.
 *
 * First run on a machine: `npx playwright install chromium`.
 */

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { encode } from "next-auth/jwt";
import { chromium, type Page } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";

const ROOT = resolve(__dirname, "..");
const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const SHOTS = join(tmpdir(), "page-builder-ui");

for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("=")).trim();
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (/^".*"$/.test(value)) value = value.slice(1, -1);
  process.env[key] ??= value;
}
{
  // `lib/admin/shopify.ts` imports `unstable_rethrow`, which only loads inside Next.
  const require = createRequire(resolve(ROOT, "package.json"));
  const resolved = require.resolve("next/navigation");
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { unstable_rethrow: () => {} } } as never;
}

const load = (path: string) => import(pathToFileURL(resolve(ROOT, path)).href);

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 240)}` : ""}`);
  if (!ok) failures += 1;
}

async function staffSession() {
  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");
  // The cookie name is also Auth.js's salt for the token inside it.
  return encode({ token: { email, sub: email }, secret, salt: STAFF_COOKIE, maxAge: 60 * 60 });
}

async function main() {
  const { hostname } = new URL(BASE);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(`✗ ${BASE} is not a local server. This check only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }
  const reachable = await fetch(BASE).then(() => true).catch(() => false);
  if (!reachable) {
    console.error(`✗ No dev server at ${BASE}. Start one with \`yarn dev\` (or set CHECK_BASE_URL).`);
    process.exit(1);
  }
  rmSync(SHOTS, { recursive: true, force: true }); // no screenshot left over from an earlier run
  mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch().catch((error: Error) => {
    console.error(`✗ Chromium did not start. On a first run: npx playwright install chromium\n  ${error.message.split("\n")[0]}`);
    process.exit(1);
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: STAFF_COOKIE, value: await staffSession(), domain: hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

  async function step(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      check(label, false, (error as Error).message.split("\n")[0]);
      await shot(`fail-${label.replace(/[^a-z0-9]+/gi, "-")}`).catch(() => undefined);
    }
  }

  const title = `PB UI test ${Date.now().toString(36)}`;
  const aside = page.locator("aside");
  const headingInput = () => aside.getByLabel(/^Heading/).first();

  try {
    /* ---------------- Pages list ---------------- */
    await step("Pages list", async () => {
      await page.goto(`${BASE}/admin/pages`);
      await page.getByRole("heading", { name: "Pages", level: 1 }).waitFor();
      await shot("01-pages-list");
      check(
        "Pages list: New page button and one Status column",
        (await page.getByRole("link", { name: "New page" }).count()) === 1 &&
          (await page.getByRole("columnheader", { name: "Status" }).count()) === 1,
      );
      const sidebar = page.locator("[data-sidebar='sidebar']");
      check(
        "Sidebar: Website group with Pages, Menus, Media",
        (await sidebar.getByText("Website", { exact: true }).count()) > 0 &&
          (await sidebar.getByRole("link", { name: "Menus" }).count()) > 0 &&
          (await sidebar.getByRole("link", { name: "Media" }).count()) > 0,
      );
    });

    /* ---------------- New page ---------------- */
    await step("New page", async () => {
      await page.getByRole("link", { name: "New page" }).click();
      await page.waitForURL(/\/admin\/pages\/new$/);
      await page.locator("#new-page-title").fill(title);
      const handle = await page.locator("#new-page-handle").inputValue();
      check("New page: the address follows the title", handle.startsWith("pb-ui-test-"), handle);
      await page.getByRole("radio", { name: /Blank/ }).click();
      await shot("02-new-page");
      await page.getByRole("button", { name: "Create and open builder" }).click();
      await page.waitForURL(/\/admin\/pages\/\d+\/content$/, { timeout: 30000 });
      check("New page: lands on the page's Content tab", true);
    });

    /* ---------------- Builder ---------------- */
    await step("Builder", async () => {
      await page.getByRole("tab", { name: "Content" }).waitFor();
      await page.waitForTimeout(1500);
      await shot("03-builder");
      check("Builder: Content and Settings tabs", (await page.getByRole("tab", { name: "Settings" }).count()) === 1);
      check(
        "Builder: a new page's status says Hidden",
        (await page.getByText("Hidden", { exact: true }).count()) > 0,
      );

      await page.getByRole("button", { name: "Add section" }).click();
      const textOption = page.locator("[cmdk-item]").filter({ hasText: "the usual text band" });
      check("Add section: offers 'Text'", (await textOption.count()) === 1);
      check(
        "Add section: one Contact form entry (the retired one is not offered)",
        (await page.locator("[cmdk-item]").filter({ hasText: /^Contact form/ }).count()) === 1,
      );
      await textOption.click();

      await headingInput().fill("UI heading one");
      check(
        "Section form: Advanced is folded away",
        (await aside.locator("details:not([open])").filter({ hasText: "Advanced" }).count()) === 1,
      );
      check("Section form: 'Show on' replaces 'Visibility'", (await aside.getByText("Show on", { exact: true }).count()) === 1);
      await page.getByText("Draft saved").waitFor({ timeout: 15000 });
      await page.frameLocator("iframe[title^='Preview']").getByText("UI heading one").waitFor({ timeout: 20000 });
      check("Autosave + preview: the typed heading appears in the preview", true);
      await shot("04-section-editor");

      await page.getByRole("button", { name: "Undo" }).click();
      check("Undo: takes the whole typed heading back", (await headingInput().inputValue()) === "");
      await page.getByRole("button", { name: "Redo" }).click();
      check("Redo: puts it back", (await headingInput().inputValue()) === "UI heading one");

      // Add section shows a picture of the preset under the pointer, and a preset arrives filled in.
      await aside.getByRole("button", { name: "Back to sections" }).click();
      await page.getByRole("button", { name: "Add section" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("[cmdk-item]").filter({ hasText: "Icon features" }).hover();
      check(
        "Add section: hovering a preset shows its name beside its picture",
        (await dialog.getByRole("heading", { name: "Icon features", level: 3 }).count()) === 1,
      );
      await dialog.getByPlaceholder(/Search sections/).fill("quote");
      check(
        "Add section: search finds presets by what they are for",
        (await dialog.locator("[cmdk-item]").filter({ hasText: "Large quote" }).count()) === 1,
      );
      await dialog.getByPlaceholder(/Search sections/).fill("");
      await dialog.locator("[cmdk-item]").filter({ hasText: "Icon features" }).hover();
      await dialog.getByRole("button", { name: "Add", exact: true }).click();
      await page.frameLocator("iframe[title^='Preview']").getByText("White-glove delivery").waitFor({ timeout: 20000 });
      check("Adding a preset draws it with its demo content", true);
      await shot("04b-preset-added");

      // The Style tab: colour, custom spacing and a line on the Text section, and
      // the preview must draw exactly those values.
      await aside.getByRole("button", { name: "Back to sections" }).click();
      await aside.getByRole("button", { name: /UI heading one/ }).first().click();
      await aside.getByRole("tab", { name: "Style" }).click();
      check(
        "Style tab: Background & text, Spacing, and Line & corners",
        (await aside.getByText("Background & text", { exact: true }).count()) === 1 &&
          (await aside.getByText("Spacing", { exact: true }).count()) === 1 &&
          (await aside.getByText("Line & corners", { exact: true }).count()) === 1,
      );
      await aside.getByRole("button", { name: "Dark wood" }).first().click();
      await aside.getByLabel("Custom spacing").click();
      await aside.getByRole("spinbutton", { name: "Space inside, top (px)" }).fill("10");
      await aside.getByRole("combobox", { name: "Line" }).click();
      await page.getByRole("option", { name: "Box around" }).click();
      await aside.getByRole("spinbutton", { name: "Line thickness (px)" }).fill("3");
      await shot("04c-style-tab");
      const preview = page.frameLocator("iframe[title^='Preview']");
      const frame = preview.locator("[data-sb-pad]").first();
      await frame.waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      const drawn = await frame.evaluate((element) => {
        const band = element.querySelector(".py-section") ?? element;
        const own = getComputedStyle(element);
        return {
          background: own.backgroundColor,
          text: own.color,
          border: own.borderTopWidth,
          paddingTop: getComputedStyle(band).paddingTop,
        };
      });
      check(
        "Style tab: the preview draws the colour, a readable text colour, the 10px space and the 3px line",
        drawn.background === "rgb(48, 47, 45)" &&
          drawn.text === "rgb(235, 232, 227)" &&
          drawn.border === "3px" &&
          drawn.paddingTop === "10px",
        JSON.stringify(drawn),
      );
      await aside.getByRole("tab", { name: "Content" }).click();

      // Back to the Text section, then type and leave AT ONCE for Settings —
      // inside the autosave pause. The edit must survive.
      await headingInput().fill("UI heading two");
      await page.getByRole("tab", { name: "Settings" }).click();
      await page.waitForURL(/\/admin\/pages\/\d+$/, { timeout: 20000 });
      await page.getByText("Show to visitors").waitFor({ timeout: 20000 });
      await shot("05-settings");
      check(
        "Settings: 'Visible on the site', search listing and Delete; no Body",
        (await page.getByText("Search engine listing").count()) === 1 &&
          (await page.getByRole("button", { name: "Delete page" }).count()) === 1 &&
          (await page.getByText("Body", { exact: true }).count()) === 0,
      );
      check(
        "Settings: no page metafields card (the builder route never reads them)",
        (await page.getByText("Everything the storefront renders around the body").count()) === 0,
      );

      // Back restores the editor from the router cache; it must notice the newer draft.
      await page.goBack();
      await page.waitForURL(/\/content$/, { timeout: 20000 });
      check("Back from Settings returns to the Content tab", true);
      await page.waitForTimeout(3000);
      await aside.getByRole("button", { name: /UI heading/ }).first().click({ timeout: 15000 });
      const heading = await headingInput().inputValue();
      check("The edit made just before switching tabs was saved", heading === "UI heading two", heading);
      check("No false 'edited elsewhere' after Back", (await page.getByText("Edited elsewhere").count()) === 0);
      await shot("06-back-to-content");
    });

    /* ---------------- Publish ---------------- */
    await step("Publish", async () => {
      await page.getByRole("button", { name: "Publish" }).click({ timeout: 15000 });
      await page.getByText("Published", { exact: true }).first().waitFor({ timeout: 30000 });
      await shot("07-published");
      check("Publish: a first publish makes the page Live", (await page.getByText("Live", { exact: true }).count()) > 0);
      check("Publish: reminds to add the page to Menus", (await page.getByRole("button", { name: "Menus" }).count()) > 0);
    });

    /* ---------------- Delete from Settings ---------------- */
    await step("Delete", async () => {
      await page.getByRole("tab", { name: "Settings" }).click();
      await page.waitForURL(/\/admin\/pages\/\d+$/);
      await page.getByText("Show to visitors").waitFor({ timeout: 20000 });
      await page.getByRole("button", { name: "Delete page" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete page" }).click();
      await page.waitForURL(/\/admin\/pages$/, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.reload();
      check("Delete: back on Pages, the test page is gone", (await page.getByText(title).count()) === 0);
      await shot("08-after-delete");
    });

    // The dev server's own websocket is refused by the admin CSP — in development only.
    const relevant = [
      ...new Set(
        consoleErrors
          .filter((error) => !/ws:\/\/(127\.0\.0\.1|localhost)/.test(error) && !/favicon/.test(error))
          .map((error) => error.slice(0, 200)),
      ),
    ];
    check(`No console errors from the app (${relevant.length})`, relevant.length === 0, relevant.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
    // A failed step can leave the test page behind; remove it the direct way.
    const { listPages } = await load("lib/admin/pages.ts");
    const left = (await listPages()).filter((p: { handle: string }) => p.handle.startsWith("pb-ui-test-"));
    if (left.length) {
      const { deleteBuilderPage } = await load("lib/admin/page-builder.ts");
      for (const leftover of left) await deleteBuilderPage(leftover.id).catch(() => undefined);
      console.log(`  (removed ${left.length} leftover test page${left.length === 1 ? "" : "s"})`);
    }
  }

  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(failures ? `${failures} check(s) failed.` : "All page builder UI checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
