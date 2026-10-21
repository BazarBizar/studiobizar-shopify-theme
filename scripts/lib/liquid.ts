/**
 * The page builder → Liquid theme bridge: which theme section draws which
 * builder section, and the `{% schema %}` each one must carry — DERIVED from
 * the Next definition (`lib/page-builder/sections*.ts`) and its presets
 * (`lib/page-builder/presets.ts`), never written by hand.
 *
 * Used by `scripts/generate-liquid-schemas.ts` (writes the schemas) and
 * `scripts/check-liquid-parity.ts` (fails when a theme file is out of step).
 *
 * How a Next field becomes a theme setting (ids in snake_case):
 *   text → text · textarea → textarea · richText → richtext · image → image_picker
 *   link → `<id>_label` (text) + `<id>_url` (url) · url → url · video → video_url
 *   select → select · toggle → checkbox · number → range · product → product
 *   blocks → the section's blocks, `max_blocks` = the field's max
 *   color → color
 *   universal surface / rhythm / hideOn → `surface` / `rhythm` / `hide_on`
 *   (rhythm's `default` is `theme` in the theme, as in every other theme section).
 *   The Style tab (spacing, lines, colours) → the same settings, snake_case, read
 *   by the `sb-section-style` snippet — see `STYLE_SETTING_IDS`.
 */

import { STYLE_KEYS } from "../../lib/page-builder/define-section";
import type { FieldDef, LeafFieldDef } from "../../lib/page-builder/fields";
import { SECTION_PRESETS, type PresetBlock } from "../../lib/page-builder/presets";
import { SECTIONS, type SectionType } from "../../lib/page-builder/registry";

/** Page-builder type → theme section file (theme/sections/<file>.liquid). */
export const LIQUID_SECTIONS: Partial<Record<SectionType, string>> = {
  image_banner: "sb-banner",
  slideshow: "sb-slideshow",
  cta_banner: "sb-cta-banner",
  multicolumn: "sb-multicolumn",
  stats: "sb-stats",
  steps: "sb-steps",
  tabs: "sb-tabs",
  collapsible: "sb-collapsible",
  video: "sb-video",
  marquee: "sb-marquee",
  collage: "sb-collage",
  testimonials: "sb-testimonials",
  logo_list: "sb-logo-list",
  featured_product: "sb-featured-product",
  spacer: "sb-spacer",
  newsletter: "sb-newsletter",
};

export const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * The Style tab's theme settings. A section passes `settings: section.settings` to
 * `sb-section-style`, which reads all of them — so the parity check counts them as
 * read when the section renders that snippet.
 */
export const STYLE_SETTING_IDS: readonly string[] = STYLE_KEYS.map(snake);
export const STYLE_SNIPPET = "sb-section-style";

type Json = Record<string, unknown>;

/** Theme labels for the universal settings, worded as the builder words them. */
const UNIVERSAL: Record<string, (field: FieldDef) => Json> = {
  surface: (field) => ({
    type: "select",
    id: "surface",
    label: "Background",
    options: (field as unknown as { options: { value: string; label: string }[] }).options,
    default: "inherit",
  }),
  rhythm: (field) => ({
    type: "select",
    id: "rhythm",
    label: "Vertical spacing",
    options: (field as unknown as { options: { value: string; label: string }[] }).options.map((option) =>
      option.value === "default" ? { value: "theme", label: option.label } : option,
    ),
    default: "theme",
  }),
  hideOn: (field) => ({
    type: "select",
    id: "hide_on",
    label: "Show on",
    options: (field as unknown as { options: { value: string; label: string }[] }).options,
    default: "none",
  }),
};

const info = (field: { help?: string }) => (field.help ? { info: field.help } : {});

/** One Next leaf field → its theme setting(s). */
export function settingsFor(field: LeafFieldDef): Json[] {
  const id = snake(field.key);
  switch (field.kind) {
    case "text":
      return [{ type: "text", id, label: field.label, ...(field.default ? { default: field.default } : {}), ...info(field) }];
    case "textarea":
      return [{ type: "textarea", id, label: field.label, ...(field.default ? { default: field.default } : {}), ...info(field) }];
    case "richText":
      return [{ type: "richtext", id, label: field.label, ...info(field) }];
    case "image":
      return [{ type: "image_picker", id, label: field.label, ...info(field) }];
    case "link":
      return [
        { type: "text", id: `${id}_label`, label: `${field.label} text`, ...info(field) },
        { type: "url", id: `${id}_url`, label: `${field.label} link` },
      ];
    case "url":
      return [{ type: "url", id, label: field.label, ...info(field) }];
    case "video":
      return [{ type: "video_url", id, label: field.label, accept: ["youtube", "vimeo"], ...info(field) }];
    case "select":
      return [{ type: "select", id, label: field.label, options: field.options, default: field.default, ...info(field) }];
    case "toggle":
      return [{ type: "checkbox", id, label: field.label, default: field.default, ...info(field) }];
    case "number": {
      const step = Math.max(1, Math.ceil((field.max - field.min) / 100));
      return [
        {
          type: "range",
          id,
          label: field.label.replace(/\s*\((%|px)\)$/, ""),
          min: field.min,
          max: field.max,
          step,
          ...(/\(%\)$/.test(field.label)
            ? { unit: "%" }
            : /\(px\)$/.test(field.label)
              ? { unit: "px" }
              : /seconds/i.test(field.label)
                ? { unit: "s" }
                : {}),
          default: field.default,
          ...info(field),
        },
      ];
    }
    case "color":
      return [{ type: "color", id, label: field.label, ...info(field) }];
    case "product":
      return [{ type: "product", id, label: field.label, ...info(field) }];
    case "products":
      return [{ type: "product_list", id, label: field.label, limit: field.max, ...info(field) }];
    case "collection":
      return [{ type: "collection", id, label: field.label, ...info(field) }];
    case "collections":
      return [{ type: "collection_list", id, label: field.label, limit: field.max, ...info(field) }];
    default:
      return [];
  }
}

const GROUP_ORDER = { content: 0, layout: 1, style: 2, advanced: 3 } as const;
const GROUP_HEADER = { content: "Content", layout: "Layout", style: "Style", advanced: "Advanced" } as const;

/**
 * Fields grouped as the builder's form groups them — content, then Layout, then
 * Advanced, each under a header — keeping form order within a group.
 */
function settingsList(fields: readonly FieldDef[]): Json[] {
  const out: Json[] = [];
  let group: string | undefined = "content";
  const ordered = [...fields].sort((a, b) => GROUP_ORDER[a.group ?? "content"] - GROUP_ORDER[b.group ?? "content"]);
  for (const field of ordered) {
    if (field.kind === "blocks") continue;
    const next = field.group ?? "content";
    if (next !== group) {
      out.push({ type: "header", content: GROUP_HEADER[next] });
      group = next;
    }
    out.push(...(field.key in UNIVERSAL ? [UNIVERSAL[field.key]!(field)] : settingsFor(field)));
  }
  return out;
}

/** A rich text value from a preset (Shopify's AST) → the HTML a richtext setting holds. */
function richTextHtml(value: string): string {
  try {
    const root = JSON.parse(value) as { children?: { children?: { value?: string }[] }[] };
    const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return (root.children ?? [])
      .map((paragraph) => `<p>${escape((paragraph.children ?? []).map((node) => node.value ?? "").join(""))}</p>`)
      .join("");
  } catch {
    return "";
  }
}

/** A preset's builder values → theme setting values, for the given field list. */
function presetSettings(fields: readonly FieldDef[], values: Record<string, unknown>): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find((candidate) => candidate.key === key);
    if (!field || field.kind === "blocks") continue;
    const id = key in UNIVERSAL ? (UNIVERSAL[key]!(field).id as string) : snake(key);
    switch (field.kind) {
      case "link": {
        const link = value as { label?: string; href?: string } | null;
        if (link?.label) out[`${id}_label`] = link.label;
        if (link?.href) out[`${id}_url`] = link.href;
        break;
      }
      case "richText":
        if (typeof value === "string" && value) out[id] = richTextHtml(value);
        break;
      case "image":
      case "product":
      case "products":
      case "collection":
      case "collections":
        break; // never pre-filled — the store's own photographs and products belong there
      default:
        if (key === "rhythm" && value === "default") out[id] = "theme";
        else out[id] = value;
    }
  }
  return out;
}

/** The `{% schema %}` a theme section must carry for a builder section. */
export function schemaFor(type: SectionType): Json {
  const definition = SECTIONS[type];
  const fields = definition.fields as readonly FieldDef[];
  const blocksField = fields.find((field) => field.kind === "blocks");

  const presets = SECTION_PRESETS.filter((preset) => preset.type === type).map((preset) => {
    const values = preset.settings ?? {};
    const settings = presetSettings(fields, values);
    const blockValues = blocksField ? (values[blocksField.key] as PresetBlock[] | undefined) : undefined;
    const blocks =
      blocksField && blocksField.kind === "blocks"
        ? (blockValues ?? blocksField.defaults.map((blockType): PresetBlock => ({ type: blockType }))).map((item) => {
            const blockDef = blocksField.blocks.find((candidate) => candidate.type === item.type)!;
            const blockSettings = presetSettings(blockDef.fields, item.settings ?? {});
            return Object.keys(blockSettings).length ? { type: item.type, settings: blockSettings } : { type: item.type };
          })
        : undefined;
    return {
      name: preset.label,
      ...(Object.keys(settings).length ? { settings } : {}),
      ...(blocks?.length ? { blocks } : {}),
    };
  });

  return {
    name: definition.label,
    tag: "section",
    class: `sb-section-${type.replace(/_/g, "-")}`,
    settings: settingsList(fields),
    ...(blocksField && blocksField.kind === "blocks"
      ? {
          max_blocks: blocksField.max,
          blocks: blocksField.blocks.map((block) => ({
            type: block.type,
            name: block.label,
            settings: block.fields.flatMap((field) => settingsFor(field)),
          })),
        }
      : {}),
    presets,
  };
}

export const SCHEMA_PATTERN = /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/;

export function schemaBlock(type: SectionType): string {
  return `{% schema %}\n${JSON.stringify(schemaFor(type), null, 2)}\n{% endschema %}`;
}
