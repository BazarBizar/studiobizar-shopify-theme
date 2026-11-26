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

import { createHash } from "node:crypto";
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

import { designStyle, type DesignValue } from "../lib/page-builder/design-style";
import { cardLook } from "../lib/page-builder/template-look";

import { LIQUID_SECTIONS } from "./lib/liquid";
import { DESIGN_SNIPPET, designSettings, FONT_SNIPPET, SECTION_PREFIX, SITE_PREFIX, themeSettingsFor } from "./lib/liquid-design";

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
  // Shopify picks `one` / `other` by the `count` argument.
  if (value && typeof value === "object" && "other" in (value as object)) {
    const count = Number(keywords(args).count);
    value = (value as Record<string, string>)[count === 1 && "one" in (value as object) ? "one" : "other"];
  }
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
engine.registerFilter("md5", (value: string) => createHash("md5").update(String(value ?? "")).digest("hex"));

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

/** `{% paginate collection.products by 24 %}` — the body, once, with no next page. */
engine.registerTag(
  "paginate",
  class extends Tag {
    private templates: unknown[] = [];
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
      super(token, remain, liquid);
      const stream = liquid.parser
        .parseStream(remain)
        .on("tag:endpaginate", () => stream.stop())
        .on("template", (template: unknown) => this.templates.push(template))
        .on("end", () => {
          throw new Error("paginate is not closed");
        });
      stream.start();
    }
    *render(context: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      context.push({ paginate: { next: null, previous: null, pages: 1 } });
      yield this.liquid.renderer.renderTemplates(this.templates as never, context, emitter);
      context.pop();
    }
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

/**
 * The store, as the templates' sections (Website → Templates, `sb-t-*`) read it: one
 * product, collection, project and designer with every field they show filled in.
 * `metaobject` carries the project's and the designer's fields at once, so both kinds
 * of section draw from it.
 */
const richText = "<p>Made by hand in Bali, from water hyacinth woven over a rattan frame.</p>";
const designerEntry = {
  system: { id: "gid://shopify/Metaobject/1", handle: "adelie-ducasse", url: "/pages/designer/adelie-ducasse" },
  name: "Adélie Ducasse",
  studio: "Atelier Ducasse",
  byline: "Furniture that earns its keep",
  portrait: { value: image() },
  bio_full: { value: richText },
  bio_short: { value: "Works in solid oak and hand-thrown ceramic." },
};
const storeProduct = (handle: string, title: string) => ({
  ...product(),
  id: 1,
  handle,
  title,
  url: `/products/${handle}`,
  type: "Baskets",
  tags: ["New"],
  featured_image: image(),
  variants: [{ id: 11, title: "Default Title" }],
  metafields: {
    custom: {
      designer: { value: designerEntry },
      idea_body: { value: richText },
      idea_image: { value: image() },
      material_finish: { value: "Water hyacinth" },
      colour: { value: "Natural" },
      availability: { value: "Made to order" },
      lead_time_weeks: { value: "12–16 weeks" },
      dimensions: { value: "<p>40 × 40 × 30 cm</p>" },
      care_maintenance: { value: "<p>Dust with a dry cloth.</p>" },
      collection_label: { value: "Arc Teak" },
      moq: { value: 1 },
      in_context_images: { value: [{ image: image(), caption: "In the long room", alt_text: "" }] },
    },
  },
});
const products = Array.from({ length: 10 }, (_, index) => storeProduct(`piece-${index + 1}`, `The Piece ${index + 1}`));
const projectEntry = (handle: string) => ({
  system: { id: `gid://shopify/Metaobject/p-${handle}`, handle, url: `/pages/project/${handle}` },
  title: "Casa Vitro",
  subtitle: "A house built around the light it lets in.",
  location: "Ibiza, Spain",
  year: "2023",
  category: "Residential",
  creative_lead: "Studio Bizar",
  collaborators: "Atelier Ducasse\nAède Studios",
  photography: "Studio Bizar",
  sort_order: 1,
  body: richText,
  hero_image: { value: image() },
  card_image: { value: image() },
  gallery: { value: [{ image: image(), caption: "The terrace", alt_text: "", credit: "" }, { image: image(), caption: "", alt_text: "", credit: "" }] },
  featured_items: { value: products.slice(0, 5) },
  related_projects: { value: [] },
});
const storeCollection = {
  id: 2,
  handle: "arc-teak",
  title: "The Arc Teak Collection",
  url: "/collections/arc-teak",
  description: "<p>Teak, bent and joined by hand.</p>",
  image: image(),
  products,
  products_count: products.length,
  filters: [],
  sort_options: [],
  sort_by: "manual",
  default_sort_by: "manual",
  metafields: {
    custom: {
      hero_image: { value: image() },
      idea_body: { value: richText },
      idea_image: { value: image() },
      idea_title: { value: "The Idea" },
      designer: { value: designerEntry },
      in_context_projects: { value: [projectEntry("casa-vitro"), projectEntry("villa-mimosa")] },
    },
  },
};
const storeMain = storeProduct("the-chunky-basket", "The Chunky Basket");
(storeMain.metafields.custom as Record<string, unknown>).signature_collection = { value: storeCollection };
const STORE = {
  product: storeMain,
  collection: storeCollection,
  collections: Object.assign([storeCollection], { "arc-teak": storeCollection, all: storeCollection }),
  metaobject: { ...projectEntry("casa-vitro"), ...designerEntry },
  shop: { metaobjects: { project: { values: [projectEntry("casa-vitro"), projectEntry("villa-mimosa"), projectEntry("the-salt-room")] } }, metafields: { custom: {} } },
  search: { performed: true, terms: "basket <b>", results: products.map((item) => ({ ...item, object_type: "product" })), results_count: products.length },
  recommendations: { performed: true, products_count: 4, products: products.slice(0, 4) },
  routes: { all_products_collection_url: "/collections/all", search_url: "/search", product_recommendations_url: "/recommendations/products" },
  current_tags: [],
};

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

const FILES = [...Object.values(LIQUID_SECTIONS), "sb-media-text", "sb-announcement-bar", "sb-popup"].filter(
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
    ...STORE,
    section,
    request: { design_mode: designMode, query_string: "", path: "/" },
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

    // The sample design on the first preset — drawn and measured in the browser.
    if (file === "sb-cta-banner" && schema.presets?.[0]) {
      const preset = schema.presets[0];
      const html = await render(source, { ...settingsFrom(schema.settings, preset.settings), ...themeSettingsFor(DESIGN_SAMPLE) }, [], false);
      rendered.push({ name: `${file}--design`, html });
    }

    // The templates' card settings: the theme writes what Next's `cardLook` writes.
    if (file === "sb-t-collections-main" && schema.presets?.[0]) {
      const look = {
        columnsDesktop: "2",
        columnsMobile: "1",
        gap: "roomy",
        imageShape: "square",
        imageRadius: 12,
        imageOverlay: "color",
        overlayColor: "#a65a3f",
        overlayOpacity: 40,
        cardStyle: "box",
        cardColor: "",
        cardBorderColor: "#302f2d",
        titleSize: "large",
        titleColor: "#47515c",
        cardAlign: "center",
        markSize: "standard",
        markColor: "#ffffff",
        bylineSize: "large",
        bylineColor: "#a65a3f",
      };
      const settings = {
        ...settingsFrom(schema.settings, {}),
        ...Object.fromEntries(Object.entries(look).map(([key, value]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), value])),
      };
      const html = await render(source, settings, [], false);
      const wrapper = html.match(/<div data-tl[^>]*>/)?.[0] ?? "";
      const expected = cardLook(look)!;
      const decode = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const gotStyle = Object.fromEntries(
        decode(wrapper.match(/style="([^"]*)"/)?.[1] ?? "")
          .split(";")
          .filter(Boolean)
          .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
      );
      for (const [name, value] of Object.entries(expected.attrs)) {
        check(`card look: the theme writes ${name}${value ? `="${value}"` : ""}`, wrapper.includes(value ? `${name}="${value}"` : name), wrapper);
      }
      for (const [name, value] of Object.entries(expected.style)) {
        check(`card look: the theme writes ${name}: ${value}`, gotStyle[name] === value, `theme ${gotStyle[name]}`);
      }
      rendered.push({ name: `${file}--card-look`, html });
    }

    // The carousel settings: two across and two per arrow, with a "read more" button.
    if (file === "sb-testimonials" && schema.presets?.[0]) {
      const preset = schema.presets[0];
      const blocks = Array.from({ length: 6 }, (_, index) => ({
        id: `q${index}`,
        type: "quote",
        shopify_attributes: "",
        settings: { ...settingsFrom(blockSchema("quote"), {}), quote: `Quote number ${index + 1}`, author: `Person ${index + 1}` },
      }));
      const settings = {
        ...settingsFrom(schema.settings, preset.settings),
        layout: "carousel",
        per_desktop: "2",
        step: "2",
        show_more: true,
        more_link_label: "All reviews",
        more_link_url: "/pages/reviews",
      };
      rendered.push({ name: `${file}--carousel-settings`, html: await render(source, settings, blocks, false) });
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

/* -------------------------------------------------------------------------- *
 * The design value: the Liquid snippet writes what Next writes
 * -------------------------------------------------------------------------- */

/** Every design control set, desktop and phone — the most the theme can be handed. */
const DESIGN_SAMPLE: DesignValue = {
  heading: { font: "playfair-display", size: { d: 44, m: 28 }, weight: 600, color: "#a65a3f", transform: "uppercase" },
  text: { size: { d: 19 }, color: "#47515c" },
  button: { font: "inter", size: { m: 12 }, transform: "none" },
  align: { d: "center", m: "left" },
  buttonLook: {
    background: "#a65a3f",
    color: "#ffffff",
    borderColor: "#302f2d",
    borderWidth: 2,
    radius: 20,
    hoverBackground: "#47515c",
    hoverColor: "#ebe8e3",
    hoverBorderColor: "#1d1d1b",
    padX: { d: 40, m: 16 },
    padY: { d: 14 },
    spaceAbove: { m: 12 },
    gap: { d: 24 },
  },
  sides: { padLeft: { d: 64, m: 16 }, padRight: { d: 48 }, marginLeft: { m: 8 }, marginRight: { d: 40, m: 8 } },
  images: { ratio: "square", radius: 12, zoom: true },
  shadow: "medium",
  maxWidth: { d: 900 },
  minHeight: { d: 600, m: 400 },
  verticalAlign: "center",
};

/** What a rendered element carries: its data-sb-* attributes and its style declarations. */
function carried(html: string) {
  const decode = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const attrs: Record<string, string> = {};
  for (const [, name, value] of html.matchAll(/\s(data-sb-[a-z0-9-]+)(?:="([^"]*)")?/g)) attrs[name!] = value ?? "";
  const style: Record<string, string> = {};
  const raw = html.match(/\sstyle="([^"]*)"/)?.[1];
  for (const declaration of decode(raw ?? "").split(";")) {
    const at = declaration.indexOf(":");
    if (at > 0) style[declaration.slice(0, at).trim()] = declaration.slice(at + 1).trim();
  }
  return { attrs, style };
}

/** `designStyle` as an element would carry it: camelCase properties as CSS names. */
function expectedFrom(value: DesignValue) {
  const { style, attrs } = designStyle(value);
  return {
    attrs,
    style: Object.fromEntries(Object.entries(style).map(([key, v]) => [key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v])),
  };
}

const sorted = (record: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(record).sort()));

async function designParity() {
  // Defaults as Shopify hands them (selects on "Default", numbers empty), then the values.
  const defaults = (prefix: string) =>
    Object.fromEntries(
      designSettings(["typography", "align", "buttons", "images", "effects", "width", "height"], prefix)
        .filter((setting) => typeof setting.id === "string")
        .map((setting) => [setting.id, setting.default ?? (setting.type === "checkbox" ? false : "")]),
    );
  const cases: [string, DesignValue, string][] = [
    ["nothing set", {}, SECTION_PREFIX],
    ["every control, desktop and phone", DESIGN_SAMPLE, SECTION_PREFIX],
    ["zero corners on photos write nothing; a zero line is a choice", { images: { radius: 0 }, buttonLook: { borderWidth: 0 } }, SECTION_PREFIX],
    ["a height with no position, a position with no height", { minHeight: { m: 300 } }, SECTION_PREFIX],
    [
      "photos: a portrait 2:3, a size in px on desktop and phone, the whole photo, kept at the top",
      { images: { ratio: "portrait_2_3", width: { d: 480, m: 280 }, height: { d: 600 }, fit: "contain", focus: "center top" } },
      SECTION_PREFIX,
    ],
    ["photos: a custom shape typed in as 7 : 3", { images: { ratio: "custom", custom: { w: 7, h: 3 } } }, SECTION_PREFIX],
    ["photos: a custom shape with no numbers writes nothing", { images: { ratio: "custom" } }, SECTION_PREFIX],
    ["photos: as uploaded — each photo its own shape", { images: { ratio: "own", zoom: true } }, SECTION_PREFIX],
    ["Site style", { heading: DESIGN_SAMPLE.heading, buttonLook: DESIGN_SAMPLE.buttonLook }, SITE_PREFIX],
  ];
  for (const [label, value, prefix] of cases) {
    const settings = { ...defaults(prefix), ...themeSettingsFor(value, prefix) };
    const html = await engine.parseAndRender(`<div{% render '${DESIGN_SNIPPET}', settings: s, prefix: '${prefix}' %}></div>`, { s: settings });
    const got = carried(html);
    const want = expectedFrom(value);
    check(`design · ${label}: the same attributes as Next`, sorted(got.attrs) === sorted(want.attrs), `${sorted(got.attrs)} ≠ ${sorted(want.attrs)}`);
    check(`design · ${label}: the same properties as Next`, sorted(got.style) === sorted(want.style), `${sorted(got.style)} ≠ ${sorted(want.style)}`);
  }
  // The ten fonts, latin and latin-ext each, every file in the theme's assets.
  const faces = await engine.parseAndRender(`{% render '${FONT_SNIPPET}' %}`, {});
  const files = [...faces.matchAll(/url\((sb-font-[^)]+\.woff2)\)/g)].map((match) => match[1]!);
  check(
    `design · ${FONT_SNIPPET}: 20 faces, every file present`,
    files.length === 20 && files.every((file) => fs.existsSync(path.join(THEME, "assets", file))),
    files.join(", "),
  );
}

/** A section given the sample design, drawn by the built theme CSS. */
async function designDrawn(tab: import("playwright").Page, label: "desktop" | "phone") {
  const section = tab.locator('[data-shot="sb-cta-banner--design"]');
  const looks = await section.evaluate((root) => {
    const frame = root.querySelector<HTMLElement>("[data-sb-hsize]")!;
    const heading = frame.querySelector("h1, h2, h3")!;
    const button = frame.querySelector<HTMLElement>('[data-sb-button="solid"]')!;
    return {
      headingSize: getComputedStyle(heading).fontSize,
      headingFont: getComputedStyle(heading).fontFamily,
      headingColour: getComputedStyle(heading).color,
      buttonBackground: getComputedStyle(button).backgroundColor,
      buttonCorners: getComputedStyle(button).borderTopLeftRadius,
      buttonPadding: getComputedStyle(button).paddingLeft,
      shadow: getComputedStyle(frame).boxShadow !== "none",
      minHeight: getComputedStyle(frame).minHeight,
    };
  });
  const phone = label === "phone";
  check(`design drawn (${label}): heading size`, looks.headingSize === (phone ? "28px" : "44px"), looks.headingSize);
  check(`design drawn (${label}): heading font and colour`, /Playfair/.test(looks.headingFont) && looks.headingColour === "rgb(166, 90, 63)", `${looks.headingFont} ${looks.headingColour}`);
  check(`design drawn (${label}): button colour and corners`, looks.buttonBackground === "rgb(166, 90, 63)" && looks.buttonCorners === "20px", `${looks.buttonBackground} ${looks.buttonCorners}`);
  check(`design drawn (${label}): button space inside`, looks.buttonPadding === (phone ? "16px" : "40px"), looks.buttonPadding);
  check(`design drawn (${label}): shadow and minimum height`, looks.shadow && looks.minHeight === (phone ? "400px" : "600px"), `${looks.shadow} ${looks.minHeight}`);
}

/** A photo's focal point (set on the photo in Shopify) reaches the <img>; an unset one adds nothing. */
async function focalPoint() {
  const draw = (point: { x: number; y: number }) =>
    engine.parseAndRender(`{% render 'sb-image', image: photo, ratio: '1 / 1' %}`, {
      photo: { ...image(), presentation: { focal_point: point } },
    });
  const set = await draw({ x: 20, y: 80 });
  check("focal point: a photo's own focal point is kept in view", set.includes("sb-focal") && set.includes("--sb-focal: 20% 80%"), set);
  const unset = await draw({ x: 50, y: 50 });
  check("focal point: an unset focal point adds nothing", !unset.includes("sb-focal"), unset);
}

/**
 * The announcement bar and a pop-up, driven by assets/sb-promo.js in Chromium: messages
 * rotate, a past message is left out, a closed bar stays closed; the pop-up opens on its
 * own, closes, and — once per visit — does not open again.
 */
async function promoBehaviour(browser: import("playwright").Browser) {
  const read = (file: string) => fs.readFileSync(path.join(THEME, "sections", `${file}.liquid`), "utf8");
  const schemaIn = (source: string) =>
    JSON.parse(source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/)![1]!) as Schema;

  const barSource = read("sb-announcement-bar");
  const message = (id: string, text: string, ends = "") => ({
    id,
    type: "message",
    shopify_attributes: "",
    settings: { text, link: "", starts_at: "", ends_at: ends },
  });
  const bar = await render(
    barSource,
    settingsFrom(schemaIn(barSource).settings, { dismissible: true, interval: 2 }),
    [message("m1", "First message"), message("m2", "Second message"), message("m3", "Ended message", "2000-01-01 00:00")],
    false,
  );
  const popupSource = read("sb-popup");
  const popup = await render(
    popupSource,
    settingsFrom(schemaIn(popupSource).settings, {
      heading: "Join the newsletter",
      text: "A few times a year.",
      newsletter: true,
      trigger: "delay",
      delay: 0,
      frequency: "session",
    }),
    [],
    false,
  );

  const file = path.join(OUT, "promo.html");
  const asset = (name: string) => pathToFileURL(path.join(THEME, "assets", name)).href;
  fs.writeFileSync(
    file,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="${asset("sb-theme.css")}"><script src="${asset("sb-promo.js")}" defer></script></head><body data-surface="light" class="bg-background text-foreground">${bar}<main style="height:2000px"></main>${popup}</body></html>`,
  );
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tab = await context.newPage();
  const errors: string[] = [];
  tab.on("pageerror", (error) => errors.push(error.message));
  await tab.goto(pathToFileURL(file).href, { waitUntil: "load" });

  const open = () => tab.evaluate(() => (document.querySelector("dialog[data-sb-popup]") as HTMLDialogElement).open);
  await tab.waitForFunction(() => (document.querySelector("dialog[data-sb-popup]") as HTMLDialogElement).open, null, { timeout: 5000 }).catch(() => {});
  check("pop-up: opens on its own", await open());
  const box = await tab.locator("dialog[data-sb-popup]").boundingBox();
  check("pop-up: the box sits in the middle", Boolean(box && Math.abs(box.x + box.width / 2 - 720) < 4), JSON.stringify(box));
  await tab.waitForTimeout(800); // past the way in (sb-popup-in)
  await tab.screenshot({ path: path.join(OUT, "desktop--sb-popup--open.png") });
  await tab.click("[data-sb-popup-close]");
  check("pop-up: × closes it", !(await open()));

  const visible = () =>
    tab.evaluate(() => [...document.querySelectorAll("p[data-sb-message]")].filter((p) => !p.classList.contains("invisible")).map((p) => p.textContent?.trim()));
  check("bar: the first message shows", (await visible()).join() === "First message", (await visible()).join());
  check("bar: a message whose dates are past is left out", (await tab.locator("text=Ended message").count()) === 0);
  await tab.click("[data-sb-announcement-next]");
  check("bar: the arrow shows the next message", (await visible()).join() === "Second message", (await visible()).join());


  await tab.click("[data-sb-announcement-close]");
  check("bar: × hides it", await tab.locator("[data-sb-announcement]").isHidden());

  await tab.reload({ waitUntil: "load" });
  await tab.waitForTimeout(500);
  check("bar: a closed bar stays closed", await tab.locator("[data-sb-announcement]").isHidden());
  check("pop-up: once per visit — not again on the next page", !(await open()));
  check("promo: no script errors", errors.length === 0, errors.join(" | "));
  await context.close();
}

async function main() {
  await focalPoint();
  await designParity();
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

    await designDrawn(tab, label);
    if (label === "desktop") {
      // The colour over the photos tints the photo only: the collection's name laid over
      // it stays above the colour, and is not tinted a second time.
      const layers = await tab.evaluate(() => {
        const card = document.querySelector('[data-shot="sb-t-collections-main--card-look"] li');
        const name = card?.querySelector('[data-surface="dark"]') as HTMLElement | null;
        const photo = name?.parentElement;
        return {
          photo: photo ? getComputedStyle(photo, "::after").zIndex : null,
          name: name ? getComputedStyle(name).zIndex : null,
          nameTinted: name ? getComputedStyle(name, "::after").content !== "none" : null,
        };
      });
      check("card look: the colour is over the photo, under the collection's name", layers.photo === "0" && layers.name === "1" && layers.nameTinted === false, JSON.stringify(layers));
    }
    if (label === "desktop") await interactions(tab);
    await context.close();
  }
  await promoBehaviour(browser);
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

async function carouselSettings(tab: import("playwright").Page) {
  const section = tab.locator('[data-shot="sb-testimonials--carousel-settings"]');
  if (!(await section.count())) return;
  const track = section.locator("[data-sb-carousel-track]");
  const widths = await track.evaluate((element) => {
    const items = [...element.children] as HTMLElement[];
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    return { track: element.clientWidth, item: items[0]!.getBoundingClientRect().width, gap };
  });
  check(
    "carousel settings: two across on desktop",
    Math.abs(widths.item * 2 + widths.gap - widths.track) <= 2,
    JSON.stringify(widths),
  );
  await section.locator("[data-sb-carousel-next]").click();
  await tab.waitForTimeout(700);
  const moved = await track.evaluate((element) => {
    const items = [...element.children] as HTMLElement[];
    return Math.round(element.scrollLeft / (items[1]!.offsetLeft - items[0]!.offsetLeft));
  });
  check("carousel settings: an arrow press moves two items", moved === 2, moved);
  check(
    "carousel settings: the 'show more' button, with its own text",
    (await section.getByRole("link", { name: "All reviews" }).count()) === 1,
  );
}

async function interactions(tab: import("playwright").Page) {
  await carouselSettings(tab);
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
