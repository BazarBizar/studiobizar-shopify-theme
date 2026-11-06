/**
 * The Theme Builder's sections and element styles, drawn by the real preview — and
 * NOTHING WRITTEN: no editor is opened (its autosave would write the draft), only the
 * preview, which is sent a layout the way the editor sends one (`sb-preview:content`)
 * and draws it without saving.
 *
 *   yarn dev                      # in another terminal
 *   yarn check:theme-preview
 *
 * Signs in like `check-theme-builder-ui.ts`: a staff session minted with the project's
 * own AUTH_SECRET, localhost only.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";
import { createSection } from "../lib/page-builder/document";
import { withExamples } from "../lib/page-builder/examples";
import { presetById, SECTION_PRESETS, sectionFromPreset } from "../lib/page-builder/presets";
import { defaultLayoutContent } from "../lib/theme-builder/layout";

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
    console.error(`✗ ${BASE} is not a local server. This check only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }
  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");

  // The layout the editor would send: a section under the header, two in the footer,
  // and the desktop main menu with a style of its own.
  const content = defaultLayoutContent();
  const under = createSection("text_block");
  (under.settings as Record<string, unknown>).title = "Under the header check";
  content.header.sections = [under];
  const custom = sectionFromPreset(presetById("custom_section")!);
  const footerText = createSection("text_block");
  (footerText.settings as Record<string, unknown>).title = "In the footer check";
  // Two photos with the Style tab's photo settings, the first one cropped on the photo itself.
  const photo = {
    id: "gid://shopify/MediaImage/1",
    url: "https://cdn.shopify.com/s/files/1/0750/8108/9160/files/0028007_jaha001n.jpg?v=1788159033",
    altText: "Crop check",
    width: 1250,
    height: 1250,
  };
  const cropped = createSection("full_image");
  Object.assign(cropped.settings as Record<string, unknown>, {
    image: { ...photo, crop: { x: 100, y: 0, width: 600, height: 900 } },
    design: { images: { width: { d: 400, m: 200 }, height: { d: 300 }, fit: "contain", focus: "center top" } },
  });
  const shaped = createSection("full_image");
  Object.assign(shaped.settings as Record<string, unknown>, {
    image: { ...photo, altText: "Shape check" },
    design: { images: { ratio: "custom", custom: { w: 1, h: 1 }, width: { d: 500 } } },
  });
  // A section whose frame is portrait (Media & text, 2:3) with a LANDSCAPE crop: it shows landscape.
  const wide = { ...photo, crop: { x: 0, y: 300, width: 1250, height: 625 } };
  const mediaText = createSection("media_text");
  Object.assign(mediaText.settings as Record<string, unknown>, { image: { ...wide, altText: "Frame follows crop" } });
  // The Style tab's shape is for every photo in the section: it wins over a crop.
  const styled = createSection("full_image");
  Object.assign(styled.settings as Record<string, unknown>, {
    image: { ...wide, altText: "Style beats crop" },
    design: { images: { ratio: "square", width: { d: 400 } } },
  });
  // "As uploaded": a landscape photo, not cropped, in columns that are portrait by default.
  const landscapePhoto = { ...photo, url: `${photo.url}&crop=region&crop_left=0&crop_top=0&crop_width=1250&crop_height=625`, height: 625 };
  const columns = withExamples(sectionFromPreset(SECTION_PRESETS.find((item) => item.type === "multicolumn")!), {
    images: [1, 2, 3].map((n) => ({ ...landscapePhoto, id: `gid://shopify/MediaImage/${n + 10}`, altText: `Own shape ${n}` })),
    products: [],
    collections: [],
  });
  (columns.settings as Record<string, unknown>).design = { images: { ratio: "own" } };
  content.footer.sections = [custom, footerText, cropped, shaped, mediaText, styled, columns];
  const menu = content.header.desktop.left[1]!;
  menu.style = { background: "#ff0000", padX: { d: 20 }, design: { text: { size: { d: 22 } } } };

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
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(`${BASE}/preview/theme?page=home`, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate((layout) => window.postMessage({ type: "sb-preview:content", content: layout }, window.location.origin), content);
    await page.locator("[data-theme-sections='footer']").waitFor({ timeout: 30000 });

    const header = page.locator("[data-theme-sections='header']");
    check("the section under the header is drawn", (await header.getByText("Under the header check").count()) === 1);
    check(
      "it follows the header bar, outside it (so it scrolls with the page)",
      await page.evaluate(() => {
        const bar = document.getElementById("site-header");
        const sections = document.querySelector("[data-theme-sections='header']");
        return Boolean(bar && sections && !bar.contains(sections) && bar.compareDocumentPosition(sections) & Node.DOCUMENT_POSITION_FOLLOWING);
      }),
    );

    const footer = page.locator("#site-footer [data-theme-sections='footer']");
    check("the footer sections are drawn inside the footer, in order", (await footer.locator("[data-section-id]").count()) === 7);
    check("the footer's text section shows its heading", (await footer.getByText("In the footer check").count()) === 1);
    check("the footer columns still follow", (await page.locator("#site-footer nav").count()) >= 3);

    const styled = page.locator(`[data-element-id="${menu.id}"]`).first();
    const look = await styled.evaluate((element) => {
      const own = getComputedStyle(element);
      const link = element.querySelector("li > a");
      return { background: own.backgroundColor, padding: own.paddingLeft, linkSize: link ? getComputedStyle(link).fontSize : "" };
    });
    check("the menu's own background is drawn", look.background === "rgb(255, 0, 0)", look.background);
    check("the menu's own padding is drawn", look.padding === "20px", look.padding);
    check("the menu's own text size reaches its links", look.linkSize === "22px", look.linkSize);

    const other = await page
      .locator(`[data-element-id="${content.header.desktop.left[0]!.id}"]`)
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    check("an element without a style keeps the header's look", other !== "rgb(255, 0, 0)", other);

    // Photos: one photo's crop, and the section's size, fit, focus and shape.
    const measure = (alt: string) =>
      page.locator(`#site-footer img[alt="${alt}"]`).evaluate((img) => {
        const box = img.parentElement!.getBoundingClientRect();
        const own = getComputedStyle(img);
        return { src: img.getAttribute("src") ?? "", w: Math.round(box.width), h: Math.round(box.height), fit: own.objectFit, pos: own.objectPosition };
      });
    const crop = await measure("Crop check");
    check("a cropped photo asks the CDN for just its crop", /crop=region/.test(crop.src) && /crop_width=600/.test(crop.src) && /crop_height=900/.test(crop.src), crop.src);
    check("the photo's width in px is drawn", crop.w === 400, crop.w);
    check("the photo's height in px replaces its shape", crop.h === 300, crop.h);
    check("the whole photo is shown (fit)", crop.fit === "contain", crop.fit);
    check("the top stays in view (focus)", crop.pos === "50% 0%", crop.pos);
    const shape = await measure("Shape check");
    check("a custom 1 : 1 shape at 500 px is drawn square", shape.w === 500 && shape.h === 500, `${shape.w}×${shape.h}`);
    check("a photo with no crop is left whole", !/crop=region/.test(shape.src), shape.src);

    const ratioOf = (box: { w: number; h: number }) => Math.round((box.w / box.h) * 100) / 100;
    const follows = await measure("Frame follows crop");
    check("a portrait frame shows a landscape crop landscape (2 : 1)", ratioOf(follows) === 2, `${follows.w}×${follows.h}`);
    const beats = await measure("Style beats crop");
    check("the Style tab's shape wins over the crop (square)", beats.w === 400 && beats.h === 400, `${beats.w}×${beats.h}`);
    await page.waitForFunction(() => (document.querySelector<HTMLImageElement>(`#site-footer img[alt="Own shape 1"]`)?.naturalWidth ?? 0) > 0, undefined, { timeout: 20000 }).catch(() => undefined);
    const ownShape = await measure("Own shape 1");
    check("'As uploaded' shows a landscape photo landscape in portrait columns", ratioOf(ownShape) === 2, `${ownShape.w}×${ownShape.h}`);

    await page.setViewportSize({ width: 390, height: 844 });
    const phone = await measure("Crop check");
    check("the phone's own width is drawn on a phone", phone.w === 200, phone.w);
    check("the desktop height carries down to the phone", phone.h === 300, phone.h);

    check("no errors in the preview", errors.length === 0, errors.join(" | "));
  } finally {
    await browser.close();
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nThe preview draws the header's and footer's sections and element styles.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
