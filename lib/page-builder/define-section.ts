import { z } from "zod";

import {
  blockProblems,
  color,
  fieldDefault,
  fieldSchema,
  isFieldActive,
  isFieldFilled,
  lenientFieldSchema,
  number,
  select,
  toggle,
  type FieldDef,
  type SettingsOf,
} from "./fields";

/**
 * One section type, declared once.
 *
 * `defineSection` takes the developer's field list and returns everything the
 * three consumers need — the panel's form, the write API's validation, the
 * storefront's tolerant read — so a section can never have a form that allows
 * what the API refuses, or an API that accepts what the storefront cannot draw.
 */

/* -------------------------------------------------------------------------- *
 * The settings every section gets
 * -------------------------------------------------------------------------- */

/**
 * The same three controls the Liquid sections carry (`docs/theme/page-building.md`):
 * a ground, a vertical rhythm, and visibility per device. They map one-to-one
 * onto what `globals.css` already defines — `data-surface` and `section-*` — so
 * the builder cannot produce a colour or a spacing the design system lacks.
 *
 * `inherit` is the default ground for the reason the theme doc gives: a band that
 * forces a colour onto a page that already has one is the commonest way a
 * composed page ends up looking wrong.
 */
export const SURFACE_OPTIONS = [
  { value: "inherit", label: "Same as page" },
  { value: "light", label: "Earth" },
  { value: "dark", label: "Dark wood" },
  { value: "olive", label: "Black olive" },
  { value: "blue", label: "Charcoal blue" },
  { value: "mocha", label: "Deep mocha" },
  { value: "black", label: "Off-black" },
] as const;

export const RHYTHM_OPTIONS = [
  { value: "default", label: "Standard" },
  { value: "xs", label: "Extra small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
] as const;

/**
 * Stored as which device the section is HIDDEN on; offered as where it SHOWS — the
 * question an editor actually asks. Named so it cannot be mistaken for the eye
 * button, which hides the section everywhere.
 */
export const HIDE_ON_OPTIONS = [
  { value: "none", label: "All devices" },
  { value: "mobile", label: "Desktop only" },
  { value: "desktop", label: "Mobile only" },
] as const;

const UNIVERSAL_FIELDS = [
  select("surface", "Background", SURFACE_OPTIONS, { group: "style" }),
  // Hidden while Custom spacing is on: the custom numbers replace it, and a
  // control that visibly does nothing is the commonest "spacing is broken" report.
  select("rhythm", "Vertical spacing", RHYTHM_OPTIONS, { group: "style", when: { field: "customSpacing", is: [false] } }),
  select("hideOn", "Show on", HIDE_ON_OPTIONS, { group: "layout" }),
] as const;

export type UniversalKey = (typeof UNIVERSAL_FIELDS)[number]["key"];

/**
 * THE STYLE TAB — spacing, lines and colours, the handful of controls an
 * Elementor user reaches for, on every section. Every default changes nothing,
 * so a page made before these existed looks exactly as it did.
 *
 * Kept narrow on purpose: px within fixed ranges, `#rrggbb` colours, a line on
 * named sides. `SectionFrame` (Next) and `sb-section-style` (Liquid) turn them
 * into the same inline style, and `globals.css` / `sb-theme.css` hold the rule
 * that lets the custom padding REPLACE a section's own band padding rather than
 * add to it.
 */
export const BORDER_OPTIONS = [
  { value: "none", label: "No line" },
  { value: "all", label: "Box around" },
  { value: "top", label: "Line above" },
  { value: "bottom", label: "Line below" },
  { value: "y", label: "Lines above and below" },
] as const;

const SPACING = { group: "style", when: { field: "customSpacing", is: [true] } } as const;
const LINED = { group: "style", when: { field: "border", is: ["all", "top", "bottom", "y"] } } as const;

const STYLE_FIELDS = [
  color("bgColor", "Background colour", { group: "style", help: "Overrides the background above. Leave empty to use it." }),
  color("textColor", "Text colour", { group: "style", help: "Headings, text and buttons in this section." }),
  toggle("customSpacing", "Custom spacing", {
    group: "style",
    help: "Set the space inside and around this section yourself, in pixels. Replaces Vertical spacing.",
  }),
  number("paddingTop", "Space inside, top (px)", { ...SPACING, min: 0, max: 200, default: 64 }),
  number("paddingBottom", "Space inside, bottom (px)", { ...SPACING, min: 0, max: 200, default: 64 }),
  number("marginTop", "Space above the section (px)", { ...SPACING, min: 0, max: 200, default: 0 }),
  number("marginBottom", "Space below the section (px)", { ...SPACING, min: 0, max: 200, default: 0 }),
  select("border", "Line", BORDER_OPTIONS, { group: "style" }),
  number("borderWidth", "Line thickness (px)", { ...LINED, min: 1, max: 10, default: 1 }),
  color("borderColor", "Line colour", { ...LINED, help: "Leave empty for a soft line in the text colour." }),
  number("radius", "Rounded corners (px)", { group: "style", min: 0, max: 48, default: 0 }),
] as const;

export type StyleKey = (typeof STYLE_FIELDS)[number]["key"];
export const STYLE_KEYS: readonly StyleKey[] = STYLE_FIELDS.map((field) => field.key);
export type StyleSettings = SettingsOf<typeof STYLE_FIELDS>;

/** The style a section has when nobody has touched the Style tab. */
/** For sections that paint their own ground: the colour controls would be hidden under it. */
export const OWN_GROUND: readonly StyleKey[] = ["bgColor", "textColor"];

export const NEUTRAL_STYLE: StyleSettings = {
  bgColor: "",
  textColor: "",
  customSpacing: false,
  paddingTop: 64,
  paddingBottom: 64,
  marginTop: 0,
  marginBottom: 0,
  border: "none",
  borderWidth: 1,
  borderColor: "",
  radius: 0,
};

export type UniversalSettings = SettingsOf<typeof UNIVERSAL_FIELDS> & StyleSettings;

/* -------------------------------------------------------------------------- *
 * The definition
 * -------------------------------------------------------------------------- */

export type SectionCategory =
  | "Banners"
  | "Intro"
  | "Text & media"
  | "Images"
  | "Social proof"
  | "Catalogue"
  | "Layout"
  | "Site";

export type SectionDefinition<
  T extends string = string,
  S extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: T;
  label: string;
  /** One line under the label in Add section. */
  description: string;
  category: SectionCategory;
  /** Content fields, then the universal ones this section shows, in form order. */
  fields: readonly FieldDef[];
  /** For the section list: a short label taken from the settings. */
  summary: (settings: S) => string;
  defaults: () => S;
  /** What a write must satisfy. Unknown keys are refused. */
  strict: z.ZodType<S>;
  /** What a read goes through. Never throws — a bad value becomes its default. */
  lenient: (input: unknown) => S;
  /** Required fields that are empty, by label. Empty array = ready to publish. */
  missing: (settings: S) => string[];
  /** Kept for pages that already use it, but no longer offered in Add section. */
  hidden: boolean;
  /**
   * Where the section's content comes from when it is not typed into the section
   * itself — so the form can say "edit it there" instead of leaving the operator
   * hunting for fields that are not here.
   */
  source: (settings: S) => ContentSource | null;
};

/** A screen in the panel that holds what a section shows. */
export type ContentSource = { label: string; href: string };

export function defineSection<
  const T extends string,
  const F extends readonly FieldDef[],
>(definition: {
  type: T;
  label: string;
  description: string;
  category: SectionCategory;
  fields: F;
  /**
   * Which universal settings the form offers. All of them are always STORED and
   * validated — this only decides what the operator sees. The hero paints its own
   * off-black ground, so offering it a background would be offering a control that
   * does nothing.
   */
  universal?: readonly UniversalKey[];
  /**
   * Whether the Style tab's spacing, lines and colours are offered. Stored and
   * validated either way; off only where they would do nothing visible.
   */
  style?: boolean;
  /**
   * Style controls this section cannot show — the colours of a section that paints
   * its own ground edge to edge (a full-bleed image, a band with a fixed surface).
   * Offering them would be offering a control that visibly does nothing.
   */
  omitStyle?: readonly StyleKey[];
  /** The settings key whose value labels the section in the list. */
  summaryKey?: F[number]["key"];
  hidden?: boolean;
  source?: (settings: SettingsOf<F> & UniversalSettings) => ContentSource | null;
}): SectionDefinition<T, SettingsOf<F> & UniversalSettings> {
  type S = SettingsOf<F> & UniversalSettings;

  const shown = new Set<UniversalKey>(definition.universal ?? ["surface", "rhythm", "hideOn"]);
  const all: readonly FieldDef[] = [...definition.fields, ...UNIVERSAL_FIELDS, ...STYLE_FIELDS];
  const visible: readonly FieldDef[] = [
    ...definition.fields,
    ...UNIVERSAL_FIELDS.filter((field) => shown.has(field.key)),
    ...(definition.style === false
      ? []
      : STYLE_FIELDS.filter((field) => !(definition.omitStyle ?? []).includes(field.key))),
  ];

  const strictShape = Object.fromEntries(all.map((field) => [field.key, fieldSchema(field)]));
  const strict = z.strictObject(strictShape) as unknown as z.ZodType<S>;

  const defaults = () => Object.fromEntries(all.map((field) => [field.key, fieldDefault(field)])) as S;

  /**
   * Field by field, so one bad value costs that value and not the section. A
   * section whose image was deleted and whose heading is fine still renders its
   * heading.
   */
  const lenientShape = z.object(Object.fromEntries(all.map((field) => [field.key, lenientFieldSchema(field)])));

  const lenient = (input: unknown): S => {
    const parsed = lenientShape.safeParse(input && typeof input === "object" ? input : {});
    return (parsed.success ? parsed.data : defaults()) as S;
  };

  const missing = (settings: S) => {
    const active = all.filter((field) => isFieldActive(field, settings));
    const empty = active
      .filter((field) => field.required && !isFieldFilled(field, settings[field.key as keyof S]))
      .map((field) => field.label);
    const inBlocks = active.flatMap((field) =>
      field.kind === "blocks" ? blockProblems(field, settings[field.key as keyof S]) : [],
    );
    return [...empty, ...inBlocks];
  };

  const summary = (settings: S) => {
    const value = definition.summaryKey ? settings[definition.summaryKey as keyof S] : null;
    return typeof value === "string" && value.trim() ? value.trim() : "";
  };

  return {
    type: definition.type,
    label: definition.label,
    description: definition.description,
    category: definition.category,
    fields: visible,
    summary,
    defaults,
    strict,
    lenient,
    missing,
    hidden: definition.hidden ?? false,
    source: definition.source ?? (() => null),
  };
}
