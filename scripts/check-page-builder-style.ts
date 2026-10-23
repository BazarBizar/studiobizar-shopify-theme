/**
 * The Style tab, measured on every section type in a real browser.
 *
 *   yarn check:page-builder-style            (needs `yarn dev` on localhost:3000)
 *   ONLY=text_block,marquee yarn check:page-builder-style
 *
 * Builds three HIDDEN test pages (deleted again, whatever happens): every section
 * with custom spacing, a colour, a line and corners; and every section at the
 * smallest and largest Vertical spacing. Content comes from the store's own
 * builder pages (read only), else from the section's preset. Then it measures the
 * preview: margin, the 11px / 13px padding, colour, line, corners, and that
 * Vertical spacing changes the height. A section that draws nothing (no content
 * in this store) is listed, not failed.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";

const ROOT = resolve(__dirname, "..");
for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("=")).trim();
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (/^".*"$/.test(value)) value = value.slice(1, -1);
  process.env[key] ??= value;
}
{
  const require = createRequire(resolve(ROOT, "package.json"));
  const resolved = require.resolve("next/navigation");
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { unstable_rethrow: () => {} } } as never;
}
const load = (path: string) => import(pathToFileURL(resolve(ROOT, path)).href);

const STYLE = {
  customSpacing: true,
  paddingTop: 11,
  paddingBottom: 13,
  marginTop: 7,
  marginBottom: 9,
  bgColor: "#123456",
  textColor: "#fafafa",
  border: "all",
  borderWidth: 3,
  radius: 5,
};

async function main() {
  const { SECTIONS } = await load("lib/page-builder/registry.ts");
  const { SECTION_PRESETS, sectionFromPreset } = await load("lib/page-builder/presets.ts");
  const { createSection, newSectionId } = await load("lib/page-builder/document.ts");
  const pb = await load("lib/admin/page-builder.ts");

  // Real content first: the first section of each type on the store's builder pages (read only).
  const real = new Map<string, { type: string; settings: Record<string, unknown> }>();
  for (const row of await pb.listPagesWithContent()) {
    if (!row.editable) continue;
    try {
      const state = await pb.getBuilderState(row.id);
      for (const section of [...(state.published?.sections ?? []), ...state.draft.sections]) {
        if (!real.has(section.type)) real.set(section.type, section);
      }
    } catch {}
  }

  const only = process.env.ONLY?.split(",");
  const types = Object.keys(SECTIONS).filter((type) => !SECTIONS[type].hidden && (!only || only.includes(type)));
  const base = (type: string) => {
    const found = real.get(type);
    if (found) return { id: newSectionId(), type, visible: true, settings: { ...SECTIONS[type].defaults(), ...found.settings } };
    const preset = SECTION_PRESETS.find((candidate: { type: string }) => candidate.type === type);
    return preset ? sectionFromPreset(preset) : createSection(type);
  };
  const variants: Record<string, Record<string, unknown>> = {
    style: STYLE,
    xs: { rhythm: "xs", customSpacing: false },
    xl: { rhythm: "xl", customSpacing: false },
  };

  const email = process.env.ADMIN_ALLOWED_EMAILS!.split(",")[0]!.trim().toLowerCase();
  const token = await encode({ token: { email, sub: email }, secret: process.env.AUTH_SECRET!, salt: STAFF_COOKIE, maxAge: 3600 });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: STAFF_COOKIE, value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();

  const measured: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const [name, extra] of Object.entries(variants)) {
    const sections = types.map((type) => {
      const section = base(type);
      // The page heading's partner would join its band; keep every section separate.
      const settings = { ...section.settings, ...extra, ...("placement" in section.settings ? { placement: "separate" } : {}) };
      return { ...section, settings };
    });
    const created = await pb.createBuilderPage(
      { title: `Style check ${name}`, handle: `pb-style-check-${name}-${Date.now().toString(36)}`, template: "blank" },
      "style-check",
    );
    const id = created.id as string;
    try {
      const state = await pb.getBuilderState(id);
      await pb.saveDraft(id, { page: state.draft.page, sections }, state.draft.meta.revision, "style-check");
      await page.goto(`http://localhost:3000/preview/pages/${id.split("/").pop()}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(2500);
      const results = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-section-id]")].map((frame) => {
          const own = getComputedStyle(frame);
          const box = frame.getBoundingClientRect();
          const all = [frame, ...frame.querySelectorAll<HTMLElement>("*")];
          return {
            type: frame.dataset.sectionType!,
            height: Math.round(box.height),
            margin: own.marginTop === "7px" && own.marginBottom === "9px",
            padTop: all.some((el) => getComputedStyle(el).paddingTop === "11px"),
            padBottom: all.some((el) => getComputedStyle(el).paddingBottom === "13px"),
            bg: own.backgroundColor === "rgb(18, 52, 86)",
            border: own.borderTopWidth === "3px",
            radius: own.borderTopLeftRadius === "5px",
          };
        }),
      );
      measured[name] = Object.fromEntries(results.map((r) => [r.type, r]));
    } finally {
      await pb.deleteBuilderPage(id).catch((error: Error) => console.log("cleanup failed", error.message));
    }
  }
  /**
   * A section joined to the page heading's band is drawn INSIDE the heading's frame.
   * The heading's custom spacing must not reach it: its own band keeps its padding.
   */
  let joinedLeak: boolean | null = null;
  if (!only) {
    const heading = base("page_heading");
    const joined = base("faq");
    const created = await pb.createBuilderPage(
      { title: "Style check joined", handle: `pb-style-check-joined-${Date.now().toString(36)}`, template: "blank" },
      "style-check",
    );
    const id = created.id as string;
    try {
      const state = await pb.getBuilderState(id);
      const sections = [
        { ...heading, settings: { ...heading.settings, ...STYLE, style: "default" } },
        { ...joined, settings: { ...joined.settings, placement: "heading" } },
      ];
      await pb.saveDraft(id, { page: state.draft.page, sections }, state.draft.meta.revision, "style-check");
      await page.goto(`http://localhost:3000/preview/pages/${id.split("/").pop()}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1500);
      joinedLeak = await page.evaluate(() => {
        const inner = document.querySelector<HTMLElement>("[data-section-id] [data-section-id]");
        if (!inner) return null;
        return [inner, ...inner.querySelectorAll<HTMLElement>("*")].some(
          (el) => getComputedStyle(el).paddingTop === "11px" || getComputedStyle(el).paddingBottom === "13px",
        );
      });
    } finally {
      await pb.deleteBuilderPage(id).catch((error: Error) => console.log("cleanup failed", error.message));
    }
  }
  await browser.close();

  let failures = 0;
  if (joinedLeak === null && !only) console.log("·  joined band: the joined section did not draw");
  else if (joinedLeak !== null) {
    if (joinedLeak) failures += 1;
    console.log(`${joinedLeak ? "✗" : "✓"}  joined band          ${joinedLeak ? "the heading's custom spacing leaks into the section under it" : ""}`);
  }
  for (const type of types) {
    const fields = new Set(SECTIONS[type].fields.map((field: { key: string }) => field.key));
    const st = measured.style?.[type];
    const xs = measured.xs?.[type];
    const xl = measured.xl?.[type];
    if (!st || (xs && xs.height === 0 && xl && xl.height === 0)) {
      console.log(`·  ${type.padEnd(20)} not drawn (no content)`);
      continue;
    }
    const problems: string[] = [];
    if (!st.margin) problems.push("margin");
    if (!st.padTop) problems.push("padding top");
    if (!st.padBottom) problems.push("padding bottom");
    if (fields.has("bgColor") && !st.bg) problems.push("background colour");
    if (!st.border) problems.push("line");
    if (!st.radius) problems.push("corners");
    if (fields.has("rhythm") && xs && xl && xs.height === xl.height) problems.push(`vertical spacing has no effect (${xs.height}px both)`);
    if (problems.length) failures += 1;
    console.log(`${problems.length ? "✗" : "✓"}  ${type.padEnd(20)} ${problems.join(", ")}${real.has(type) ? "" : "  (preset content)"}`);
  }
  console.log(
    failures
      ? `\n${failures} section(s) with a Style setting that does not work.`
      : "\nEvery drawn section honours the Style tab.",
  );
  return failures;
}

main().then((failures) => process.exit(failures ? 1 : 0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
