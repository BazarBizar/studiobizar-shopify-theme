/**
 * The Theme Builder (Website → Header & footer) in a real browser, the way an editor
 * uses it.
 *
 *   yarn dev                      # in another terminal
 *   yarn check:theme-builder-ui
 *
 * WRITES THE DRAFT ONLY, never Publish: what visitors see does not change. It edits
 * the draft header and footer, checks the preview draws each change, and ends with
 * "Discard unpublished changes", which puts the draft back to what is live (or to the
 * original header and footer, before any publish).
 *
 * Signs in like `check-page-builder-ui.ts`: a staff session minted with the project's
 * own AUTH_SECRET, localhost only.
 */

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium, type Page } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";

const ROOT = resolve(__dirname, "..");
const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const SHOTS = join(tmpdir(), "theme-builder-ui");

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
    console.error(`✗ ${BASE} is not a local server. This check only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }
  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

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
  const page: Page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ws://127.0.0.1")) {
      errors.push(message.text());
      // DEBUG_ERRORS=1 prints each one in full, with the page it came from.
      if (process.env.DEBUG_ERRORS) console.log("CONSOLE ERROR at", message.location().url, "\n", message.text().slice(0, 3000));
    }
  });
  // `caret: "initial"`: by default Playwright hides the text caret by writing a style onto
  // inputs, which a page still hydrating reports as a server/client mismatch.
  const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), caret: "initial" });
  const aside = page.locator("aside");
  const preview = page.frameLocator("iframe[title^='Preview']");
  const saved = async () => {
    await page.getByText("Draft saved").waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500); // the preview re-renders from the saved draft
  };

  try {
    await page.goto(`${BASE}/admin/theme-builder`, { waitUntil: "networkidle", timeout: 90000 });
    check("Header & footer opens on the Header tab", (await page.getByRole("tab", { name: "Header", selected: true }).count()) === 1);
    check("Before a publish it says visitors still see the original", (await page.getByText("Visitors still see the original header").count()) === 1);

    // An announcement bar.
    await aside.getByText("Announcement bar").click();
    await aside.getByLabel("Show a bar above the header").click();
    await aside.getByLabel("Text").first().fill("UI test announcement");
    // A button in the centre of the desktop header.
    await aside.getByRole("button", { name: "Add element" }).nth(1).click();
    await page.getByRole("menuitem", { name: /^Button/ }).click();
    check("Adding an element opens its settings", (await aside.getByRole("heading", { name: "Button", level: 2 }).count()) === 1);
    await aside.getByPlaceholder(/Button text/).fill("ui test button");
    await aside.getByRole("combobox").filter({ hasText: "Choose where it goes" }).first().click();
    await page.getByPlaceholder("Search pages and collections").fill("contact");
    await page.getByRole("option").first().click();
    await aside.getByRole("button", { name: "Back" }).click();
    await saved();
    await shot("01-desktop");

    check("The preview draws the announcement bar", (await preview.getByText("UI test announcement").count()) === 1);
    // Between the left and right zones, and no menu wrapped to make room. (Exactly
    // centred only when the sides leave room for it — a wide left side pushes it over.)
    const placed = await preview
      .locator("#site-header")
      .evaluate((header) => {
        const button = [...header.querySelectorAll("a")].find((link) => link.textContent?.trim().toLowerCase() === "ui test button");
        const menu = header.querySelector("nav ul");
        if (!button || !menu) return { between: false, oneLine: false };
        const box = button.getBoundingClientRect();
        const menuBox = menu.getBoundingClientRect();
        const items = [...menu.querySelectorAll(":scope > li")].map((item) => item.getBoundingClientRect().top);
        return { between: box.left > menuBox.right, oneLine: new Set(items.map(Math.round)).size === 1 };
      })
      .catch(() => ({ between: false, oneLine: false }));
    check("The button sits in the centre zone, and the main menu stays on one line", placed.between && placed.oneLine, JSON.stringify(placed));

    // Drag and drop: Search from the right zone into the left one.
    const handle = aside.getByRole("button", { name: "Drag Search" }).first();
    const leftZone = aside.locator("div.rounded-md.border").filter({ has: page.getByText("Left", { exact: true }) }).first();
    const from = (await handle.boundingBox())!;
    const to = (await leftZone.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y - 10, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
    await saved();
    const searchSide = await preview.locator("#site-header").evaluate((header) => {
      const search = header.querySelector("button[aria-label='Search']");
      return search ? search.getBoundingClientRect().left < window.innerWidth / 2 : null;
    });
    check("Drag and drop: Search dragged into the left zone shows on the left", searchSide === true, searchSide);

    // Phones & tablets have their own arrangement: the button is not in it.
    await aside.getByRole("radio", { name: "Phones & tablets" }).click();
    await page.waitForTimeout(1500);
    await shot("02-mobile");
    const onPhone = await preview.locator("#site-header").getByRole("link", { name: "ui test button" }).isVisible().catch(() => false);
    check("On phones the desktop button is not shown (its own arrangement)", !onPhone);
    await aside.getByRole("radio", { name: "Desktop" }).click();

    // Style: a background colour for the header.
    await aside.getByText("Look", { exact: true }).click();
    await aside.locator("#hdr-bg").fill("#47515c");
    await saved();
    const background = await preview.locator("#site-header").evaluate((header) => getComputedStyle(header).backgroundColor);
    check("The header takes the chosen background", background === "rgb(71, 81, 92)", background);

    // Over the top of the page, and smaller once scrolled.
    await aside.getByLabel("Over the top of the page").click();
    await aside.getByLabel("Get smaller while scrolling").click();
    await saved();
    const atTop = await preview.locator("#site-header").evaluate((header) => ({
      background: getComputedStyle(header).backgroundColor,
      // The page starts where the header starts (under the announcement bar), not below it.
      pageUnder: Math.abs(document.querySelector("main")!.getBoundingClientRect().top - header.getBoundingClientRect().top) <= 1,
      height: header.getBoundingClientRect().height,
    }));
    await preview.locator("body").evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(600);
    const scrolled = await preview.locator("#site-header").evaluate((header) => ({
      background: getComputedStyle(header).backgroundColor,
      height: header.getBoundingClientRect().height,
    }));
    await shot("01b-over-the-page");
    check(
      "Over the page: see-through at the top with the page under it; solid and smaller once scrolled",
      atTop.background === "rgba(0, 0, 0, 0)" && atTop.pageUnder && scrolled.background === "rgb(71, 81, 92)" && scrolled.height < atTop.height,
      JSON.stringify({ atTop, scrolled }),
    );
    await preview.locator("body").evaluate(() => window.scrollTo(0, 0));

    // Footer: a line of text in the first column. (The original has five columns, the most
    // a footer may have — the panel says so instead of offering "Add column".)
    await page.getByRole("tab", { name: "Footer" }).click();
    check("A full footer explains why no column can be added", (await aside.getByText(/at most 5 columns/).count()) === 1);
    await aside.getByRole("button", { name: "Add element" }).first().click();
    await page.getByRole("menuitem", { name: /^Text/ }).click();
    await aside.getByLabel("Text").last().fill("UI footer text");
    await aside.getByRole("button", { name: "Back" }).click();
    await saved();
    await shot("03-footer");
    check("The preview draws the footer's new text", (await preview.locator("#site-footer").getByText("UI footer text").count()) === 1);

    // Undo takes the last change back.
    await page.getByRole("button", { name: "Undo" }).click();
    await saved();
    check("Undo removes the footer text again", (await preview.locator("#site-footer").getByText("UI footer text").count()) === 0);

    // Site style: a heading font for the whole site, and a saved colour every picker offers.
    await page.getByRole("tab", { name: "Site style" }).click();
    await aside.getByRole("combobox").filter({ hasText: "Default (Helvetica Neue)" }).first().click();
    await page.getByRole("option", { name: /Fraunces/ }).click();
    await aside.getByRole("button", { name: "Add a colour" }).click();
    await aside.getByLabel("Colour name").fill("UI accent");
    await saved();
    const pageHeading = await preview
      .locator("main :is(h1, h2)")
      .first()
      .evaluate((heading) => getComputedStyle(heading).fontFamily)
      .catch(() => "");
    check("Site style: the page's headings take the site font", /Fraunces/.test(pageHeading), pageHeading);
    await page.getByRole("tab", { name: "Header" }).click();
    await aside.getByText("Look", { exact: true }).click();
    check("Site style: the saved colour is offered in the header's colour pickers", (await aside.getByRole("button", { name: "UI accent" }).count()) > 0);
  } finally {
    // Back to what is live — the draft only ever changed.
    try {
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: "Discard unpublished changes" }).click();
      await page.getByRole("button", { name: "Discard changes" }).click();
      await page.getByText("Changes discarded").first().waitFor({ timeout: 20000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      check(
        "Discard puts the draft back (no announcement in the preview)",
        (await preview.getByText("UI test announcement").count()) === 0,
      );
    } catch (error) {
      check("Discard puts the draft back", false, (error as Error).message.split("\n")[0]);
    }
    await shot("04-discarded");
    check(`No console errors from the app (${errors.length})`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await browser.close();
  }

  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(failures ? `${failures} check(s) failed.` : "All Theme Builder UI checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
