/**
 * The page builder's design value (lib/page-builder/design.ts) in the Liquid theme.
 *
 * Decided 2026-10-23: the MOST-USED set, desktop and phone — Shopify's theme editor
 * has no tablet view, and every setting is one flat list:
 *   - typography for headings, text and buttons (font, size, weight, colour, case),
 *     and text alignment where the section has one;
 *   - the buttons' look (colours, under the pointer too, line, corners, space);
 *   - the photographs' shape, corners and zoom;
 *   - shadow, content width and minimum height.
 * Background image/gradient, line height, letter spacing, transparency and per-device
 * spacing stay Next only.
 *
 * ONE TABLE (`CONTROLS`) drives all of it, so nothing can drift:
 *   - the theme settings each section gets (`designSettings`, used by the schema
 *     generator) and the Site style group in config/settings_schema.json;
 *   - `snippets/sb-design.liquid`, generated (`designSnippet`): it writes the SAME
 *     custom properties and `data-sb-*` attributes `designStyle` writes, so the same
 *     CSS (`styles/sb-design.css`, shared by both builds) draws them;
 *   - `themeSettingsFor`, which turns a design value into those settings — what
 *     `check:liquid-render` uses to prove the snippet and `designStyle` agree.
 *
 * Unset is "the design's own value" here too: every setting may be empty (a number
 * setting, not a range, for that reason), and an empty one writes nothing.
 */

import {
  ALIGNMENTS,
  FONT_WEIGHTS,
  FONTS,
  fontStack,
  IMAGE_RATIOS,
  SHADOWS,
  TEXT_TRANSFORMS,
  type DesignValue,
} from "../../lib/page-builder/design-style";
import type { FieldDef } from "../../lib/page-builder/fields";
import { SECTIONS, type SectionType } from "../../lib/page-builder/registry";

type Json = Record<string, unknown>;

export type ThemeDesignPart = "typography" | "align" | "buttons" | "images" | "effects" | "width" | "height";

/** How a setting's value reaches the element — always what `designStyle` would write. */
type Emit =
  /** `--name` (and `--name-m`), listed per device in `attr`. */
  | { as: "value"; name: string; attr: string; format: "px" | "raw" | "font"; skipZero?: boolean }
  | { as: "ratio" }
  | { as: "flag"; attr: string }
  | { as: "shadow" }
  | { as: "valign" };

type Control = {
  /** The theme setting id after the prefix; a phone value adds `_m`. */
  id: string;
  part: ThemeDesignPart;
  /** The header it sits under in the theme editor. */
  header: string;
  label: string;
  input: "number" | "select" | "color" | "checkbox";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** A phone value beside the desktop one. */
  responsive?: boolean;
  /** Where it lives in the design value. */
  path: string[];
  emit: Emit;
  info?: string;
};

const DEFAULT = { value: "default", label: "Default" };

const TYPE_TARGETS = [
  { short: "h", key: "heading", header: "Headings", max: 160 },
  { short: "p", key: "text", header: "Text", max: 48 },
  { short: "b", key: "button", header: "Buttons", max: 32 },
] as const;

const typography: Control[] = TYPE_TARGETS.flatMap(({ short, key, header, max }): Control[] => [
  {
    id: `${short}_font`,
    part: "typography",
    header,
    label: "Font",
    input: "select",
    options: [{ value: "default", label: "Default (Helvetica Neue)" }, ...FONTS.map((font) => ({ value: font.id, label: font.label }))],
    path: [key, "font"],
    emit: { as: "value", name: `--sb-${short}-font`, attr: `data-sb-${short}font`, format: "font" },
  },
  {
    id: `${short}_size`,
    part: "typography",
    header,
    label: "Size (px)",
    input: "number",
    min: 8,
    max,
    responsive: true,
    path: [key, "size"],
    emit: { as: "value", name: `--sb-${short}-size`, attr: `data-sb-${short}size`, format: "px" },
  },
  {
    id: `${short}_weight`,
    part: "typography",
    header,
    label: "Weight",
    input: "select",
    options: [DEFAULT, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))],
    path: [key, "weight"],
    emit: { as: "value", name: `--sb-${short}-weight`, attr: `data-sb-${short}weight`, format: "raw" },
  },
  // A button's colours are under its look, with the line and the pointer.
  ...(short === "b"
    ? []
    : [
        {
          id: `${short}_color`,
          part: "typography" as const,
          header,
          label: "Colour",
          input: "color" as const,
          path: [key, "color"],
          emit: { as: "value" as const, name: `--sb-${short}-color`, attr: `data-sb-${short}color`, format: "raw" as const },
        },
      ]),
  {
    id: `${short}_case`,
    part: "typography",
    header,
    label: "Letter case",
    input: "select",
    options: [DEFAULT, ...TEXT_TRANSFORMS.map((option) => ({ value: option.value, label: option.label }))],
    path: [key, "transform"],
    emit: { as: "value", name: `--sb-${short}-tt`, attr: `data-sb-${short}tt`, format: "raw" },
  },
]);

const align: Control = {
  id: "align",
  part: "align",
  header: "Text",
  label: "Alignment",
  input: "select",
  options: [DEFAULT, ...ALIGNMENTS.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))],
  responsive: true,
  path: ["align"],
  emit: { as: "value", name: "--sb-align", attr: "data-sb-align", format: "raw" },
};

const buttonColour = (id: string, key: string, label: string, short: string): Control => ({
  id: `btn_${id}`,
  part: "buttons",
  header: "Buttons",
  label,
  input: "color",
  path: ["buttonLook", key],
  emit: { as: "value", name: `--sb-btn-${short}`, attr: `data-sb-btn-${short}`, format: "raw" },
});
const buttonSpace = (id: string, key: string, label: string, short: string, max: number, responsive = true): Control => ({
  id: `btn_${id}`,
  part: "buttons",
  header: "Buttons",
  label,
  input: "number",
  min: 0,
  max,
  responsive,
  path: ["buttonLook", key],
  emit: { as: "value", name: `--sb-btn-${short}`, attr: `data-sb-btn-${short}`, format: "px" },
});

const buttons: Control[] = [
  {
    ...buttonColour("bg", "background", "Background", "bg"),
    info: "Filled and outlined buttons take all of these; a text link only its colours.",
  },
  buttonColour("color", "color", "Text colour", "fg"),
  buttonColour("line", "borderColor", "Line colour", "bc"),
  buttonColour("hover_bg", "hoverBackground", "Background under the pointer", "hbg"),
  buttonColour("hover_color", "hoverColor", "Text colour under the pointer", "hfg"),
  {
    ...buttonColour("hover_line", "hoverBorderColor", "Line colour under the pointer", "hbc"),
    info: "Empty: the button keeps its colours and dims slightly.",
  },
  buttonSpace("line_width", "borderWidth", "Line thickness (px)", "bw", 10, false),
  buttonSpace("radius", "radius", "Rounded corners (px)", "r", 100, false),
  buttonSpace("pad_x", "padX", "Space inside, left and right (px)", "px", 120),
  buttonSpace("pad_y", "padY", "Space inside, top and bottom (px)", "py", 60),
  buttonSpace("space_above", "spaceAbove", "Space above the buttons (px)", "mt", 200),
  buttonSpace("gap", "gap", "Space between buttons (px)", "gap", 120),
];

const images: Control[] = [
  {
    id: "img_shape",
    part: "images",
    header: "Photographs",
    label: "Shape",
    input: "select",
    options: [
      { value: "original", label: "As uploaded" },
      ...Object.entries(IMAGE_RATIOS).map(([value, ratio]) => ({ value, label: ratio.label })),
    ],
    path: ["images", "ratio"],
    emit: { as: "ratio" },
  },
  {
    id: "img_radius",
    part: "images",
    header: "Photographs",
    label: "Rounded corners (px)",
    input: "number",
    min: 0,
    max: 120,
    path: ["images", "radius"],
    emit: { as: "value", name: "--sb-imgr", attr: "data-sb-imgr", format: "px", skipZero: true },
  },
  {
    id: "img_zoom",
    part: "images",
    header: "Photographs",
    label: "Zoom in slightly under the pointer",
    input: "checkbox",
    path: ["images", "zoom"],
    emit: { as: "flag", attr: "data-sb-zoom" },
  },
];

const effects: Control = {
  id: "shadow",
  part: "effects",
  header: "Shadow & size",
  label: "Shadow",
  input: "select",
  options: Object.entries(SHADOWS).map(([value, shadow]) => ({ value, label: shadow.label })),
  path: ["shadow"],
  emit: { as: "shadow" },
};

const width: Control = {
  id: "max_width",
  part: "width",
  header: "Shadow & size",
  label: "Content width (px)",
  input: "number",
  min: 320,
  max: 2400,
  responsive: true,
  path: ["maxWidth"],
  emit: { as: "value", name: "--sb-maxw", attr: "data-sb-maxw", format: "px" },
  info: "The widest the content may get. Empty uses the design’s width.",
};

const height: Control[] = [
  {
    id: "min_height",
    part: "height",
    header: "Shadow & size",
    label: "Minimum height (px)",
    input: "number",
    min: 0,
    max: 1600,
    responsive: true,
    path: ["minHeight"],
    emit: { as: "value", name: "--sb-minh", attr: "data-sb-minh", format: "px" },
  },
  {
    id: "valign",
    part: "height",
    header: "Shadow & size",
    label: "Content sits",
    input: "select",
    options: [
      { value: "top", label: "Top" },
      { value: "center", label: "Middle" },
      { value: "bottom", label: "Bottom" },
    ],
    path: ["verticalAlign"],
    emit: { as: "valign" },
    info: "When the section is taller than its content.",
  },
];

export const CONTROLS: readonly Control[] = [...typography, align, ...buttons, ...images, effects, width, ...height];

export const SECTION_PREFIX = "d_";
export const SITE_PREFIX = "site_";
export const DESIGN_SNIPPET = "sb-design";
export const FONT_SNIPPET = "sb-font-faces";
export const FONT_STACK_SNIPPET = "sb-font-stack";

/* -------------------------------------------------------------------------- *
 * Which parts a section offers
 * -------------------------------------------------------------------------- */

/** Sections drawn edge to edge, with no content column for "Content width" to narrow. */
const NO_CONTENT_COLUMN: readonly string[] = ["spacer", "marquee"];
/** Sections with no text of their own: nothing for typography to style. */
const NO_TEXT: readonly string[] = ["spacer"];
/** A banner's or a hero's photograph is its ground, not an image inside it. */
const IMAGE_GROUND_CATEGORIES: readonly string[] = ["Banners", "Intro"];

function walk(fields: readonly FieldDef[], test: (field: FieldDef) => boolean): boolean {
  return fields.some((field) =>
    field.nextOnly ? false : field.kind === "blocks" ? field.blocks.some((block) => walk(block.fields, test)) : test(field),
  );
}

/** The design parts a section's theme twin offers — empty when it has no `design` field. */
export function themeDesignParts(type: SectionType): ThemeDesignPart[] {
  const definition = SECTIONS[type];
  const fields = definition.fields as readonly FieldDef[];
  const design = fields.find((field) => field.kind === "design");
  if (!design || design.nextOnly) return [];
  const parts: ThemeDesignPart[] = [];
  if (!NO_TEXT.includes(type)) {
    parts.push("typography");
    if (definition.textAlign) parts.push("align");
  }
  // A link is drawn as a button; so is a button's label beside a product's own address.
  if (walk(fields, (field) => field.kind === "link" || /button/i.test(field.key))) parts.push("buttons");
  if (
    !IMAGE_GROUND_CATEGORIES.includes(definition.category) &&
    walk(fields, (field) => ["image", "product", "products", "collection", "collections"].includes(field.kind))
  ) {
    parts.push("images");
  }
  parts.push("effects");
  if (!NO_CONTENT_COLUMN.includes(type)) parts.push("width");
  parts.push("height");
  return parts;
}

export const SITE_PARTS: readonly ThemeDesignPart[] = ["typography", "buttons"];

/* -------------------------------------------------------------------------- *
 * Theme settings
 * -------------------------------------------------------------------------- */

const settingOf = (control: Control, prefix: string, phone: boolean): Json => {
  const id = `${prefix}${control.id}${phone ? "_m" : ""}`;
  const label = phone ? control.label.replace(/^(.*?)( \(px\))?$/, "$1 on phones$2") : control.label;
  const info = !phone && control.info ? { info: control.info } : {};
  switch (control.input) {
    case "number":
      return { type: "number", id, label, placeholder: phone ? "Same as desktop" : "Default", ...info };
    case "select":
      return { type: "select", id, label, options: control.options, default: control.options![0]!.value, ...info };
    case "color":
      return { type: "color", id, label, ...info };
    case "checkbox":
      return { type: "checkbox", id, label, default: false, ...info };
  }
};

/** The settings for these parts, under a header per group, in the theme editor's order. */
export function designSettings(parts: readonly ThemeDesignPart[], prefix = SECTION_PREFIX): Json[] {
  if (parts.length === 0) return [];
  const out: Json[] = [
    { type: "paragraph", content: "Design — empty uses the design’s own value. “On phones” is for screens narrower than 750px." },
  ];
  let header = "";
  for (const control of CONTROLS) {
    if (!parts.includes(control.part)) continue;
    if (control.header !== header) {
      header = control.header;
      out.push({ type: "header", content: header });
    }
    out.push(settingOf(control, prefix, false));
    if (control.responsive) out.push(settingOf(control, prefix, true));
  }
  return out;
}

/** Every theme setting id these parts produce. */
export function designSettingIds(parts: readonly ThemeDesignPart[], prefix = SECTION_PREFIX): string[] {
  return designSettings(parts, prefix)
    .map((setting) => setting.id)
    .filter((id): id is string => typeof id === "string");
}

/** The Site style group of config/settings_schema.json. */
export function siteStyleGroup(): Json {
  return { name: "Site style", settings: designSettings(SITE_PARTS, SITE_PREFIX) };
}

/* -------------------------------------------------------------------------- *
 * A design value → theme settings (for the parity test)
 * -------------------------------------------------------------------------- */

const at = (value: unknown, path: readonly string[]) =>
  path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Json)[key] : undefined), value);

/** The theme settings that draw this design value — desktop and phone values only. */
export function themeSettingsFor(value: DesignValue, prefix = SECTION_PREFIX): Json {
  const out: Json = {};
  for (const control of CONTROLS) {
    const raw = at(value, control.path);
    if (raw === undefined) continue;
    const id = `${prefix}${control.id}`;
    if (control.responsive) {
      const responsive = raw as { d?: unknown; m?: unknown };
      if (responsive.d !== undefined) out[id] = responsive.d;
      if (responsive.m !== undefined) out[`${id}_m`] = responsive.m;
    } else {
      out[id] = control.input === "select" ? String(raw) : raw;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * The snippet
 * -------------------------------------------------------------------------- */

/** A Liquid string literal — which has no escapes, so it takes the quote the text does not use. */
const quote = (text: string) => {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  throw new Error(`cannot quote for Liquid: ${text}`);
};

function emitLines(control: Control): string[] {
  const read = (suffix: string) => [`assign k = pre | append: ${quote(control.id + suffix)}`, "assign v = st[k]"];
  const lines: string[] = [];
  const emit = control.emit;
  switch (emit.as) {
    case "value": {
      const devices = control.responsive ? (["", "_m"] as const) : ([""] as const);
      lines.push("assign dev = ''");
      for (const suffix of devices) {
        const name = suffix ? `${emit.name}-m` : emit.name;
        lines.push(...read(suffix));
        const set = control.input === "select" ? "v != blank and v != 'default'" : emit.skipZero ? "v != blank and v > 0" : "v != blank";
        lines.push(`if ${set}`);
        if (emit.format === "px") {
          lines.push(`  assign v = v | at_least: ${control.min} | at_most: ${control.max} | round`);
          lines.push(`  assign css = css | append: '${name}:' | append: v | append: 'px;'`);
        } else if (emit.format === "font") {
          // The family and its fallback come from a snippet of their own (keeps this one simple).
          lines.push(
            "  capture stack",
            `    render '${FONT_STACK_SNIPPET}', id: v`,
            "  endcapture",
            `  assign css = css | append: '${name}:' | append: stack | append: ';'`,
          );
        } else {
          lines.push(`  assign css = css | append: '${name}:' | append: v | append: ';'`);
        }
        lines.push(`  assign dev = dev | append: ' ${suffix ? "m" : "d"}'`, "endif");
      }
      // A value that is not per device carries an empty attribute, as `designStyle` writes it.
      lines.push(
        "if dev != blank",
        ...(control.responsive
          ? ["  assign dev = dev | strip", `  assign attrs = attrs | append: ' ${emit.attr}="' | append: dev | append: '"'`]
          : [`  assign attrs = attrs | append: ' ${emit.attr}'`]),
        "endif",
      );
      if (control.id === "min_height") lines.push("assign tall = dev");
      break;
    }
    case "ratio":
      lines.push(...read(""), "case v");
      for (const [value, ratio] of Object.entries(IMAGE_RATIOS)) {
        lines.push(`  when '${value}'`, `    assign css = css | append: '--sb-ratio:${ratio.css};'`, "    assign attrs = attrs | append: ' data-sb-ratio'");
      }
      lines.push("endcase");
      break;
    case "flag":
      lines.push(...read(""), "if v", `  assign attrs = attrs | append: ' ${emit.attr}'`, "endif");
      break;
    case "shadow":
      lines.push(...read(""), "case v");
      for (const [value, shadow] of Object.entries(SHADOWS)) {
        if (value === "none") continue;
        lines.push(`  when '${value}'`, `    assign css = css | append: 'box-shadow:${shadow.css};'`);
      }
      lines.push("endcase");
      break;
    case "valign":
      lines.push(
        ...read(""),
        "if tall != blank and v != blank and v != 'top'",
        "  assign attrs = attrs | append: ' data-sb-valign=\"' | append: v | append: '\"'",
        "endif",
      );
      break;
  }
  return lines;
}

/** `snippets/sb-font-stack.liquid` — a font id → its CSS stack, as `fontStack` writes it. */
export function fontStackSnippet(): string {
  const cases = FONTS.flatMap((font) => [`    when '${font.id}'`, `      echo ${quote(fontStack(font.id))}`]);
  return [
    "{% comment %}",
    "  GENERATED by `yarn liquid:design` from lib/page-builder/design-style.ts — do not edit.",
    "  A font id from the page builder's list → the CSS stack `fontStack` writes in Next.",
    "{% endcomment %}",
    "{%- liquid",
    "  case id",
    ...cases,
    "  endcase",
    "-%}",
    "",
  ].join("\n");
}

/** `snippets/sb-design.liquid` — generated; see the header of this file. */
export function designSnippet(): string {
  const body = CONTROLS.flatMap((control) => ["", ...emitLines(control)]);
  return `{% comment %}
  GENERATED by \`yarn liquid:design\` from scripts/lib/liquid-design.ts — do not edit.

  The page builder's design value (lib/page-builder/design.ts) for an element: the
  same custom properties and \`data-sb-*\` attributes \`designStyle\` writes in Next,
  drawn by the same rules (styles/sb-design.css, inside sb-theme.css). Desktop and
  phone values; an empty setting writes nothing.

    <div {% render 'sb-design', settings: section.settings %}>
    <body {% render 'sb-design', settings: settings, prefix: 'site_' %}>

  Accepts:
    settings — whose settings (required)
    prefix   — the settings' prefix, default 'd_' (a section's); 'site_' for Site style
    css      — declarations already meant for this element's style attribute,
               merged so there is only one
{% endcomment %}

{%- liquid
  assign st = settings
  assign pre = prefix | default: '${SECTION_PREFIX}'
  assign css = css | default: ''
  assign attrs = ''
  assign tall = ''
${body.map((line) => (line ? `  ${line}` : "")).join("\n")}
-%}

{{- attrs -}}
{%- if css != blank %} style="{{ css | escape }}"{% endif -%}
`;
}
