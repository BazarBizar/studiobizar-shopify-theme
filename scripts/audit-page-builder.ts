/**
 * Every setting of every section and block, tried — on BOTH storefronts.
 *
 *   yarn audit:page-builder                 # all section types
 *   yarn audit:page-builder multicolumn     # some (comma-separated)
 *
 * For each preset, each field of the section and of each kind of block is set the
 * way an editor would set it — a text with a marker in it, a photograph with an
 * address of its own, every other choice of a select, the switch flipped — and the
 * section is drawn again by the Next renderer AND the Liquid theme section. A field
 * the editor offers must then SHOW (a text, a photograph, a link appears in the
 * page) or CHANGE something (a select, a switch, a number). One that does neither
 * is reported: it is a setting that does nothing, which is what "I added an image
 * and it does not appear" is.
 *
 * Fields are only tried while the editor would show them (`when`), and the field
 * a `when` depends on is set first. The Style tab and the universal settings are
 * measured in a browser by `check:page-builder-style`, not here.
 *
 * Offline apart from reading a few product and collection ids from the store
 * (read only), for the sections that show products. Nothing is written.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Liquid, Tag, type Context, type Emitter, type TagToken, type TopLevelToken } from "liquidjs";

const ROOT = path.resolve(__dirname, "..");
const THEME = path.join(ROOT, "theme");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  process.env[line.slice(0, line.indexOf("=")).trim()] ??= line.slice(line.indexOf("=") + 1).trim();
}
// next/image outside Next: the project serves Shopify's CDN unoptimised (next.config.ts).
// Next inlines this as an OBJECT at build time; process.env would turn it into a string.
process.env = { ...process.env, __NEXT_IMAGE_OPTS: {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  path: "/_next/image",
  loader: "default",
  unoptimized: true,
  remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
} as unknown as string };
{
  const require = createRequire(path.join(ROOT, "package.json"));
  const stub = (name: string, exports: unknown) => {
    const resolved = require.resolve(name);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } as never;
  };
  stub("server-only", {});
  stub("next/navigation", {
    unstable_rethrow: () => {},
    notFound: () => {
      throw new Error("notFound");
    },
    redirect: () => {},
    usePathname: () => "/",
    useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {} }),
    useSearchParams: () => new URLSearchParams(),
  });
}
const load = (file: string) => import(pathToFileURL(path.join(ROOT, file)).href);

const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;

/* -------------------------------------------------------------------------- *
 * Liquid, as check:liquid-render sets it up
 * -------------------------------------------------------------------------- */

const stripComments = (text: string) => text.replace(/^[ \t]*comment\r?\n[\s\S]*?^[ \t]*endcomment\r?\n/gm, "");
const locale = JSON.parse(fs.readFileSync(path.join(THEME, "locales/en.default.json"), "utf8"));
const keywords = (args: unknown[]) =>
  Object.fromEntries(args.filter((arg): arg is [string, unknown] => Array.isArray(arg) && arg.length === 2));

const engine = new Liquid({
  root: [path.join(THEME, "snippets")],
  extname: ".liquid",
  strictFilters: true,
  fs: {
    exists: async (file: string) => fs.existsSync(file),
    existsSync: (file: string) => fs.existsSync(file),
    readFile: async (file: string) => stripComments(fs.readFileSync(file, "utf8")),
    readFileSync: (file: string) => stripComments(fs.readFileSync(file, "utf8")),
    resolve: (root: string, file: string, ext: string) => path.resolve(root, file.endsWith(ext) ? file : file + ext),
    contains: async (root: string, file: string) => path.resolve(file).startsWith(path.resolve(root)),
    sep: path.sep,
    dirname: path.dirname,
  },
});
engine.registerFilter("t", (key: string, ...args: unknown[]) => {
  let value: unknown = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);
  if (typeof value !== "string") throw new Error(`translation missing: ${key}`);
  for (const [name, replacement] of Object.entries(keywords(args))) value = (value as string).replaceAll(`{{ ${name} }}`, String(replacement));
  return value;
});
engine.registerFilter("image_url", (image: { src?: string } | string, ...args: unknown[]) => {
  const { width } = keywords(args);
  const src = typeof image === "string" ? image : (image?.src ?? "");
  return width ? `${src}${src.includes("?") ? "&" : "?"}width=${width}` : src;
});
engine.registerFilter("placeholder_svg_tag", (_name: string, klass?: string) => `<svg class="${klass ?? ""}" data-placeholder></svg>`);
engine.registerFilter("asset_url", (name: string) => name);
engine.registerTag(
  "schema",
  class extends Tag {
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
      super(token, remain, liquid);
      while (remain.length) if ((remain.shift() as TagToken).name === "endschema") return;
      throw new Error("schema is not closed");
    }
    *render() {}
  },
);
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
    *render(context: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      context.push({ form: { email: "", errors: null, "posted_successfully?": false } });
      emitter.write(`<form method="post" class="${/class:\s*'([^']*)'/.exec(this.args)?.[1] ?? ""}">`);
      yield this.liquid.renderer.renderTemplates(this.templates as never, context, emitter);
      emitter.write("</form>");
      context.pop();
    }
  },
);

/* -------------------------------------------------------------------------- *
 * Values
 * -------------------------------------------------------------------------- */

type Field = {
  key: string;
  label: string;
  kind: string;
  when?: { field: string; is: readonly (string | boolean)[] };
  options?: readonly { value: string; label: string }[];
  default?: unknown;
  min?: number;
  max?: number;
  nextOnly?: boolean;
  blocks?: readonly { type: string; label: string; fields: readonly Field[] }[];
};
type Settings = Record<string, unknown>;
type Ref = { id: string; handle: string; title: string };

let counter = 0;
const auditImage = (tag: string) => {
  counter += 1;
  return { id: `gid://shopify/MediaImage/99${counter}`, url: `https://cdn.shopify.com/s/files/audit/${tag.replace(/[^a-z0-9]+/gi, "-")}-${counter}.jpg`, altText: null, width: 1200, height: 800 };
};
const rich = (text: string) => JSON.stringify({ type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: text }] }] });
const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** What setting `field` to something new looks like, and how to know it took. */
type Attempt = { label: string; value: unknown; marker?: string };

function attempts(field: Field, current: unknown, refs: { products: Ref[]; collections: Ref[] }, tag: string): Attempt[] {
  const marker = `AUDIT${tag.replace(/[^a-z0-9]/gi, "")}X`;
  switch (field.kind) {
    case "text":
    case "textarea":
      return [{ label: "text", value: marker, marker }];
    case "richText":
      return [{ label: "text", value: rich(marker), marker }];
    case "image": {
      const image = auditImage(tag);
      return [{ label: "a photograph", value: image, marker: image.url.split("/").pop()!.replace(".jpg", "") }];
    }
    case "imageList": {
      const images = [auditImage(tag), auditImage(tag)];
      return [{ label: "photographs", value: images.map((image) => ({ image, caption: "" })), marker: images[0]!.url.split("/").pop()!.replace(".jpg", "") }];
    }
    case "link":
      return [{ label: "a link", value: { label: marker, href: `/${marker.toLowerCase()}` }, marker: `/${marker.toLowerCase()}` }];
    case "url":
      return [{ label: "an address", value: `https://example.com/${marker.toLowerCase()}`, marker: marker.toLowerCase() }];
    case "video":
      return [{ label: "a video", value: "https://www.youtube.com/watch?v=AuDiTvid01x", marker: "AuDiTvid01x" }];
    case "select":
      return (field.options ?? []).filter((option) => option.value !== current).map((option) => ({ label: `“${option.label}”`, value: option.value }));
    case "toggle":
      return [{ label: current ? "switched off" : "switched on", value: !current }];
    case "number":
      // Both ends: a limit above what the store holds changes nothing, one below it does.
      return [field.min, field.max].filter((value) => value !== current).map((value) => ({ label: `set to ${value}`, value }));
    case "color":
      return [{ label: "a colour", value: "#12AB34" }];
    case "product": {
      const pick = refs.products.find((product) => (current as Ref | null)?.id !== product.id);
      return pick ? [{ label: "a product", value: pick, marker: pick.handle }] : [];
    }
    case "products":
      return refs.products.length ? [{ label: "products", value: refs.products.slice(0, 2), marker: refs.products[0]!.handle }] : [];
    case "collection": {
      const pick = refs.collections.find((collection) => (current as Ref | null)?.id !== collection.id);
      return pick ? [{ label: "a collection", value: pick }] : [];
    }
    case "collections":
      return refs.collections.length ? [{ label: "collections", value: refs.collections.slice(0, 2) }] : [];
    default:
      return []; // design: the Typography/buttons panel, measured by its own checks
  }
}

const SKIP_KEYS = new Set(["surface", "rhythm", "hideOn"]);

const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

/** The examples leave a video address empty (there is no stock video); an editor would fill it. */
function withVideo<T extends Settings | { settings: Settings }>(fields: readonly Field[], value: T): T {
  const settings = ("settings" in value && typeof value.settings === "object" ? value.settings : value) as Settings;
  for (const field of fields) {
    if (field.kind === "video" && !settings[field.key]) settings[field.key] = SAMPLE_VIDEO;
    if (field.kind === "blocks")
      for (const block of (settings[field.key] as { type: string; settings: Settings }[]) ?? []) {
        const definition = field.blocks?.find((candidate) => candidate.type === block.type);
        if (definition) withVideo(definition.fields, block);
      }
  }
  return value;
}

/** Makes `field` visible in the editor, setting whatever its `when` depends on first. */
function reveal(field: Field, own: Settings, ownFields: readonly Field[], section: Settings, sectionFields: readonly Field[], depth = 0) {
  if (!field.when || depth > 4) return;
  const inOwn = ownFields.find((candidate) => candidate.key === field.when!.field);
  const [target, targetFields, controller] = inOwn
    ? [own, ownFields, inOwn]
    : [section, sectionFields, sectionFields.find((candidate) => candidate.key === field.when!.field)];
  if (!controller) return;
  reveal(controller, target, targetFields, section, sectionFields, depth + 1);
  if (!field.when.is.includes(target[controller.key] as string | boolean)) target[controller.key] = field.when.is[0];
}

/* -------------------------------------------------------------------------- *
 * The two storefronts
 * -------------------------------------------------------------------------- */

async function renderNext(type: string, settings: Settings): Promise<string> {
  const { renderToReadableStream } = await import("react-dom/server.edge");
  const renderer = RENDERERS[type];
  const key = JSON.stringify(settings);
  let data = loaded.get(key);
  if (data === undefined && renderer.load) {
    data = await renderer.load(settings);
    loaded.set(key, data);
  }
  const element = renderer.render(settings, data, { id: "audit", inline: false, pageTitle: "Audit page", preview: false });
  if (!element) return "";
  let failure: unknown = null;
  const stream = await renderToReadableStream(element, { onError: (error: unknown) => void (failure = error) });
  await stream.allReady;
  const html = await new Response(stream).text();
  if (failure) throw failure;
  return html;
}

const liquidImage = (image: { url: string; width: number | null; height: number | null; altText: string | null } | null) =>
  image ? { src: image.url, width: image.width ?? 1200, height: image.height ?? 800, aspect_ratio: (image.width ?? 3) / (image.height ?? 2), alt: image.altText ?? "" } : null;
const liquidProduct = (ref: Ref) => ({
  title: ref.title,
  handle: ref.handle,
  url: `/products/${ref.handle}`,
  description: "<p>A product.</p>",
  featured_image: liquidImage({ url: `https://cdn.shopify.com/s/files/${ref.handle}.jpg`, width: 1000, height: 1000, altText: null }),
  images: [1, 2, 3, 4].map((n) => liquidImage({ url: `https://cdn.shopify.com/s/files/${ref.handle}-${n}.jpg`, width: 1000, height: 1000, altText: null })),
});
const liquidCollection = (ref: Ref) => ({ title: ref.title, handle: ref.handle, url: `/collections/${ref.handle}`, image: null, products: [] });

function richHtml(value: unknown): string {
  try {
    const root = JSON.parse(String(value)) as { children?: { children?: { value?: string }[] }[] };
    return (root.children ?? []).map((paragraph) => `<p>${(paragraph.children ?? []).map((node) => node.value ?? "").join("")}</p>`).join("");
  } catch {
    return "";
  }
}

/** Builder values → what Shopify hands the theme section, as `settingsFor` maps them. */
function toLiquid(fields: readonly Field[], values: Settings, defaults: Settings): Settings {
  const out: Settings = { ...defaults };
  for (const field of fields) {
    if (field.nextOnly || field.kind === "blocks" || field.kind === "design") continue;
    const id = snake(field.key);
    const value = values[field.key];
    switch (field.kind) {
      case "link": {
        const link = value as { label?: string; href?: string } | null;
        out[`${id}_label`] = link?.label ?? "";
        out[`${id}_url`] = link?.href || null;
        break;
      }
      case "richText":
        out[id] = value ? richHtml(value) : "";
        break;
      case "image":
        out[id] = liquidImage(value as never);
        break;
      case "video": {
        const match = /v=([\w-]+)/.exec(String(value ?? ""));
        out[id] = value ? { type: "youtube", id: match?.[1] ?? "aqz-KE-bpKQ" } : null;
        break;
      }
      case "product":
        out[id] = value ? liquidProduct(value as Ref) : null;
        break;
      case "products":
        out[id] = ((value as Ref[] | null) ?? []).map(liquidProduct);
        break;
      case "collection":
        out[id] = value ? liquidCollection(value as Ref) : null;
        break;
      case "collections":
        out[id] = ((value as Ref[] | null) ?? []).map(liquidCollection);
        break;
      case "url":
        out[id] = value || null;
        break;
      case "imageList":
        break; // no theme setting
      default:
        out[id] = value;
    }
  }
  return out;
}

type ThemeSchema = { settings?: { id?: string; type: string; default?: unknown }[]; blocks?: { type: string; settings?: { id?: string; type: string; default?: unknown }[] }[] };
const themeDefaults = (settings: ThemeSchema["settings"]) =>
  Object.fromEntries(
    (settings ?? [])
      .filter((setting) => setting.id)
      .map((setting) => [setting.id, setting.default ?? (setting.type === "checkbox" ? false : setting.type === "range" ? 0 : setting.type === "select" ? "" : null)]),
  );

async function renderLiquid(file: string, fields: readonly Field[], settings: Settings): Promise<string> {
  const { source, schema } = theme(file);
  const blocksField = fields.find((field) => field.kind === "blocks");
  const blocks = blocksField
    ? ((settings[blocksField.key] as { id: string; type: string; settings: Settings }[]) ?? []).map((block) => {
        const definition = blocksField.blocks!.find((candidate) => candidate.type === block.type)!;
        const schemaBlock = schema.blocks?.find((candidate) => candidate.type === block.type);
        return {
          id: block.id,
          type: block.type,
          shopify_attributes: "",
          settings: toLiquid(definition.fields, block.settings, themeDefaults(schemaBlock?.settings)),
        };
      })
    : [];
  return engine.parseAndRender(source, {
    section: { id: "audit", index: 1, settings: toLiquid(fields, settings, themeDefaults(schema.settings)), blocks, shopify_attributes: "" },
    request: { design_mode: false },
    page: {},
    pages: {},
  });
}

const themes = new Map<string, { source: string; schema: ThemeSchema }>();
function theme(file: string) {
  if (!themes.has(file)) {
    const source = fs.readFileSync(path.join(THEME, "sections", `${file}.liquid`), "utf8");
    const schema = JSON.parse(source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/)![1]!) as ThemeSchema;
    themes.set(file, { source: stripComments(source), schema });
  }
  return themes.get(file)!;
}

/* -------------------------------------------------------------------------- *
 * Run
 * -------------------------------------------------------------------------- */

let RENDERERS: Record<string, { load?: (settings: Settings) => Promise<unknown>; render: (settings: Settings, data: unknown, context: unknown) => React.ReactElement | null }>;
const loaded = new Map<string, unknown>();

/**
 * Behaviour that looks like "does nothing" from the HTML alone but is right — each
 * checked by hand, with the reason. Shown under "Explained", not counted.
 */
const EXPLAINED: { section: string; field: RegExp; where?: "Next" | "Liquid"; problem?: RegExp; why: string }[] = [
  { section: "*", field: /Each arrow moves|Change slides automatically|Seconds per slide/, why: "used by the carousel's script in the browser, not in the page's HTML" },
  { section: "slideshow", field: /Change between slides/, where: "Next", why: "the sideways slide is chosen in the browser (it respects “reduce motion”)" },
  { section: "*", field: /^Placement$/, why: "decides whether the section sits inside the Page heading above it — a page-level pairing" },
  { section: "*", field: /Video address|→ Video → Video$/, where: "Next", why: "nothing is loaded from YouTube/Vimeo until the visitor presses play (privacy, speed)" },
  { section: "faq", field: /^Category$/, why: "a filter on the FAQ entries, not text that is shown" },
  { section: "instagram", field: /Fallback images/, why: "shown only when the Instagram feed cannot be reached" },
  { section: "*", field: /Show at most|How many/, problem: /look the same/, why: "a limit: the lowest one changes the page; the highest equals the default because the store holds fewer entries" },
  { section: "collection_grid", field: /^Collections$/, why: "the store's signature collections are the same as the listed ones" },
  { section: "testimonials", field: /Show a “show more” button/, why: "needs its link too — the form says so" },
  { section: "testimonials", field: /Heading alignment/, why: "that preset has no heading" },
  { section: "custom_section", field: /Second button style/, why: "styles the second button, which the example leaves empty" },
  { section: "custom_section", field: /Heading level|Width on tablets/, why: "“Auto” resolves to the option it was compared with" },
  { section: "slideshow", field: /Slide → Darkening$/, why: "a slide's own darkening starts at the slider's 30%" },
  { section: "multicolumn", field: /Column → Icon$|^Media$/, why: "icons fill only the columns without an image, and the example columns have images — the scenario at the end checks columns without one" },
];
const explained = (finding: { section: string; field: string; where: string; problem: string }) =>
  EXPLAINED.find(
    (rule) =>
      (rule.section === "*" || rule.section === finding.section) &&
      rule.field.test(finding.field) &&
      (!rule.where || rule.where === finding.where) &&
      (!rule.problem || rule.problem.test(finding.problem)),
  );

type Finding = { where: "Next" | "Liquid"; section: string; field: string; problem: string; presets: Set<string> };
const findings = new Map<string, Finding>();
function report(where: Finding["where"], section: string, field: string, problem: string, preset: string) {
  const key = `${where}|${section}|${field}|${problem}`;
  const found = findings.get(key) ?? { where, section, field, problem, presets: new Set() };
  found.presets.add(preset);
  findings.set(key, found);
}

async function storeRefs(): Promise<{ products: Ref[]; collections: Ref[] }> {
  try {
    const response = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${process.env.SHOPIFY_API_VERSION ?? "2026-07"}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "" },
      body: JSON.stringify({ query: "{ products(first: 30) { nodes { id handle title images(first: 5) { nodes { id } } } } collections(first: 3) { nodes { id handle title } } }" }),
    });
    const body = (await response.json()) as {
      data: { products: { nodes: (Ref & { images: { nodes: unknown[] } })[] }; collections: { nodes: Ref[] } };
    };
    // Products with the most photographs first: "Photographs shown" has nothing to show on a one-photo product.
    const products = [...body.data.products.nodes]
      .sort((a, b) => b.images.nodes.length - a.images.nodes.length)
      .slice(0, 4)
      .map(({ id, handle, title }) => ({ id, handle, title }));
    return { products, collections: body.data.collections.nodes };
  } catch {
    console.warn("! could not read products from the store — product fields are skipped");
    return { products: [], collections: [] };
  }
}

async function main() {
  RENDERERS = (await load("components/page-builder/renderers.tsx")).RENDERERS;
  const { SECTIONS } = await load("lib/page-builder/registry.ts");
  const { SECTION_PRESETS, sectionFromPreset } = await load("lib/page-builder/presets.ts");
  const { withExamples, blockWithExamples } = await load("lib/page-builder/examples.ts");
  const { createBlock } = await load("lib/page-builder/fields.ts");
  const { LIQUID_SECTIONS } = await load("scripts/lib/liquid.ts");
  const { STYLE_KEYS } = await load("lib/page-builder/define-section.ts");
  const skip = new Set<string>([...SKIP_KEYS, ...(STYLE_KEYS as string[])]);
  const refs = await storeRefs();
  const media = { images: [auditImage("example"), auditImage("example"), auditImage("example")], products: refs.products, collections: refs.collections };

  let tried = 0;
  for (const preset of SECTION_PRESETS as { id: string; type: string }[]) {
    if (only && !only.has(preset.type)) continue;
    const definition = SECTIONS[preset.type] as { fields: readonly Field[] };
    const fields = definition.fields.filter((field) => !skip.has(field.key));
    const liquidFile = LIQUID_SECTIONS[preset.type] as string | undefined;
    const base = withVideo(fields, withExamples(sectionFromPreset(preset), media).settings as Settings) as Settings;

    /** What a `when` just revealed gets example content too — an empty photograph shows no darkening. */
    const examplesFor = (settings: Settings) =>
      Object.assign(settings, withExamples({ id: "audit", type: preset.type, visible: true, settings }, media).settings);

    /** Draws settings on both storefronts and records what went wrong. */
    const draw = async (settings: Settings, field: string) => {
      const out: { next: string | null; liquid: string | null } = { next: null, liquid: null };
      try {
        out.next = await renderNext(preset.type, settings);
      } catch (error) {
        report("Next", preset.type, field, `crashes: ${String((error as Error).message).slice(0, 120)}`, preset.id);
      }
      if (liquidFile) {
        try {
          out.liquid = await renderLiquid(liquidFile, fields, settings);
        } catch (error) {
          report("Liquid", preset.type, field, `crashes: ${String((error as Error).message).slice(0, 120)}`, preset.id);
        }
      }
      return out;
    };

    const judge = async (
      label: string,
      field: Field,
      setup: (settings: Settings) => void,
      apply: (settings: Settings, value: unknown) => void,
      current: (settings: Settings) => unknown,
    ) => {
      const before = structuredClone(base);
      setup(before);
      const shown = await draw(before, label);
      const list = attempts(field, current(before), refs, `${preset.type}-${label}`);
      const unchanged: { next: string[]; liquid: string[] } = { next: [], liquid: [] };
      for (const attempt of list) {
        tried += 1;
        const after = structuredClone(before);
        apply(after, attempt.value);
        const drawn = await draw(after, label);
        for (const where of ["next", "liquid"] as const) {
          if (where === "liquid" && (!liquidFile || field.nextOnly || field.kind === "imageList" || field.kind === "design")) continue;
          const html = drawn[where];
          if (html === null || shown[where] === null) continue;
          const name = where === "next" ? "Next" : "Liquid";
          if (attempt.marker) {
            if (!html.includes(attempt.marker)) report(name, preset.type, label, `${attempt.label} is set but does not appear`, preset.id);
          } else if (html === shown[where]) unchanged[where].push(attempt.label);
        }
      }
      for (const where of ["next", "liquid"] as const) {
        const options = list.filter((attempt) => !attempt.marker).length;
        if (!unchanged[where].length || !options) continue;
        const name = where === "next" ? "Next" : "Liquid";
        if (unchanged[where].length === options) report(name, preset.type, label, "changing it changes nothing", preset.id);
        else report(name, preset.type, label, `${unchanged[where].join(", ")} look the same as “${String(current(before))}”`, preset.id);
      }
    };

    for (const field of fields) {
      if (field.kind === "blocks") {
        for (const blockDef of field.blocks ?? []) {
          const blockFields = blockDef.fields;
          for (const blockField of blockFields) {
            const label = `${field.label} → ${blockDef.label} → ${blockField.label}`;
            // The first block of this kind — or one added, as the editor's "Add" would.
            const indexIn = (settings: Settings) => {
              const list = settings[field.key] as { type: string }[];
              let index = list.findIndex((block) => block.type === blockDef.type);
              if (index < 0) {
                list.push(withVideo(blockDef.fields, blockWithExamples(blockDef, createBlock(blockDef), media)));
                index = list.length - 1;
              }
              return index;
            };
            const blockOf = (settings: Settings) => (settings[field.key] as { settings: Settings }[])[indexIn(settings)]!.settings;
            await judge(
              label,
              blockField,
              (settings) => {
                reveal(field, settings, fields, settings, fields);
                reveal(blockField, blockOf(settings), blockFields, settings, fields);
                examplesFor(settings);
              },
              (settings, value) => void (blockOf(settings)[blockField.key] = value),
              (settings) => blockOf(settings)[blockField.key],
            );
          }
        }
        continue;
      }
      await judge(
        field.label,
        field,
        (settings) => {
          reveal(field, settings, fields, settings, fields);
          examplesFor(settings);
        },
        (settings, value) => void (settings[field.key] = value),
        (settings) => settings[field.key],
      );
    }
  }

  /* Scenarios the generic pass cannot set up on its own */
  if (!only || only.has("multicolumn")) {
    const preset = (SECTION_PRESETS as { id: string; type: string }[]).find((candidate) => candidate.id === "multicolumn.icons")!;
    const settings = sectionFromPreset(preset).settings as Settings;
    const columns = settings.columns as { settings: Settings }[];
    for (const column of columns) column.settings.image = null;
    const multicolumnFields = (SECTIONS.multicolumn as { fields: readonly Field[] }).fields;
    const next = await renderNext("multicolumn", settings);
    const liquid = await renderLiquid("sb-multicolumn", multicolumnFields, settings);
    // The icons draw as inline SVG; four columns, four icons.
    if ((next.match(/<svg/g) ?? []).length < columns.length) report("Next", "multicolumn", "Columns → Column → Icon (no image)", "icons do not show in columns without an image", preset.id);
    if ((liquid.match(/<svg/g) ?? []).length < columns.length) report("Liquid", "multicolumn", "Columns → Column → Icon (no image)", "icons do not show in columns without an image", preset.id);
    tried += 1;
  }

  /* The report, worst first, grouped by section */
  const every = [...findings.values()];
  const all = every.filter((finding) => finding.problem.startsWith("crashes") || !explained(finding));
  const reasons = every.filter((finding) => !all.includes(finding));
  const rank = (finding: Finding) => (finding.problem.startsWith("crashes") ? 0 : finding.problem.includes("does not appear") ? 1 : finding.problem.includes("changes nothing") ? 2 : 3);
  all.sort((a, b) => rank(a) - rank(b) || a.section.localeCompare(b.section) || a.field.localeCompare(b.field));
  const presetCount = (type: string) => (SECTION_PRESETS as { type: string }[]).filter((preset) => preset.type === type).length;
  const json = all.map((finding) => ({ ...finding, presets: [...finding.presets], everyPreset: finding.presets.size === presetCount(finding.section) }));
  fs.writeFileSync(path.join(ROOT, ".audit-page-builder.json"), JSON.stringify(json, null, 2));
  for (const finding of all) {
    const scope = finding.presets.size === presetCount(finding.section) ? "every preset" : [...finding.presets].join(", ");
    console.log(`${["✗✗", "✗ ", "! ", "· "][rank(finding)]} [${finding.where}] ${finding.section} · ${finding.field}: ${finding.problem}  (${scope})`);
  }
  if (reasons.length) {
    console.log("\nExplained (checked, behaving as designed):");
    for (const finding of reasons) console.log(`   [${finding.where}] ${finding.section} · ${finding.field} — ${explained(finding)!.why}`);
  }
  console.log(`\n${tried} changes tried. ${all.filter((finding) => rank(finding) < 3).length} problems, ${all.filter((finding) => rank(finding) === 3).length} notes. Full list: .audit-page-builder.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
