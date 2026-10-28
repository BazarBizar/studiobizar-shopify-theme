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
  // `caret: "initial"`: by default Playwright hides the text caret by writing a style onto
  // inputs, which a page still hydrating reports as a server/client mismatch.
  const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), caret: "initial" });

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
      const textOption = page.locator("[cmdk-item]").filter({ hasText: "the usual text section" });
      check("Add section: offers 'Text'", (await textOption.count()) === 1);
      check(
        "Add section: one Contact form entry (the retired one is not offered)",
        (await page.locator("[cmdk-item]").filter({ hasText: /^Contact form/ }).count()) === 1,
      );
      await textOption.click();

      // A new section arrives FILLED — example heading, text and button — and shows in
      // the preview straight away, before anything is saved.
      check("Add section: the new section holds example content", (await headingInput().inputValue()) === "Your heading here");
      await page.frameLocator("iframe[title^='Preview']").getByText("Your heading here").first().waitFor({ timeout: 15000 });
      check("Add section: the preview shows the new section at once", true);

      // Live preview: the typed heading reaches the preview without waiting for the save.
      const typedAt = Date.now();
      await headingInput().fill("UI heading one");
      await page.frameLocator("iframe[title^='Preview']").getByText("UI heading one").waitFor({ timeout: 15000 });
      const lag = Date.now() - typedAt;
      check(`Live preview: the typed heading is drawn in ${lag}ms`, lag < 2500, lag);
      check(
        "Section form: Advanced is folded away",
        (await aside.locator("details:not([open])").filter({ hasText: "Advanced" }).count()) === 1,
      );
      // One "Show on", not two: the per-device switches under Style → More design.
      check("Section form: no second 'Show on' on the Content tab", (await aside.getByText("Show on", { exact: true }).count()) === 0);
      await page.getByText("Draft saved").waitFor({ timeout: 15000 });
      await page.frameLocator("iframe[title^='Preview']").getByText("UI heading one").waitFor({ timeout: 20000 });
      check("Autosave + preview: the typed heading appears in the preview", true);
      await shot("04-section-editor");

      await page.getByRole("button", { name: "Undo" }).click();
      check("Undo: takes the whole typed heading back", (await headingInput().inputValue()) === "Your heading here");
      await page.getByRole("button", { name: "Redo" }).click();
      check("Redo: puts it back", (await headingInput().inputValue()) === "UI heading one");

      // Editing in place: double-click the heading in the preview, type, Enter — the
      // setting changes, as if typed in the form.
      await page
        .frameLocator("iframe[title^='Preview']")
        .getByRole("heading", { name: "UI heading one" })
        .first()
        .dblclick();
      await page.waitForTimeout(300);
      await page.keyboard.type("Edited in place");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      check("In-place edit: typing over the heading in the preview changes the setting", (await headingInput().inputValue()) === "Edited in place");
      await page.frameLocator("iframe[title^='Preview']").getByText("Edited in place").first().waitFor({ timeout: 10000 });
      await headingInput().fill("UI heading one");

      // The button's destination: the shared link picker (as in Menus). Picking a page
      // names an empty button after it, and the preview draws the link. (Emptied first:
      // it arrived with the example "learn more" → Shop.)
      await aside.getByPlaceholder(/Button text/).fill("");
      await aside.getByRole("combobox").filter({ hasText: "Shop" }).first().click();
      await page.getByPlaceholder("Search pages and collections").fill("contact");
      await page.getByRole("option").first().click();
      const buttonText = await aside.getByPlaceholder(/Button text/).inputValue();
      const previewLink = page.frameLocator("iframe[title^='Preview']").getByRole("link", { name: buttonText, exact: false }).first();
      await previewLink.waitFor({ timeout: 20000 });
      check(
        "Link picker: choosing a page fills the button and the preview links to it",
        buttonText === "contact" && /\/contact$/.test((await previewLink.getAttribute("href")) ?? ""),
        `${buttonText} → ${await previewLink.getAttribute("href")}`,
      );

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
      check("Style tab: 'Show on devices' is there, once", (await aside.getByText("Show on devices").count()) === 1);
      const group = (title: string) => aside.locator("summary").filter({ hasText: new RegExp(`^${title}`) });
      check(
        "Style tab: one list — Background, Spacing, Border & shadow, then the design",
        (await group("Background").count()) === 1 &&
          (await group("Spacing").count()) === 1 &&
          (await group("Border & shadow").count()) === 1 &&
          (await group("Typography").count()) === 1,
      );
      check("Style tab: no Vertical spacing any more", (await aside.getByText("Vertical spacing").count()) === 0);
      await group("Background").click();
      await aside.getByRole("button", { name: "Dark wood" }).first().click();
      // Instant: the colour is on the section within a quarter second — set on its frame
      // directly, before the server has redrawn anything.
      await page.waitForTimeout(250);
      const instant = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="text_block"]')
        .first()
        .evaluate((frame) => getComputedStyle(frame).backgroundColor);
      check("Style: a colour shows in the preview at once", instant === "rgb(48, 47, 45)", instant);
      // An overlay over the colour: drawn as a layer on the section.
      await aside.locator("#design-overlay").fill("#000000");
      await page.waitForTimeout(400);
      const overlaid = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="text_block"]')
        .first()
        .evaluate((frame) => getComputedStyle(frame).backgroundImage);
      check("Style: an overlay over a plain colour reaches the preview", overlaid.startsWith("linear-gradient"), overlaid);
      await aside.locator("#design-overlay").fill("");

      // Setting the spacing yourself starts from what the section has now.
      const before = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="text_block"] .py-section, [data-section-type="text_block"] .pt-section')
        .first()
        .evaluate((band) => Math.round(parseFloat(getComputedStyle(band).paddingTop)));
      await group("Spacing").click();
      await aside.getByLabel("Set the spacing yourself").click();
      const startsAt = await aside.getByRole("spinbutton", { name: "Padding top (px)" }).inputValue();
      check("Spacing: turning it on starts from the section's current space", startsAt === String(before), `${startsAt} vs ${before}`);
      await aside.getByRole("spinbutton", { name: "Padding top (px)" }).fill("10");
      check(
        "Spacing: left and right are there, empty showing the design's own gutter",
        (await aside.getByRole("spinbutton", { name: "Padding left (px)" }).inputValue()) === "" &&
          Number(await aside.getByRole("spinbutton", { name: "Padding left (px)" }).getAttribute("placeholder")) > 0,
      );
      await aside.getByRole("spinbutton", { name: "Padding left (px)" }).fill("40");
      await aside.getByRole("spinbutton", { name: "Margin left (px)" }).fill("24");
      await page.waitForTimeout(400);
      const sides = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="text_block"]')
        .first()
        .evaluate((frame) => ({
          inside: getComputedStyle(frame.querySelector(".sb-container") ?? frame).paddingLeft,
          outside: getComputedStyle(frame).marginLeft,
        }));
      check("Spacing: the preview draws 40px inside and 24px outside on the left", sides.inside === "40px" && sides.outside === "24px", JSON.stringify(sides));
      await group("Border & shadow").click();
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

      // The design panel: typography per device. A heading size for desktop and a
      // smaller one for tablet, a font — and the preview, at each device's width,
      // must draw exactly those.
      await aside.getByText("Typography", { exact: true }).click();
      await aside.getByRole("combobox").filter({ hasText: "Default (Helvetica Neue)" }).first().click();
      await page.getByRole("option", { name: /Playfair Display/ }).click();
      await aside.getByLabel("Size (px)").fill("40");
      await aside.getByRole("button", { name: "Tablet view" }).first().click();
      check(
        "Design: on tablet the size says it follows desktop",
        (await aside.getByText("Same as desktop until changed here.").count()) > 0,
      );
      await aside.getByLabel("Size (px)").fill("30");
      await page.getByText("Draft saved").waitFor({ timeout: 15000 });
      await page.waitForTimeout(2500);
      await shot("04d-design-tablet");
      const headingAt = async () =>
        preview.locator("[data-sb-hsize] h2").first().evaluate((element) => {
          const style = getComputedStyle(element);
          return { size: style.fontSize, font: style.fontFamily };
        });
      const tablet = await headingAt();
      await aside.getByRole("button", { name: "Desktop view" }).first().click();
      await page.waitForTimeout(1200);
      const desktop = await headingAt();
      check(
        "Design: the preview draws 40px on desktop and 30px on tablet, in the chosen font",
        desktop.size === "40px" && tablet.size === "30px" && /Playfair/.test(desktop.font),
        JSON.stringify({ desktop, tablet }),
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

      // A section joined to the Page heading: its Style tab explains, and both ways
      // out are buttons — never only the name of a setting to go and find.
      await aside.getByRole("button", { name: "Back to sections" }).click();
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "Questions that open to their answer" }).first().click();
      // Added last; up under the Page heading, past the Text and the preset.
      await aside.getByRole("button", { name: "Back to sections" }).click();
      for (let step = 0; step < 2; step++) {
        await aside.getByRole("button", { name: "More actions for Questions & answers" }).click();
        await page.getByRole("menuitem", { name: "Move up" }).click();
        await page.getByRole("menu").waitFor({ state: "hidden" });
      }
      await aside.getByRole("button", { name: /^Questions & answers/ }).first().click();
      await aside.getByRole("radio", { name: "Joined to the Page heading above" }).click();
      await aside.getByRole("tab", { name: "Style" }).click();
      const ownLook = aside.getByRole("button", { name: "Style this section on its own" });
      const headingLook = aside.getByRole("button", { name: "Change the look on the Page heading" });
      await shot("06b-joined-style-tab");
      check(
        "Joined section: Style tab explains and offers both ways out",
        (await aside.getByText(/joined to the Page heading/).count()) > 0 &&
          (await ownLook.count()) === 1 &&
          (await headingLook.count()) === 1,
      );
      await ownLook.click();
      check(
        "Joined section: 'Style this section on its own' brings its style controls back",
        (await aside.locator("summary").filter({ hasText: /^Background/ }).count()) === 1,
      );
      await aside.getByRole("tab", { name: "Content" }).click();
      await aside.getByRole("radio", { name: "Joined to the Page heading above" }).click();
      await aside.getByRole("tab", { name: "Style" }).click();
      await headingLook.click();
      check(
        "Joined section: the other button opens the Page heading on its Style tab",
        (await aside.getByRole("heading", { name: "Page heading", level: 2 }).count()) === 1 &&
          (await aside.getByRole("tab", { name: "Style", selected: true }).count()) === 1,
      );
      // Out again, so the publish below is not held up by an empty FAQ section.
      await aside.getByRole("button", { name: "Back to sections" }).click();
      await aside.getByRole("button", { name: /^Questions & answers/ }).first().click();
      await aside.getByRole("button", { name: "Delete section" }).click();

      // The Hero slider: a slide designed on its own — its heading size, and a
      // different place for its copy on phones. Then removed again: slides without
      // photographs cannot be published.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "each one designed on its own" }).first().click();
      await aside.getByRole("button", { name: /^Slide/ }).first().click();
      await aside.getByLabel(/^Heading/).first().fill("Slide one");
      await aside.getByText("Position & style").first().click();
      await aside.getByRole("combobox", { name: "Text position on phones" }).click();
      await page.getByRole("option", { name: "Top centre" }).click();
      await aside.getByText("Typography", { exact: true }).first().click();
      await aside.getByLabel("Size (px)").first().fill("52");
      await page.getByText("Draft saved").waitFor({ timeout: 15000 });
      await page.waitForTimeout(2500);
      await shot("06c-hero-slide");
      const copyOf = () =>
        preview
          .locator('[data-section-type="slideshow"] [aria-roledescription="slide"]')
          .first()
          .evaluate((slide) => {
            const copy = slide.querySelector("[data-surface]")!;
            const style = getComputedStyle(copy);
            return {
              size: getComputedStyle(slide.querySelector("h2")!).fontSize,
              justify: style.justifyContent,
              items: style.alignItems,
            };
          });
      const onDesktop = await copyOf();
      // The device switch above the preview — on the Content tab it is the only one.
      await page.getByRole("button", { name: "Mobile view" }).first().click();
      await page.waitForTimeout(1500);
      const onPhone = await copyOf();
      await page.getByRole("button", { name: "Desktop view" }).first().click();
      check(
        "Hero slider: the slide's own heading size, bottom-left on desktop and top-centre on phones",
        onDesktop.size === "52px" &&
          onDesktop.justify === "flex-end" &&
          onDesktop.items === "flex-start" &&
          onPhone.justify === "flex-start" &&
          onPhone.items === "center",
        JSON.stringify({ onDesktop, onPhone }),
      );
      await aside.getByRole("button", { name: "Delete section" }).click();

      // Three photographs: photos and captions, no heading or button — so Typography
      // offers Text only, and its size reaches the captions.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "A row of up to three captioned photographs" }).first().click();
      await aside.getByRole("tab", { name: "Style" }).click();
      await aside.getByText("Typography", { exact: true }).click();
      await page.waitForTimeout(2500);
      // Only text (its captions): no Headings or Buttons, and no "Style for" switch with one choice.
      check(
        "Three photographs: Typography offers only what it has — text, with no one-choice switch",
        (await aside.getByRole("radiogroup", { name: "Style for" }).count()) === 0 && (await aside.getByLabel("Size (px)").count()) > 0,
      );
      await aside.getByLabel("Size (px)").first().fill("21");
      await page.waitForTimeout(1500);
      const captionSize = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="captioned_row"] figcaption')
        .first()
        .evaluate((caption) => getComputedStyle(caption).fontSize)
        .catch(() => null);
      check("Three photographs: the text size reaches the captions", captionSize === "21px", captionSize);
      check(
        "Three photographs: no Buttons part, as it has no buttons",
        (await aside.locator("summary").filter({ hasText: /^Buttons$/ }).count()) === 0 && (await aside.locator("summary").filter({ hasText: /^Typography/ }).count()) === 1,
      );
      // "Rounded corners" on a section with no background showed nothing; the photos'
      // own corners sit right beside it, under Border & shadow.
      await aside.locator("summary").filter({ hasText: /^Border & shadow/ }).click();
      check(
        "Three photographs: corners are offered for the section and the photos",
        (await aside.getByRole("spinbutton", { name: "Section corners (px)" }).count()) === 1 && (await aside.getByRole("spinbutton", { name: "Photo corners (px)" }).count()) === 1,
      );
      await aside.getByRole("spinbutton", { name: "Photo corners (px)" }).fill("16");
      await page.waitForTimeout(1500);
      const photoCorners = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="captioned_row"] img')
        .first()
        .evaluate((img) => [img, img.parentElement!].map((el) => getComputedStyle(el).borderRadius))
        .catch(() => null);
      check("Three photographs: Photo corners round the photographs", Boolean(photoCorners?.includes("16px")), JSON.stringify(photoCorners));
      await shot("06b-photo-corners");
      await aside.getByRole("tab", { name: "Content" }).click();
      await aside.getByRole("button", { name: "Delete section" }).click();

      // A banner: its photograph is its ground and its height is fixed — so Background holds
      // its own darkening (no photo or gradient that would sit unseen behind it), and Spacing
      // offers only the space around it.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "A large photograph with a centred heading" }).first().click();
      await aside.getByRole("tab", { name: "Style" }).click();
      await aside.locator("summary").filter({ hasText: /^Background/ }).click();
      await aside.locator("summary").filter({ hasText: /^Spacing/ }).click();
      await aside.getByLabel("Set the spacing yourself").click();
      check(
        "Banner: Background has its darkening, not a photo or gradient behind its photo",
        (await aside.getByText("Image darkening (%)").count()) === 1 &&
          (await aside.getByText("Gradient", { exact: true }).count()) === 0 &&
          (await aside.getByText("Photo", { exact: true }).count()) === 0,
      );
      check(
        "Banner: Spacing offers its sides and the space around it, not the height",
        (await aside.getByRole("spinbutton", { name: "Padding top (px)" }).isDisabled()) &&
          (await aside.getByRole("spinbutton", { name: "Padding left (px)" }).isEnabled()) &&
          (await aside.getByRole("spinbutton", { name: "Margin top (px)" }).isEnabled()),
      );
      await shot("06c-banner-style");
      await aside.getByRole("tab", { name: "Content" }).click();
      await aside.getByRole("button", { name: "Delete section" }).click();

      // A section with no text of its own: no Typography group at all, rather than an empty one.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "Empty space between two sections" }).first().click();
      await aside.getByRole("tab", { name: "Style" }).click();
      await page.waitForTimeout(2500);
      check(
        "Spacer: no Typography group, and no 'nothing to style' message",
        (await aside.locator("summary").filter({ hasText: /^Typography/ }).count()) === 0 &&
          (await aside.getByText(/nothing here to style/).count()) === 0,
      );
      await aside.getByRole("tab", { name: "Content" }).click();
      await aside.getByRole("button", { name: "Delete section" }).click();

      // The project carousel: two across, two per arrow press — set in the editor, drawn in the preview.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "A scrolling row of project cards" }).first().click();
      await aside.getByRole("combobox", { name: "Items across on desktop" }).click();
      await page.getByRole("option", { name: "2", exact: true }).click();
      await aside.getByRole("radio", { name: "2 items" }).click();
      await page.waitForTimeout(2500);
      const row = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="project_carousel"] [role="region"] > div')
        .first()
        .evaluate((track) => {
          const items = [...track.children] as HTMLElement[];
          const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
          return { cv: track.hasAttribute("data-cv"), across: (track.parentElement!.clientWidth + gap) / (items[0]!.getBoundingClientRect().width + gap) };
        })
        .catch(() => null);
      check("Project carousel: two across, as chosen", Boolean(row?.cv && Math.abs(row.across - 2) < 0.05), JSON.stringify(row));
      await shot("06d-project-carousel");
      await aside.getByRole("button", { name: "Delete section" }).click();

      // Call to action: its buttons take their own colour and corners.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "One centred message and its buttons" }).first().click();
      await aside.getByRole("tab", { name: "Style" }).click();
      await page.waitForTimeout(2000);
      await aside.locator("summary").filter({ hasText: /^Buttons$/ }).click();
      await aside.locator("#design-button-background").fill("#a65a3f");
      await aside.getByRole("spinbutton", { name: "Rounded corners" }).last().fill("20");
      await page.waitForTimeout(1500);
      const look = await page
        .frameLocator("iframe[title^='Preview']")
        .locator('[data-section-type="cta_banner"] [data-sb-button="solid"]')
        .first()
        .evaluate((button) => [getComputedStyle(button).backgroundColor, getComputedStyle(button).borderTopLeftRadius, getComputedStyle(button).color])
        .catch(() => null);
      check("Buttons: the colour and corners reach the button, with a readable label", JSON.stringify(look) === '["rgb(166, 90, 63)","20px","rgb(235, 232, 227)"]', JSON.stringify(look));
      await shot("06c-button-look");
      await aside.getByRole("tab", { name: "Content" }).click();
      await aside.getByRole("button", { name: "Delete section" }).click();

      // Custom section: blocks of the editor's own choosing, and columns made from Column blocks.
      const custom = page.frameLocator("iframe[title^='Preview']").locator('[data-section-type="custom_section"]');
      const picker = page.locator("[data-radix-popper-content-wrapper]");
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator("[cmdk-item]").filter({ hasText: "Starts with a heading, text and a button" }).first().click();
      await custom.getByText("Your heading here").first().waitFor({ timeout: 20000 });
      check("Custom section: arrives with a heading, text and a button", (await custom.locator(".sb-bk").count()) === 3);

      await aside.getByRole("button", { name: "Add block", exact: true }).click();
      await picker.getByPlaceholder(/Search/).fill("photo");
      await picker.getByRole("button", { name: /^Photo beside text/ }).click();
      await page.waitForTimeout(2500);
      const columns = await custom.locator(".sb-bk-col").evaluateAll((cols) => cols.map((col) => col.getBoundingClientRect().toJSON()));
      check(
        "Custom section: a ready-made layout puts two columns side by side",
        columns.length === 3 && Math.abs(columns[1]!.top - columns[2]!.top) < 2 && columns[2]!.left > columns[1]!.right - 1,
        JSON.stringify(columns.map((c) => [Math.round(c.left), Math.round(c.top)])),
      );
      check(
        "Custom section: the list shows the blocks under their column",
        (await aside.getByRole("button", { name: /^Column 1/ }).count()) === 1 && (await aside.getByRole("button", { name: /^Column 2/ }).count()) === 1,
      );

      // "+" on a column adds into that column, not at the end.
      await aside.getByRole("button", { name: "Add a block to Column 1" }).click();
      await picker.getByRole("button", { name: /^Quote/ }).click();
      await page.waitForTimeout(2500);
      check(
        "Custom section: + on Column 1 puts the new block in Column 1",
        (await custom.locator(".sb-bk-col").nth(1).locator("blockquote").count()) === 1 &&
          (await custom.locator(".sb-bk-col").nth(2).locator("blockquote").count()) === 0,
      );

      // Dragging a Column (here with the keyboard: Space lifts, an arrow moves, Space drops)
      // takes its blocks along, and lands before the column above — not inside it.
      await aside.getByRole("button", { name: "Drag Column 2 to reorder" }).focus();
      await page.keyboard.press("Space");
      await page.waitForTimeout(200);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(200);
      await page.keyboard.press("Space");
      await page.waitForTimeout(2500);
      check(
        "Custom section: dragging Column 2 up swaps the columns, each with its blocks",
        (await custom.locator(".sb-bk-col").nth(1).locator("blockquote").count()) === 0 &&
          (await custom.locator(".sb-bk-col").nth(2).locator("blockquote").count()) === 1 &&
          (await custom.locator(".sb-bk-col").nth(2).locator("img, [aria-hidden]").count()) > 0,
      );

      // A column's width on desktop.
      await aside.getByRole("button", { name: /^Column 1/ }).click();
      await aside.getByRole("radiogroup").first().getByRole("radio", { name: "33%" }).click();
      await page.waitForTimeout(2500);
      const share = await custom.locator(".sb-blocks").first().evaluate((row) => {
        const col = row.children[1] as HTMLElement;
        const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
        return (col.getBoundingClientRect().width + gap) / (row.getBoundingClientRect().width + gap);
      });
      check("Custom section: Column 1 set to 33% takes a third of the row", Math.abs(share - 1 / 3) < 0.02, share);
      await shot("06e-custom-section");

      // Deleting a column takes its blocks with it.
      await aside.getByRole("button", { name: "Delete Column 2" }).click();
      await page.waitForTimeout(2500);
      check("Custom section: deleting a column removes it and its blocks", (await custom.locator(".sb-bk-col").count()) === 2);
      await aside.getByRole("button", { name: "Delete section" }).click();

      // An existing section becomes a Custom section — its words kept — and Undo brings it back.
      await page.getByRole("button", { name: "Add section" }).click();
      await page.getByRole("dialog").locator("[cmdk-item]").filter({ hasText: "Icon features" }).click();
      const framed = page.frameLocator("iframe[title^='Preview']");
      await framed.locator('[data-section-type="multicolumn"]').getByText("White-glove delivery").first().waitFor({ timeout: 20000 });
      await aside.getByRole("button", { name: "Turn into Custom section" }).click();
      await custom.getByText("White-glove delivery").first().waitFor({ timeout: 20000 });
      check(
        "Turn into Custom section: the section is rebuilt as blocks, its text kept",
        (await custom.locator(".sb-bk-col").count()) >= 4 && (await aside.getByRole("button", { name: "Add block", exact: true }).count()) === 1,
      );
      await shot("06f-converted");
      await page.locator("[data-sonner-toast]").filter({ hasText: "Now a Custom section" }).getByRole("button", { name: "Undo" }).click();
      await framed.locator('[data-section-type="multicolumn"]').getByText("White-glove delivery").first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      await shot("06g-converted-undone");
      check("Turn into Custom section: Undo puts the original section back", (await custom.count()) === 0, await custom.count());
      await aside.getByRole("button", { name: "Delete section" }).click();
      check(
        "Turn into Custom section: not offered on a section that cannot become one",
        await (async () => {
          await page.getByRole("button", { name: "Add section" }).click();
          await page.getByRole("dialog").locator("[cmdk-item]").filter({ hasText: "Starts with a heading, text and a button" }).click();
          await page.waitForTimeout(1000);
          const offered = await aside.getByRole("button", { name: "Turn into Custom section" }).count();
          await aside.getByRole("button", { name: "Delete section" }).click();
          return offered === 0;
        })(),
      );
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
