/**
 * The Liquid theme's sections, RENDERED — locally, without Shopify.
 *
 *   yarn check:liquid-render
 *   yarn check:liquid-render --only sb-banner,sb-tabs   # some sections
 *
 * `shopify theme dev` needs a login to the store, which an agent (or CI) does
 * not have. This renders the theme with liquidjs instead: Shopify's own filters
 * and tags are stubbed (below), the page loads the BUILT theme CSS and the
 * theme's own JS, and Playwright drives it in Chromium. Nothing is sent to the
 * store; product photographs come from its public CDN.
 *
 * For every page-builder section that has a theme twin (scripts/lib/liquid.ts),
 * plus sb-media-text:
 *   - every preset renders, with photographs filled in
 *   - the section renders with EVERY field empty, on the live store and in the
 *     theme editor — "every part optional" (docs/theme/page-building.md)
 *   - no horizontal overflow at 1440px and 390px, no console errors
 *   - tabs, video and slideshow behave (assets/sb-sections.js)
 * Screenshots of each preset at both widths, and the page itself, are written to
 * the system temp folder; the path is printed at the end — open index.html in a
 * browser to look at all of them.
 *
 * What this cannot tell you: how the theme editor's settings panel looks, what
 * Shopify's real drops hold (here they are mocks), and how a JSON template puts
 * sections together on a real page. Those need `shopify theme dev` — see
 * docs/theme/page-building.md, "Testing without the store".
 *
 * First run on a machine: `npx playwright install chromium`.
 */

import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  Liquid,
  Tag,
  type Context,
  type Emitter,
  type TagToken,
  type TopLevelToken,
} from "liquidjs";
import { chromium } from "playwright";

import { LIQUID_SECTIONS } from "./lib/liquid";

const ROOT = path.resolve(__dirname, "..");
const THEME = path.join(ROOT, "theme");
const OUT = path.join(tmpdir(), "liquid-render");

const only = (() => {
  const index = process.argv.indexOf("--only");
  return index > 0 ? new Set(process.argv[index + 1]!.split(",")) : null;
})();

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  if (!ok || process.env.VERBOSE)
    console.log(
      `${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 240)}` : ""}`,
    );
  if (!ok) failures += 1;
  return ok;
}

/* -------------------------------------------------------------------------- *
 * Shopify, stubbed
 * -------------------------------------------------------------------------- */

const locale = JSON.parse(
  fs.readFileSync(path.join(THEME, "locales/en.default.json"), "utf8"),
);

/** liquidjs hands keyword arguments (`t: index: 1`) to a filter as [key, value] pairs. */
const keywords = (args: unknown[]) =>
  Object.fromEntries(args.filter(Array.isArray) as [string, unknown][]);

/**
 * liquidjs cannot parse a `comment` block inside {% liquid %} whose text holds
 * backticks; Shopify can. Those blocks render nothing either way, so they are
 * removed before parsing.
 */
const stripComments = (text: string) =>
  text.replace(/^[ \t]*comment\r?\n[\s\S]*?^[ \t]*endcomment\r?\n/gm, "");

const engine = new Liquid({
  root: [path.join(THEME, "snippets")],
  extname: ".liquid",
  strictFilters: true,
  fs: {
    exists: async (file: string) => fs.existsSync(file),
    existsSync: (file: string) => fs.existsSync(file),
    readFile: async (file: string) =>
      stripComments(fs.readFileSync(file, "utf8")),
    readFileSync: (file: string) =>
      stripComments(fs.readFileSync(file, "utf8")),
    resolve: (root: string, file: string, ext: string) =>
      path.resolve(root, file.endsWith(ext) ? file : file + ext),
    contains: async (root: string, file: string) =>
      path.resolve(file).startsWith(path.resolve(root)),
    sep: path.sep,
    dirname: path.dirname,
  },
});

engine.registerFilter("t", (key: string, ...args: unknown[]) => {
  let value: unknown = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      locale,
    );
  // A missing key is a real bug: Shopify would print "translation missing" on the page.
  if (typeof value !== "string") throw new Error(`translation missing: ${key}`);
  for (const [name, replacement] of Object.entries(keywords(args)))
    value = (value as string).replaceAll(`{{ ${name} }}`, String(replacement));
  return value;
});
engine.registerFilter(
  "image_url",
  (image: { src?: string } | string, ...args: unknown[]) => {
    const { width } = keywords(args);
    const src = typeof image === "string" ? image : (image?.src ?? "");
    return width ? `${src}${src.includes("?") ? "&" : "?"}width=${width}` : src;
  },
);
engine.registerFilter(
  "placeholder_svg_tag",
  (_name: string, klass?: string) =>
    `<svg class="${klass ?? ""}" viewBox="0 0 10 10" data-placeholder><rect width="10" height="10"/></svg>`,
);
engine.registerFilter("asset_url", (name: string) => name);

engine.registerTag(
  "schema",
  class extends Tag {
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
      super(token, remain, liquid);
      while (remain.length)
        if ((remain.shift() as TagToken).name === "endschema") return;
      throw new Error("schema is not closed");
    }
    *render() {}
  },
);

/** `{% form 'customer', id: …, class: … %}` — a plain <form> with an empty `form` drop inside. */
engine.registerTag(
  "form",
  class extends Tag {
    private templates: unknown[] = [];
    private args: string;
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
      super(token, remain, liquid);
      this.args = token.args;
      const stream = liquid.parser
        .parseStream(remain)
        .on("tag:endform", () => stream.stop())
        .on("template", (template: unknown) => this.templates.push(template))
        .on("end", () => {
          throw new Error("form is not closed");
        });
      stream.start();
    }
    *render(
      context: Context,
      emitter: Emitter,
    ): Generator<unknown, void, unknown> {
      context.push({
        form: { email: "", errors: null, "posted_successfully?": false },
      });
      emitter.write(
        `<form method="post" class="${/class:\s*'([^']*)'/.exec(this.args)?.[1] ?? ""}">`,
      );
      yield this.liquid.renderer.renderTemplates(
        this.templates as never,
        context,
        emitter,
      );
      emitter.write("</form>");
      context.pop();
    }
  },
);

/* -------------------------------------------------------------------------- *
 * Data
 * -------------------------------------------------------------------------- */

const PICTURES = [
  "https://cdn.shopify.com/s/files/1/0750/8108/9160/files/0028007_jaha001n.jpg?v=1788159033",
  "https://cdn.shopify.com/s/files/1/0750/8108/9160/files/0028009_jaha002n.jpg?v=1788159033",
];
let pictureIndex = 0;
const image = () => ({
  src: PICTURES[pictureIndex++ % PICTURES.length],
  width: 1200,
  height: 1200,
  aspect_ratio: 1,
  alt: "",
});
const product = () => ({
  title: "The Chunky Basket",
  url: "/products/the-chunky-basket",
  description: "<p>Big, bold and beautiful — made from water hyacinth.</p>",
  images: [image(), image(), image()],
});

type Setting = { id?: string; type: string; default?: unknown };
type Schema = {
  settings?: Setting[];
  blocks?: { type: string; settings?: Setting[] }[];
  presets?: {
    name: string;
    settings?: Record<string, unknown>;
    blocks?: { type: string; settings?: Record<string, unknown> }[];
  }[];
};

/** Settings as Shopify hands them to a section: defaults, then the preset's values. `filled` puts media in. */
function settingsFrom(
  definitions: Setting[] | undefined,
  values: Record<string, unknown> = {},
  filled = true,
) {
  const out: Record<string, unknown> = {};
  for (const setting of definitions ?? []) {
    if (!setting.id) continue;
    out[setting.id] =
      setting.default ??
      (setting.type === "checkbox" ? false : setting.type === "range" ? 0 : "");
    if (setting.type === "image_picker")
      out[setting.id] = filled ? image() : null;
    if (setting.type === "video_url")
      out[setting.id] = filled ? { type: "youtube", id: "aqz-KE-bpKQ" } : null;
    if (setting.type === "product") out[setting.id] = filled ? product() : null;
    if (setting.type === "url")
      out[setting.id] = filled ? out[setting.id] : null;
  }
  return { ...out, ...values };
}

/** Everything a merchant could leave empty, emptied: text, media, links; selects keep their defaults. */
function emptied(definitions: Setting[] | undefined) {
  const out: Record<string, unknown> = {};
  for (const setting of definitions ?? []) {
    if (!setting.id) continue;
    if (
      [
        "text",
        "textarea",
        "richtext",
        "url",
        "image_picker",
        "video_url",
        "product",
      ].includes(setting.type)
    )
      out[setting.id] = null;
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Render
 * -------------------------------------------------------------------------- */

const FILES = [...Object.values(LIQUID_SECTIONS), "sb-media-text"].filter(
  (file) => !only || only.has(file!),
) as string[];

type Rendered = { name: string; html: string };
const rendered: Rendered[] = [];
let sectionIndex = 0;

async function render(
  source: string,
  settings: Record<string, unknown>,
  blocks: unknown[],
  designMode: boolean,
) {
  sectionIndex += 1;
  const section = {
    id: `s${sectionIndex}`,
    index: sectionIndex,
    settings,
    blocks,
    shopify_attributes: "",
  };
  return engine.parseAndRender(stripComments(source), {
    section,
    request: { design_mode: designMode },
    page: {},
    pages: {},
  });
}

async function renderAll() {
  for (const file of FILES) {
    const source = fs.readFileSync(
      path.join(THEME, "sections", `${file}.liquid`),
      "utf8",
    );
    const schema = JSON.parse(
      source.match(
        /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/,
      )![1]!,
    ) as Schema;
    const blockSchema = (type: string) =>
      schema.blocks?.find((block) => block.type === type)?.settings;

    for (const preset of schema.presets ?? [{ name: file }]) {
      const settings = settingsFrom(schema.settings, preset.settings);
      const blocks = (preset.blocks ?? []).map((block, index) => ({
        id: `b${index}`,
        type: block.type,
        shopify_attributes: "",
        settings: settingsFrom(blockSchema(block.type), block.settings),
      }));
      try {
        const html = await render(source, settings, blocks, false);
        check(
          `${file} · "${preset.name}" renders something`,
          html.trim().length > 0,
        );
        rendered.push({
          name: `${file}--${preset.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
          html,
        });
      } catch (error) {
        check(
          `${file} · "${preset.name}" renders`,
          false,
          (error as Error).message.split("\n")[0],
        );
      }
    }

    // Every field empty, every block empty — live and in the editor.
    const firstPreset = schema.presets?.[0];
    const emptyBlocks = (firstPreset?.blocks ?? []).map((block, index) => ({
      id: `e${index}`,
      type: block.type,
      shopify_attributes: "",
      settings: {
        ...settingsFrom(blockSchema(block.type), {}, false),
        ...emptied(blockSchema(block.type)),
      },
    }));
    const emptySettings = {
      ...settingsFrom(schema.settings, {}, false),
      ...emptied(schema.settings),
    };
    for (const designMode of [false, true]) {
      try {
        const html = await render(
          source,
          emptySettings,
          emptyBlocks,
          designMode,
        );
        check(
          `${file} with every field empty (${designMode ? "theme editor" : "live"}) renders`,
          true,
        );
        if (designMode)
          rendered.push({ name: `${file}--empty-in-editor`, html });
      } catch (error) {
        check(
          `${file} with every field empty (${designMode ? "theme editor" : "live"}) renders`,
          false,
          (error as Error).message.split("\n")[0],
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- *
 * Look at it
 * -------------------------------------------------------------------------- */

async function main() {
  await renderAll();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const asset = (name: string) =>
    pathToFileURL(path.join(THEME, "assets", name)).href;
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Liquid sections</title><link rel="stylesheet" href="${asset("sb-theme.css")}">${[
    "sb-theme.js",
    "sb-carousel.js",
    "sb-sections.js",
  ]
    .map((name) => `<script src="${asset(name)}" defer></script>`)
    .join(
      "",
    )}</head><body data-surface="light" class="bg-background text-foreground">${rendered
    .map((item) => `<section data-shot="${item.name}">${item.html}</section>`)
    .join("\n")}</body></html>`;
  const index = path.join(OUT, "index.html");
  fs.writeFileSync(index, page);

  const browser = await chromium.launch().catch((error: Error) => {
    console.error(
      `✗ Chromium did not start. On a first run: npx playwright install chromium\n  ${error.message.split("\n")[0]}`,
    );
    process.exit(1);
  });

  for (const [label, width] of [
    ["desktop", 1440],
    ["phone", 390],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    tab.on("pageerror", (error) => errors.push(error.message));
    // The players are never requested for real.
    await tab.route(/youtube-nocookie|vimeo/, (route) =>
      route.fulfill({ body: "<html></html>", contentType: "text/html" }),
    );
    await tab.goto(pathToFileURL(index).href, { waitUntil: "networkidle" });

    for (const item of rendered) {
      if (item.name.endsWith("--empty-in-editor")) continue;
      const element = tab.locator(`[data-shot="${item.name}"]`);
      await element.scrollIntoViewIfNeeded();
      const box = await element.boundingBox();
      if (box && box.height > 4)
        await element.screenshot({
          path: path.join(OUT, `${label}--${item.name}.png`),
        });
    }

    const overflow = await tab.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`${label}: no horizontal overflow`, overflow <= 0, `${overflow}px`);
    check(
      `${label}: no console errors`,
      errors.length === 0,
      [...new Set(errors)].slice(0, 3).join(" | "),
    );

    if (label === "desktop") await interactions(tab);
    await context.close();
  }
  await browser.close();

  const total = rendered.length;
  console.log(
    `\nRendered ${total} sections. Open ${index} to look at them; screenshots are beside it.`,
  );
  console.log(
    failures
      ? `${failures} check(s) failed.`
      : "All Liquid render checks passed.",
  );
  process.exit(failures ? 1 : 0);
}

async function interactions(tab: import("playwright").Page) {
  const tabs = tab.locator("[data-sb-tabs]").first();
  if (await tabs.count()) {
    check(
      "tabs: the tab list appears once the script runs",
      await tabs.locator("[role=tablist]").isVisible(),
    );
    check(
      "tabs: one panel at a time",
      (await tabs.locator("[role=tabpanel]:visible").count()) === 1,
    );
    const second = tabs.getByRole("tab").nth(1);
    await second.click();
    const panelId = await second.getAttribute("aria-controls");
    check(
      "tabs: a click shows that tab's panel",
      await tabs.locator(`#${panelId}`).isVisible(),
    );
    await tab.keyboard.press("ArrowRight");
    check(
      "tabs: ArrowRight selects the next tab",
      (await tabs.getByRole("tab").nth(2).getAttribute("aria-selected")) ===
        "true",
    );
  }

  const video = tab.locator("[data-sb-video]").first();
  if (await video.count()) {
    check(
      "video: nothing is framed before play",
      (await video.locator("iframe").count()) === 0,
    );
    await video.getByRole("button").click();
    const src = await video.locator("iframe").getAttribute("src");
    check(
      "video: play frames the privacy-enhanced player",
      Boolean(src?.startsWith("https://www.youtube-nocookie.com/embed/")),
      src,
    );
  }

  const show = tab.locator("[data-sb-slideshow]").first();
  if (await show.count()) {
    const next = show.locator("[data-sb-slideshow-next]");
    if (await next.count()) {
      // Autoplay may have moved on while the page was photographed: Next must show
      // the slide after whichever one is showing now.
      const shown = () =>
        show.locator("[data-sb-slide]").evaluateAll((slides) => slides.findIndex((slide) => !slide.hasAttribute("aria-hidden")));
      const count = await show.locator("[data-sb-slide]").count();
      const before = await shown();
      await next.click();
      check("slideshow: Next shows the following slide", (await shown()) === (before + 1) % count, `${before} → ${await shown()}`);
    }
    const toggle = show.locator("[data-sb-slideshow-toggle]");
    if (await toggle.count()) {
      const before = await toggle.getAttribute("aria-label");
      await toggle.click();
      check(
        "slideshow: the pause control toggles",
        (await toggle.getAttribute("aria-label")) !== before,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
