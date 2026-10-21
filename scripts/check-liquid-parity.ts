/**
 * Keeps the Liquid theme in step with the Next page builder.
 *
 *   yarn check:liquid
 *
 * Every page-builder section that has a theme counterpart is listed in
 * `LIQUID_SECTIONS`. For each one, the settings the theme section MUST have are
 * derived from the Next definition (`lib/page-builder/sections*.ts`) — same
 * ids (snake_case), same kinds, same select options and defaults, same ranges,
 * same block types, same presets — and the theme's `{% schema %}` is checked
 * against them. Change a section in Next and this fails until the theme
 * follows; that is the point.
 *
 * Also checks that the icon snippet matches the Next icon set, and that every
 * snippet a section renders exists.
 *
 * How a Next field becomes a theme setting:
 *   text → text · textarea → textarea · richText → richtext · image → image_picker
 *   link → `<id>_label` (text) + `<id>_url` (url) · url → url · video → video_url
 *   select → select · toggle → checkbox · number → range · product → product
 *   blocks → the section's blocks, one per block type, `max_blocks` = max
 *   universal surface / rhythm / hideOn → `surface` / `rhythm` / `hide_on`
 *   (rhythm's `default` is the theme's `theme`).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FieldDef, LeafFieldDef } from "../lib/page-builder/fields";
import { SECTION_PRESETS } from "../lib/page-builder/presets";
import { SECTIONS, type SectionType } from "../lib/page-builder/registry";

import { LIQUID_SECTIONS, STYLE_SETTING_IDS, STYLE_SNIPPET } from "./lib/liquid";

const ROOT = resolve(__dirname, "..");

/**
 * Sections whose theme version predates the builder and keeps its own schema;
 * only the settings named here are required to exist (the newer layout options).
 */
const PARTIAL: Partial<Record<SectionType, { file: string; settings: string[] }>> = {
  media_text: {
    file: "sb-media-text",
    settings: ["eyebrow", "image_width", "vertical_align", "link_style", "image_ratio", ...STYLE_SETTING_IDS],
  },
};

type Setting = {
  type: string;
  id?: string;
  options?: { value: string }[];
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
};
type Schema = {
  name: string;
  settings?: Setting[];
  blocks?: { type: string; name: string; settings?: Setting[] }[];
  max_blocks?: number;
  presets?: { name: string }[];
};

let failures = 0;
const problems: string[] = [];
function check(label: string, ok: boolean, detail?: string) {
  if (!ok) {
    failures += 1;
    problems.push(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
  return ok;
}

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** Every setting a schema declares must be READ by the markup, or a builder option would do nothing in the theme. */
function markupReadsEverySetting(file: string, schema: Schema) {
  const source = readFileSync(resolve(ROOT, "theme/sections", `${file}.liquid`), "utf8").replace(/\{%-?\s*schema[\s\S]*$/, "");
  const ids = [
    ...(schema.settings ?? []).filter((setting) => setting.id).map((setting) => setting.id!),
    ...(schema.blocks ?? []).flatMap((block) => (block.settings ?? []).filter((setting) => setting.id).map((setting) => setting.id!)),
  ];
  // The Style tab's settings are read by one snippet, handed the whole settings object.
  const styled = new RegExp(`render\\s+'${STYLE_SNIPPET}',\\s*settings:\\s*(section\\.settings|s)\\b`).test(source);
  for (const id of new Set(ids)) {
    if (styled && STYLE_SETTING_IDS.includes(id)) continue;
    check(`${file}: the markup reads "${id}"`, new RegExp(`\\.${id}\\b`).test(source), "a setting the theme offers but never uses");
  }
}

function schemaOf(file: string): Schema | null {
  const path = resolve(ROOT, "theme/sections", `${file}.liquid`);
  if (!existsSync(path)) return null;
  const source = readFileSync(path, "utf8");
  const match = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!match) return null;
  return JSON.parse(match[1]!) as Schema;
}

/** What one Next field must look like in the theme, as one or two settings. */
function expected(field: LeafFieldDef): { id: string; type: string; field: LeafFieldDef }[] {
  const id = snake(field.key);
  switch (field.kind) {
    case "text":
      return [{ id, type: "text", field }];
    case "textarea":
      return [{ id, type: "textarea", field }];
    case "richText":
      return [{ id, type: "richtext", field }];
    case "image":
      return [{ id, type: "image_picker", field }];
    case "link":
      return [
        { id: `${id}_label`, type: "text", field },
        { id: `${id}_url`, type: "url", field },
      ];
    case "url":
      return [{ id, type: "url", field }];
    case "video":
      return [{ id, type: "video_url", field }];
    case "select":
      return [{ id, type: "select", field }];
    case "toggle":
      return [{ id, type: "checkbox", field }];
    case "number":
      return [{ id, type: "range", field }];
    case "color":
      return [{ id, type: "color", field }];
    case "product":
      return [{ id, type: "product", field }];
    case "products":
      return [{ id, type: "product_list", field }];
    case "collection":
      return [{ id, type: "collection", field }];
    case "collections":
      return [{ id, type: "collection_list", field }];
    default:
      return [];
  }
}

function compare(where: string, settings: Setting[], fields: readonly FieldDef[]) {
  const byId = new Map(settings.filter((s) => s.id).map((s) => [s.id!, s]));
  for (const field of fields) {
    if (field.kind === "blocks") continue;
    for (const want of expected(field)) {
      const got = byId.get(want.id);
      if (!check(`${where}: setting "${want.id}"`, Boolean(got), "missing")) continue;
      check(`${where}: "${want.id}" is a ${want.type}`, got!.type === want.type, `is ${got!.type}`);

      const f = want.field;
      if (f.kind === "select") {
        const values = (got!.options ?? []).map((option) => option.value).join("|");
        const wanted = f.options.map((option) => option.value).join("|");
        check(`${where}: "${want.id}" offers the same options`, values === wanted, `theme ${values} · next ${wanted}`);
        check(`${where}: "${want.id}" has the same default`, got!.default === f.default, `theme ${String(got!.default)} · next ${f.default}`);
      }
      if (f.kind === "toggle") {
        check(`${where}: "${want.id}" has the same default`, (got!.default ?? false) === f.default, `theme ${String(got!.default)} · next ${f.default}`);
      }
      if (f.kind === "number") {
        check(
          `${where}: "${want.id}" has the same range`,
          got!.min === f.min && got!.max === f.max && got!.default === f.default,
          `theme ${got!.min}–${got!.max} (${String(got!.default)}) · next ${f.min}–${f.max} (${f.default})`,
        );
        const steps = got!.step ? (f.max - f.min) / got!.step : Infinity;
        check(`${where}: "${want.id}" range has at most 101 steps (a Shopify limit)`, steps <= 101);
      }
      if ((f.kind === "text" || f.kind === "textarea") && f.default && want.type !== "url") {
        check(`${where}: "${want.id}" has the same default`, got!.default === f.default, `theme ${String(got!.default)} · next ${f.default}`);
      }
    }
  }
}

const UNIVERSAL: Record<string, { id: string; values: string; fallback: string }> = {
  surface: { id: "surface", values: "inherit|light|dark|olive|blue|mocha|black", fallback: "inherit" },
  rhythm: { id: "rhythm", values: "theme|xs|sm|md|lg|xl", fallback: "theme" },
  hideOn: { id: "hide_on", values: "none|mobile|desktop", fallback: "none" },
};

for (const [type, file] of Object.entries(LIQUID_SECTIONS) as [SectionType, string][]) {
  const definition = SECTIONS[type];
  const schema = schemaOf(file);
  if (!check(`${type}: theme/sections/${file}.liquid exists with a {% schema %}`, schema !== null)) continue;
  const where = `${file}`;
  const settings = schema!.settings ?? [];

  compare(where, settings, definition.fields.filter((field) => !(field.key in UNIVERSAL)));

  // Universal settings the Next form offers must be offered here too.
  for (const key of Object.keys(UNIVERSAL)) {
    const shown = definition.fields.some((field) => field.key === key);
    const want = UNIVERSAL[key]!;
    const got = settings.find((setting) => setting.id === want.id);
    if (!shown) {
      check(`${where}: does not offer "${want.id}" (the Next form does not)`, !got);
      continue;
    }
    if (!check(`${where}: universal setting "${want.id}"`, Boolean(got), "missing")) continue;
    check(
      `${where}: "${want.id}" offers the universal options`,
      (got!.options ?? []).map((option) => option.value).join("|") === want.values,
    );
    check(`${where}: "${want.id}" defaults to ${want.fallback}`, got!.default === want.fallback);
  }

  // Blocks.
  const blocksField = definition.fields.find((field) => field.kind === "blocks");
  if (blocksField && blocksField.kind === "blocks") {
    check(`${where}: max_blocks = ${blocksField.max}`, schema!.max_blocks === blocksField.max, `is ${schema!.max_blocks}`);
    for (const block of blocksField.blocks) {
      const got = schema!.blocks?.find((candidate) => candidate.type === block.type);
      if (!check(`${where}: block "${block.type}"`, Boolean(got), "missing")) continue;
      compare(`${where} › ${block.type}`, got!.settings ?? [], block.fields);
    }
    const extra = (schema!.blocks ?? []).filter((candidate) => !blocksField.blocks.some((block) => block.type === candidate.type));
    check(`${where}: no block types Next does not have`, extra.length === 0, extra.map((block) => block.type).join(", "));
  } else {
    check(`${where}: no blocks (Next has none)`, !schema!.blocks?.length);
  }

  markupReadsEverySetting(file, schema!);

  // Presets: the same names Add section offers.
  const names = new Set((schema!.presets ?? []).map((preset) => preset.name));
  for (const preset of SECTION_PRESETS.filter((candidate) => candidate.type === type)) {
    check(`${where}: preset "${preset.label}"`, names.has(preset.label), "missing");
  }
}

for (const [type, partial] of Object.entries(PARTIAL) as [SectionType, { file: string; settings: string[] }][]) {
  const schema = schemaOf(partial.file);
  if (!check(`${type}: theme/sections/${partial.file}.liquid exists`, schema !== null)) continue;
  for (const id of partial.settings) {
    check(`${partial.file}: setting "${id}"`, (schema!.settings ?? []).some((setting) => setting.id === id), "missing");
  }
  // Its Style tab settings exist only if the snippet that reads them is rendered.
  if (partial.settings.some((id) => STYLE_SETTING_IDS.includes(id))) {
    const source = readFileSync(resolve(ROOT, "theme/sections", `${partial.file}.liquid`), "utf8");
    check(`${partial.file}: renders "${STYLE_SNIPPET}"`, source.includes(`render '${STYLE_SNIPPET}', settings: s`));
  }
}

// Every rendered snippet exists.
for (const file of [...Object.values(LIQUID_SECTIONS), ...Object.values(PARTIAL).map((partial) => partial!.file)]) {
  const path = resolve(ROOT, "theme/sections", `${file}.liquid`);
  if (!existsSync(path)) continue;
  for (const [, name] of readFileSync(path, "utf8").matchAll(/render\s+'([a-z0-9-]+)'/g)) {
    check(`${file}: renders snippet "${name}"`, existsSync(resolve(ROOT, "theme/snippets", `${name}.liquid`)), "missing");
  }
}

// The schemas are generated from the Next definitions.
try {
  execFileSync(process.execPath, [resolve(ROOT, "node_modules/tsx/dist/cli.mjs"), resolve(ROOT, "scripts/generate-liquid-schemas.ts"), "--check"], {
    stdio: "pipe",
  });
} catch (error) {
  check("every theme section schema matches the page builder", false, String((error as { stderr?: Buffer }).stderr ?? "").trim() || "run: yarn liquid:schemas");
}

// The icon snippet is generated from the Next icon set.
try {
  execFileSync(process.execPath, [resolve(ROOT, "node_modules/tsx/dist/cli.mjs"), resolve(ROOT, "scripts/generate-liquid-icons.tsx"), "--check"], {
    stdio: "pipe",
  });
} catch {
  check("theme/snippets/sb-section-icon.liquid matches lib/page-builder/icons.ts", false, "run: yarn liquid:icons");
}

const count = Object.keys(LIQUID_SECTIONS).length + Object.keys(PARTIAL).length;
if (failures) {
  console.log(problems.join("\n"));
  console.log(`\n${failures} parity problem(s) across ${count} sections.`);
  process.exit(1);
}
console.log(`✓ ${count} sections: the Liquid theme matches the page builder.`);
