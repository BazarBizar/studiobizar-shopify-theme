import { z } from "zod";

import { designSchema, readDesign, SHADOWS, type DesignValue, type Device, type Responsive, type ShadowId } from "@/lib/page-builder/design";
import {
  fieldDefault,
  fieldSchema,
  HEX_COLOR,
  lenientFieldSchema,
  link,
  newBlockId,
  number,
  select,
  text,
  textarea,
  toggle,
  type LeafFieldDef,
  type LinkValue,
} from "@/lib/page-builder/fields";

/**
 * THE THEME LAYOUT — the site's header and footer, as the Theme Builder edits them.
 *
 * Built from ELEMENTS (a logo, a menu, search, the inquiry bag, a line of text …)
 * placed in ZONES (left, centre, right; or footer columns). The header has two
 * arrangements — desktop (1024px and up) and mobile — because a phone header is a
 * different composition, not a squeezed one. Every element can also be hidden per
 * device.
 *
 * Element settings are written in the page builder's own field vocabulary
 * (`lib/page-builder/fields.ts`), so the editor draws them with the same controls and
 * the write API validates them with the same schemas. Looks reuse the design value
 * (`lib/page-builder/design.ts`) for typography.
 *
 * STORED as JSON shop metafields, three copies like a page's (published / draft /
 * previous) — see `lib/admin/theme-builder.ts`. Until something is PUBLISHED the
 * storefront draws its original header and footer: the Theme Builder changes nothing
 * a visitor sees until someone presses Publish. `DEFAULT_LAYOUT` reproduces that
 * original, so the first edit starts from what is on the site.
 *
 * NO React and no `server-only` — the editor, the API and the storefront import it.
 * Next only for now: the Liquid theme does not read it yet (by decision).
 */

export const THEME_LAYOUT_VERSION = 1;
export const MAX_THEME_BYTES = 120 * 1024;

/* -------------------------------------------------------------------------- *
 * Elements
 * -------------------------------------------------------------------------- */

/** The site's menus, by the key `lib/navigation.ts` gives them. */
export const MENU_CHOICES = [
  { value: "primary", label: "Main menu" },
  { value: "secondary", label: "Second menu" },
  { value: "footerAbout", label: "Footer — About" },
  { value: "footerInfo", label: "Footer — Info" },
  { value: "footerLegal", label: "Footer — Legal" },
] as const;

export type MenuKey = (typeof MENU_CHOICES)[number]["value"];

const BUTTON_STYLES = [
  { value: "solid", label: "Filled" },
  { value: "outline", label: "Outlined" },
  { value: "text", label: "Underlined text" },
] as const;

type ElementDef = {
  label: string;
  /** One line in "Add element". */
  description: string;
  /** Where it may be placed. */
  places: readonly ("header" | "footer")[];
  fields: readonly LeafFieldDef[];
};

export const ELEMENTS = {
  logo: {
    label: "Logo",
    description: "The Studio Bizar name or symbol, linking home.",
    places: ["header", "footer"],
    fields: [
      select("variant", "Show", [
        { value: "full", label: "Name" },
        { value: "mark", label: "Symbol" },
      ]),
      number("height", "Height (px)", { min: 12, max: 160, default: 20 }),
      number("mobileHeight", "Height on phones (px)", { min: 0, max: 160, default: 0, help: "0 uses the height above." }),
    ],
  },
  menu: {
    label: "Menu",
    description: "One of the site's menus — edited under Menus.",
    places: ["header", "footer"],
    fields: [
      select("menu", "Which menu", MENU_CHOICES),
      text("title", "Heading above the links", { max: 60, help: "Optional — footer columns show it above the links." }),
      select("direction", "Links", [
        { value: "row", label: "Side by side" },
        { value: "column", label: "One under another" },
      ]),
      select("size", "Link size", [
        { value: "secondary", label: "Standard" },
        { value: "tertiary", label: "Small" },
      ]),
      number("linkGap", "Space between links (px)", { min: 0, max: 120, default: 36 }),
      toggle("dropdowns", "Show sub-links in a dropdown", { default: true }),
    ],
  },
  search: { label: "Search", description: "Opens the search.", places: ["header"], fields: [] },
  account: { label: "Account", description: "Sign in, or the customer's account.", places: ["header"], fields: [] },
  cart: { label: "Inquiry bag", description: "The inquiry list, with how many pieces are in it.", places: ["header"], fields: [] },
  language: { label: "Language", description: "The language switch.", places: ["header", "footer"], fields: [] },
  menuToggle: {
    label: "Menu button",
    description: "Opens the full menu on phones and tablets.",
    places: ["header"],
    fields: [],
  },
  social: {
    label: "Social links",
    description: "Instagram and the others — set under Site-wide.",
    places: ["header", "footer"],
    fields: [],
  },
  text: {
    label: "Text",
    description: "A line of text, typed here or taken from Site-wide.",
    places: ["header", "footer"],
    fields: [
      select("source", "Text", [
        { value: "typed", label: "Typed here" },
        { value: "tagline", label: "Footer tagline (Site-wide)" },
        { value: "region", label: "Footer bottom line (Site-wide)" },
      ]),
      textarea("text", "Text", { max: 300, when: { field: "source", is: ["typed"] } }),
      link("link", "Link", { help: "Optional — makes the text a link.", when: { field: "source", is: ["typed"] } }),
      select("size", "Size", [
        { value: "secondary", label: "Standard" },
        { value: "tertiary", label: "Small" },
        { value: "caption", label: "Very small" },
      ]),
    ],
  },
  button: {
    label: "Button",
    description: "A link drawn as the site's button.",
    places: ["header", "footer"],
    fields: [link("link", "Button", { required: true }), select("style", "Style", BUTTON_STYLES, { default: "outline" })],
  },
  newsletter: {
    label: "Newsletter sign-up",
    description: "The email field, with its invitation.",
    places: ["footer"],
    fields: [
      textarea("text", "Invitation", { max: 300, help: "Empty uses the newsletter text under Site-wide." }),
    ],
  },
  copyright: {
    label: "Copyright",
    description: "© and the year, which updates itself.",
    places: ["footer"],
    fields: [text("text", "Text", { max: 120, default: "© {year} Studio Bizar", help: "{year} becomes the current year." })],
  },
} as const satisfies Record<string, ElementDef>;

export type ElementType = keyof typeof ELEMENTS;
export const ELEMENT_TYPES = Object.keys(ELEMENTS) as ElementType[];

export type ThemeElement = {
  id: string;
  type: ElementType;
  settings: Record<string, unknown>;
  /** Hidden on these devices. */
  hide?: Partial<Record<Device, boolean>>;
  /** Space before it in its zone or column, px — the zone's own spacing when absent. */
  spaceBefore?: number;
};

export const MAX_SPACE_BEFORE = 240;

export function createElement(type: ElementType, settings: Record<string, unknown> = {}): ThemeElement {
  const fields = ELEMENTS[type].fields as readonly LeafFieldDef[];
  return {
    id: newBlockId(),
    type,
    settings: { ...Object.fromEntries(fields.map((field) => [field.key, fieldDefault(field)])), ...settings },
  };
}

/* -------------------------------------------------------------------------- *
 * The layout
 * -------------------------------------------------------------------------- */

export const ZONES = ["left", "center", "right"] as const;
export type Zone = (typeof ZONES)[number];
export type Zones = Record<Zone, ThemeElement[]>;

export type HeaderLayout = {
  announcement: {
    enabled: boolean;
    text: string;
    link: LinkValue | null;
    /** `#rrggbb`, "" for the brand's off-black / earth. */
    background: string;
    color: string;
    hide?: Partial<Record<Device, boolean>>;
  };
  /** Stays at the top while the page scrolls. */
  sticky: boolean;
  /** 1024px and wider. */
  desktop: Zones;
  /** Narrower than 1024px. */
  mobile: Zones;
  style: {
    /** "" = the page's own ground, as the original header. */
    background: string;
    color: string;
    border: boolean;
    borderColor: string;
    shadow: ShadowId;
    /** Space above and below the bar, px. */
    paddingY: Responsive<number>;
    /** Space between elements in a zone, px. */
    gap: number;
    dropdownBackground: string;
    dropdownColor: string;
    /** Typography of the menu links and text. */
    design: DesignValue;
    /**
     * Over the top of the page: no background of its own until the page scrolls, so a
     * photograph at the top runs up behind it. `overColor` is its text then.
     */
    transparent: boolean;
    overColor: string;
    /** Less space above and below once the page has scrolled. */
    shrink: boolean;
    /** A shadow once the page has scrolled. */
    scrollShadow: boolean;
  };
};

export type FooterColumn = { id: string; elements: ThemeElement[] };

export type FooterLayout = {
  columns: FooterColumn[];
  bottom: Zones;
  style: {
    /** "" = the page's footer ground (olive on most pages), as the original footer. */
    background: string;
    color: string;
    paddingTop: Responsive<number>;
    paddingBottom: Responsive<number>;
    /** Space between columns, px. */
    columnGap: number;
    border: boolean;
    borderColor: string;
    /** On phones: columns one under another, or two side by side. */
    mobileColumns: "one" | "two";
    design: DesignValue;
  };
};

/**
 * SITE STYLE — what every page starts from, Elementor's "Global Fonts / Colors":
 * typography for headings, text and buttons across the whole site (a section's own
 * design still overrides it), and a palette of saved colours offered in every colour
 * picker. Empty changes nothing.
 */
export type SavedColour = { id: string; name: string; value: string };

export type GlobalStyle = {
  design: DesignValue;
  colors: SavedColour[];
};

export const MAX_SAVED_COLOURS = 12;

export type ThemeMeta = {
  revision: number;
  savedAt: string | null;
  savedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type ThemeLayoutContent = { header: HeaderLayout; footer: FooterLayout; global: GlobalStyle };
export type ThemeLayout = ThemeLayoutContent & { version: number; meta: ThemeMeta };

export const MAX_ELEMENTS_PER_ZONE = 12;
export const MAX_FOOTER_COLUMNS = 5;

/* -------------------------------------------------------------------------- *
 * Default — what the site shows today
 * -------------------------------------------------------------------------- */

/** The original header and footer, element for element. A fresh copy each call (new ids). */
export function defaultLayoutContent(): ThemeLayoutContent {
  const menu = (key: MenuKey, extra: Record<string, unknown> = {}) => createElement("menu", { menu: key, ...extra });
  return {
    header: {
      announcement: { enabled: false, text: "", link: null, background: "", color: "" },
      sticky: true,
      // Spacing as the original header measures: 52px logo → menu, 36px between its
      // links; 20px between the second menu's, 69px to the icons, 16px between those.
      desktop: {
        left: [createElement("logo"), { ...menu("primary", { dropdowns: false }), spaceBefore: 52 }],
        center: [],
        right: [
          menu("secondary", { linkGap: 20, size: "tertiary" }),
          { ...createElement("language"), spaceBefore: 69 },
          { ...createElement("account"), spaceBefore: 16 },
          { ...createElement("search"), spaceBefore: 16 },
          { ...createElement("cart"), spaceBefore: 16 },
        ],
      },
      mobile: {
        // 16px tall on phones, as the original; 20 from 750px.
        left: [createElement("logo", { mobileHeight: 16 })],
        center: [],
        right: [
          createElement("language"),
          { ...createElement("account"), spaceBefore: 12 },
          { ...createElement("search"), spaceBefore: 12 },
          { ...createElement("cart"), spaceBefore: 12 },
          { ...createElement("menuToggle"), spaceBefore: 16 },
        ],
      },
      style: {
        background: "",
        color: "",
        border: false,
        borderColor: "",
        shadow: "none",
        paddingY: { d: 20 },
        gap: 36,
        dropdownBackground: "",
        dropdownColor: "",
        design: {},
        transparent: false,
        overColor: "",
        shrink: false,
        scrollShadow: false,
      },
    },
    footer: {
      columns: [
        {
          id: newBlockId(),
          elements: [
            createElement("logo", { variant: "mark", height: 90 }),
            createElement("text", { source: "tagline", size: "caption" }),
            { ...createElement("newsletter"), spaceBefore: 74 },
          ],
        },
        { id: newBlockId(), elements: [menu("footerAbout", { title: "About", direction: "column" })] },
        { id: newBlockId(), elements: [menu("footerInfo", { title: "Info", direction: "column" })] },
        { id: newBlockId(), elements: [menu("footerLegal", { title: "Legal", direction: "column" })] },
        { id: newBlockId(), elements: [createElement("social")] },
      ],
      bottom: {
        left: [],
        center: [createElement("text", { source: "region", size: "tertiary" }), createElement("copyright")],
        right: [],
      },
      style: {
        background: "",
        color: "",
        paddingTop: { d: 48 },
        paddingBottom: { d: 16 },
        columnGap: 197,
        border: false,
        borderColor: "",
        mobileColumns: "one",
        design: {},
      },
    },
    global: { design: {}, colors: [] },
  };
}

export const EMPTY_META: ThemeMeta = { revision: 0, savedAt: null, savedBy: null, publishedAt: null, publishedBy: null };

/* -------------------------------------------------------------------------- *
 * Validation — strict for writes, lenient for reads
 * -------------------------------------------------------------------------- */

const ELEMENT_ID = /^b_[a-z0-9]{6,24}$/;
const hex = z.string().refine((value) => value === "" || HEX_COLOR.test(value), "Use a colour like #302f2d.");
const hide = z.strictObject({ d: z.boolean().optional(), t: z.boolean().optional(), m: z.boolean().optional() });
const responsivePx = (max: number) =>
  z.strictObject({
    d: z.number().int().min(0).max(max).optional(),
    t: z.number().int().min(0).max(max).optional(),
    m: z.number().int().min(0).max(max).optional(),
  });

function elementSchema(type: ElementType) {
  const fields = ELEMENTS[type].fields as readonly LeafFieldDef[];
  return z.strictObject({
    id: z.string().regex(ELEMENT_ID),
    type: z.literal(type),
    settings: z.strictObject(Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)]))),
    hide: hide.optional(),
    spaceBefore: z.number().int().min(0).max(MAX_SPACE_BEFORE).optional(),
  });
}

const elementSchemaAny = z.discriminatedUnion(
  "type",
  ELEMENT_TYPES.map(elementSchema) as unknown as [ReturnType<typeof elementSchema>, ...ReturnType<typeof elementSchema>[]],
);

const zone = z.array(elementSchemaAny).max(MAX_ELEMENTS_PER_ZONE);
const zones = z.strictObject({ left: zone, center: zone, right: zone });

const headerSchema = z.strictObject({
  announcement: z.strictObject({
    enabled: z.boolean(),
    text: z.string().max(200),
    link: fieldSchema(link("link", "Link")),
    background: hex,
    color: hex,
    hide: hide.optional(),
  }),
  sticky: z.boolean(),
  desktop: zones,
  mobile: zones,
  style: z.strictObject({
    background: hex,
    color: hex,
    border: z.boolean(),
    borderColor: hex,
    shadow: z.enum(Object.keys(SHADOWS) as [ShadowId, ...ShadowId[]]),
    paddingY: responsivePx(120),
    gap: z.number().int().min(0).max(120),
    dropdownBackground: hex,
    dropdownColor: hex,
    design: designSchema,
    transparent: z.boolean(),
    overColor: hex,
    shrink: z.boolean(),
    scrollShadow: z.boolean(),
  }),
});

const footerSchema = z.strictObject({
  columns: z
    .array(z.strictObject({ id: z.string().regex(ELEMENT_ID), elements: zone }))
    .min(1)
    .max(MAX_FOOTER_COLUMNS),
  bottom: zones,
  style: z.strictObject({
    background: hex,
    color: hex,
    paddingTop: responsivePx(240),
    paddingBottom: responsivePx(240),
    columnGap: z.number().int().min(0).max(320),
    border: z.boolean(),
    borderColor: hex,
    mobileColumns: z.enum(["one", "two"]),
    design: designSchema,
  }),
});

const savedColourSchema = z.strictObject({
  id: z.string().regex(ELEMENT_ID),
  name: z.string().trim().min(1).max(40),
  value: z.string().regex(HEX_COLOR, "Use a colour like #302f2d."),
});

const globalSchema = z.strictObject({
  design: designSchema,
  colors: z.array(savedColourSchema).max(MAX_SAVED_COLOURS),
});

/** What a WRITE must satisfy — the whole content, every value checked. */
export const themeContentSchema = z.strictObject({ header: headerSchema, footer: footerSchema, global: globalSchema });

/** A read element: unknown types dropped, each setting falling back to its default alone. */
function readElement(input: unknown): ThemeElement | null {
  const candidate = input as { id?: unknown; type?: unknown; settings?: unknown; hide?: unknown; spaceBefore?: unknown } | null;
  if (!candidate || typeof candidate.id !== "string" || !ELEMENT_ID.test(candidate.id)) return null;
  if (typeof candidate.type !== "string" || !(candidate.type in ELEMENTS)) return null;
  const type = candidate.type as ElementType;
  const raw = candidate.settings && typeof candidate.settings === "object" ? (candidate.settings as Record<string, unknown>) : {};
  const fields = ELEMENTS[type].fields as readonly LeafFieldDef[];
  const settings = Object.fromEntries(fields.map((field) => [field.key, lenientFieldSchema(field).parse(raw[field.key])]));
  const hidden = hide.safeParse(candidate.hide);
  const space = z.number().int().min(0).max(MAX_SPACE_BEFORE).safeParse(candidate.spaceBefore);
  return {
    id: candidate.id,
    type,
    settings,
    ...(hidden.success && Object.keys(hidden.data).length ? { hide: hidden.data } : {}),
    ...(space.success ? { spaceBefore: space.data } : {}),
  };
}

function readZone(input: unknown, place: "header" | "footer"): ThemeElement[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(readElement)
    .filter((element): element is ThemeElement => element !== null && (ELEMENTS[element.type].places as readonly string[]).includes(place))
    .slice(0, MAX_ELEMENTS_PER_ZONE);
}

function readZones(input: unknown, place: "header" | "footer", fallback: Zones): Zones {
  if (!input || typeof input !== "object") return fallback;
  const value = input as Record<string, unknown>;
  return { left: readZone(value.left, place), center: readZone(value.center, place), right: readZone(value.right, place) };
}

/** Each part kept or replaced by its default on its own — one damaged value costs that value. */
function pick<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

/**
 * What a READ goes through: never throws, keeps everything that is valid. A layout
 * with one broken element still draws every other one.
 */
export function readThemeContent(input: unknown): ThemeLayoutContent {
  const base = defaultLayoutContent();
  const value = (input && typeof input === "object" ? input : {}) as { header?: unknown; footer?: unknown; global?: unknown };
  const header = (value.header && typeof value.header === "object" ? value.header : {}) as Record<string, unknown>;
  const footer = (value.footer && typeof value.footer === "object" ? value.footer : {}) as Record<string, unknown>;
  const headerStyle = (header.style && typeof header.style === "object" ? header.style : {}) as Record<string, unknown>;
  const footerStyle = (footer.style && typeof footer.style === "object" ? footer.style : {}) as Record<string, unknown>;

  const styleOf = <S extends Record<string, unknown>>(schema: z.ZodObject, raw: Record<string, unknown>, fallback: S): S =>
    Object.fromEntries(
      Object.entries(fallback).map(([key, defaultValue]) => {
        if (key === "design") return [key, readDesign(raw[key])];
        const shape = schema.shape[key] as z.ZodType | undefined;
        return [key, shape ? pick(shape, raw[key], defaultValue) : defaultValue];
      }),
    ) as S;

  const columns = Array.isArray(footer.columns)
    ? footer.columns
        .map((column) => {
          const candidate = column as { id?: unknown; elements?: unknown } | null;
          return candidate && typeof candidate.id === "string" && ELEMENT_ID.test(candidate.id)
            ? { id: candidate.id, elements: readZone(candidate.elements, "footer") }
            : null;
        })
        .filter((column): column is FooterColumn => column !== null)
        .slice(0, MAX_FOOTER_COLUMNS)
    : [];

  const global = (value.global && typeof value.global === "object" ? value.global : {}) as { design?: unknown; colors?: unknown };
  const colors = Array.isArray(global.colors)
    ? global.colors
        .map((colour) => savedColourSchema.safeParse(colour))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
        .slice(0, MAX_SAVED_COLOURS)
    : [];

  return {
    global: { design: readDesign(global.design), colors },
    header: {
      announcement: pick(headerSchema.shape.announcement as z.ZodType<HeaderLayout["announcement"]>, header.announcement, base.header.announcement),
      sticky: pick(z.boolean(), header.sticky, base.header.sticky),
      desktop: readZones(header.desktop, "header", base.header.desktop),
      mobile: readZones(header.mobile, "header", base.header.mobile),
      style: styleOf(headerSchema.shape.style, headerStyle, base.header.style),
    },
    footer: {
      columns: columns.length ? columns : base.footer.columns,
      bottom: readZones(footer.bottom, "footer", base.footer.bottom),
      style: styleOf(footerSchema.shape.style, footerStyle, base.footer.style),
    },
  };
}

export type ThemeParse =
  | { ok: true; layout: ThemeLayout }
  | { ok: false; reason: "absent" | "invalid" };

/** A stored layout (a metafield's JSON string) → the layout, or why there is none. */
export function parseThemeLayout(raw: string | null | undefined): ThemeParse {
  if (!raw) return { ok: false, reason: "absent" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!value || typeof value !== "object" || !("header" in value) || !("footer" in value)) {
    return { ok: false, reason: "invalid" };
  }
  const meta = pick(
    z.strictObject({
      revision: z.number().int().min(0),
      savedAt: z.string().nullable(),
      savedBy: z.string().nullable(),
      publishedAt: z.string().nullable(),
      publishedBy: z.string().nullable(),
    }),
    (value as { meta?: unknown }).meta,
    EMPTY_META,
  );
  return { ok: true, layout: { version: THEME_LAYOUT_VERSION, ...readThemeContent(value), meta } };
}

/** Same content, ignoring meta — for "are there unpublished changes". */
export function sameThemeContent(a: ThemeLayoutContent | null, b: ThemeLayoutContent | null): boolean {
  if (!a || !b) return a === b;
  const content = (layout: ThemeLayoutContent) => JSON.stringify({ header: layout.header, footer: layout.footer, global: layout.global });
  return content(a) === content(b);
}

/** The menus a layout uses, so the storefront fetches only those. */
export function menusIn(content: ThemeLayoutContent): MenuKey[] {
  const all = [
    ...ZONES.flatMap((zone) => [...content.header.desktop[zone], ...content.header.mobile[zone], ...content.footer.bottom[zone]]),
    ...content.footer.columns.flatMap((column) => column.elements),
  ];
  return [...new Set(all.filter((element) => element.type === "menu").map((element) => element.settings.menu as MenuKey))];
}
