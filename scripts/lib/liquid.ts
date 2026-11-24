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
 *   design → the most-used part of it, desktop and phone, as `d_*` settings under
 *   headers (scripts/lib/liquid-design.ts), read by the generated `sb-design`
 *   snippet that `sb-section-style` renders. A `design` field marked `nextOnly` (a
 *   slide's) produces nothing.
 */

import { STYLE_KEYS } from "../../lib/page-builder/define-section";
import type { FieldDef, LeafFieldDef } from "../../lib/page-builder/fields";
import { SECTION_PRESETS, type PresetBlock } from "../../lib/page-builder/presets";
import { SECTIONS, type SectionType } from "../../lib/page-builder/registry";
import { TEMPLATE_SECTIONS } from "../../lib/page-builder/sections-template";
import type { TemplateKind } from "../../lib/page-builder/template-kinds";
import { MAX_POPUP_BLOCKS, POPUP_BLOCKS, POPUP_FIELDS } from "../../lib/theme-builder/promo";

import { designSettings, themeDesignParts } from "./liquid-design";

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
  custom_section: "sb-custom",
  // Website → Templates: each template section has its theme twin, `sb-t-<type>`.
  ...(Object.fromEntries(
    TEMPLATE_SECTIONS.map((definition) => [definition.type, `sb-t-${definition.type.replace(/_/g, "-")}`]),
  ) as Partial<Record<SectionType, string>>),
};

/**
 * Where a template's sections may be added in the theme editor (`enabled_on`): the
 * Shopify template that draws the same pages. Shop All is the `all` collection, so the
 * collection templates (`collection.shop.json` holds its layout); the projects list is
 * a page (`page.projects-list.json`).
 */
export const TEMPLATE_THEME_TEMPLATES: Record<TemplateKind, string> = {
  product: "product",
  collection: "collection",
  // Shopify's `enabled_on` names metaobject templates only as a whole.
  project: "metaobject",
  designer: "metaobject",
  shop: "collection",
  search: "search",
  collections: "list-collections",
  projects: "page",
};

export const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * The Style tab's theme settings. A section passes `settings: section.settings` to
 * `sb-section-style`, which reads all of them — so the parity check counts them as
 * read when the section renders that snippet.
 */
export const STYLE_SETTING_IDS: readonly string[] = STYLE_KEYS.filter((key) => key !== "design").map(snake);
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
  // Next only for now — see `nextOnly` in lib/page-builder/fields.ts.
  if (field.nextOnly) return [];
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
function settingsList(fields: readonly FieldDef[], type: SectionType): Json[] {
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
    out.push(
      ...(field.key in UNIVERSAL
        ? [UNIVERSAL[field.key]!(field)]
        : field.kind === "design"
          ? designSettings(themeDesignParts(type))
          : settingsFor(field)),
    );
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

/** Shopify allows a section name of at most 25 characters; these are shortened in the theme. */
const THEME_NAMES: Partial<Record<SectionType, string>> = {
  collection_in_context: "Projects with collection",
};

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
    name: THEME_NAMES[type] ?? definition.label,
    tag: "section",
    class: `sb-section-${type.replace(/_/g, "-")}`,
    settings: settingsList(fields, type),
    ...(definition.template ? { enabled_on: { templates: [TEMPLATE_THEME_TEMPLATES[definition.template]] } } : {}),
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
    // A template's section has no ready-made variants; one preset lets it be added
    // back in the theme editor after it was removed.
    presets: definition.template && presets.length === 0 ? [{ name: definition.label }] : presets,
  };
}

export const SCHEMA_PATTERN = /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/;

export function schemaBlock(type: SectionType): string {
  return `{% schema %}\n${JSON.stringify(schemaFor(type), null, 2)}\n{% endschema %}`;
}

/* -------------------------------------------------------------------------- *
 * Pop-ups (Appearance → Pop-ups) — sections/sb-popup.liquid
 * -------------------------------------------------------------------------- */

export const POPUP_FILE = "sb-popup";

/**
 * The theme's pop-up: one section per pop-up, in the `overlay-group` section group.
 * Its settings are the panel's (`POPUP_FIELDS` in lib/theme-builder/promo.ts) run
 * through the same field → setting table, then what a pop-up holds beside its
 * settings in Next — its size and space inside (`box`, desktop's value here), its
 * dates, the pages it shows on and the devices — as plain settings. "Build it
 * yourself" blocks are the Custom section's blocks plus the newsletter sign-up.
 */
export function popupSchema(): Json {
  const settings: Json[] = [];
  let group: string | undefined = "content";
  for (const field of POPUP_FIELDS as readonly FieldDef[]) {
    if (field.kind === "blocks" || field.kind === "design") continue;
    const next = field.group ?? "content";
    if (next !== group) {
      settings.push({ type: "header", content: GROUP_HEADER[next as keyof typeof GROUP_HEADER] });
      group = next;
    }
    settings.push(...settingsFor(field as LeafFieldDef));
  }
  settings.push(
    { type: "header", content: "Size and space" },
    { type: "range", id: "custom_width", label: "Custom width", min: 240, max: 1200, step: 12, unit: "px", default: 560, info: "When Size is Custom." },
    { type: "range", id: "padding", label: "Space inside", min: 0, max: 200, step: 2, unit: "px", default: 32 },
    { type: "range", id: "radius", label: "Rounded corners", min: 0, max: 48, step: 1, unit: "px", default: 0 },
    { type: "header", content: "When and where" },
    { type: "text", id: "starts_at", label: "Show from", placeholder: "2026-12-01 09:00", info: "Optional. The visitor's own clock." },
    { type: "text", id: "ends_at", label: "Show until", placeholder: "2026-12-24 23:59", info: "Optional." },
    {
      type: "select",
      id: "pages",
      label: "Pages",
      options: [
        { value: "all", label: "Every page" },
        { value: "home", label: "The home page only" },
        { value: "only", label: "Only the pages listed" },
        { value: "except", label: "Every page but those listed" },
      ],
      default: "all",
    },
    { type: "textarea", id: "paths", label: "Pages listed", placeholder: "/our-story\n/collections/*", info: "One address per line. /collections/* covers every page under /collections." },
    {
      type: "select",
      id: "hide_on",
      label: "Show on",
      options: [
        { value: "none", label: "All devices" },
        { value: "mobile", label: "Desktop only" },
        { value: "desktop", label: "Mobile only" },
      ],
      default: "none",
    },
  );
  return {
    name: "Pop-up",
    tag: "section",
    class: "sb-section-popup",
    settings,
    max_blocks: MAX_POPUP_BLOCKS,
    blocks: POPUP_BLOCKS.map((block) => ({
      type: block.type,
      name: block.label,
      settings: block.fields.flatMap((field) => settingsFor(field)),
    })),
    enabled_on: { groups: ["custom.overlay"] },
    presets: [{ name: "Pop-up", settings: { heading: "Join our newsletter", text: "New collections and projects, a few times a year.", newsletter: true } }],
  };
}

export function popupSchemaBlock(): string {
  return `{% schema %}\n${JSON.stringify(popupSchema(), null, 2)}\n{% endschema %}`;
}
