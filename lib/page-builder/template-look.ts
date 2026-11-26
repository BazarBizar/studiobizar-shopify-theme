import { color, number, select } from "./fields";

/**
 * THE TEMPLATES' LAYOUT CONTROLS — what the landing sections offer in their Content tab
 * (heading size, alignment, columns, image shape, card style, colours, overlay, corners),
 * for the template sections that draw lists of cards, headings, photos and banners.
 *
 * Every default is "As designed" and draws nothing extra, so a template left as it was is
 * still exactly the page its route drew (`yarn check:templates`). The cards' own
 * components are not changed: `lookAttrs` puts data attributes and custom properties on
 * a wrapper, and `styles/sb-template-look.css` restyles the cards inside it.
 */

const AUTO = { value: "auto", label: "As designed" } as const;
const LAYOUT = { group: "layout" } as const;

/* -------------------------------------------------------------------------- *
 * Fields
 * -------------------------------------------------------------------------- */

export const HEADING_SIZES = [
  AUTO,
  { value: "h3", label: "Small" },
  { value: "h2", label: "Standard" },
  { value: "h1", label: "Large" },
  { value: "display", label: "Extra large" },
] as const;

/** The section's own heading: size, colour, alignment. */
export const headingFields = (label = "Heading") =>
  [
    select("headingSize", `${label} size`, HEADING_SIZES, LAYOUT),
    color("headingColor", `${label} colour`, { ...LAYOUT, help: "Leave empty for the section's text colour." }),
    select(
      "headingAlign",
      `${label} alignment`,
      [AUTO, { value: "left", label: "Left" }, { value: "center", label: "Centre" }],
      { ...LAYOUT, display: "buttons" },
    ),
  ] as const;

export const IMAGE_SHAPES = [
  AUTO,
  { value: "portrait", label: "Portrait (3:4)" },
  { value: "tall", label: "Tall (2:3)" },
  { value: "square", label: "Square" },
  { value: "landscape", label: "Landscape (4:3)" },
  { value: "wide", label: "Wide (16:9)" },
] as const;

export const TITLE_SIZES = [
  AUTO,
  { value: "small", label: "Small" },
  { value: "standard", label: "Standard" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
] as const;

/**
 * The cards in a list or a row: their photos, their frame, their names. `columns` only
 * where the cards sit on a grid (a scrolling row has its own "Items across").
 */
export const cardFields = ({
  columns,
  columnsWhen,
  names = true,
}: {
  columns: boolean;
  columnsWhen?: { field: string; is: readonly string[] };
  /** The name's size and colour. Off for collection cards: `collectionTextFields` has them, with the card's other texts. */
  names?: boolean;
}) =>
  [
    ...(columns
      ? ([
          select("columnsDesktop", "Cards across on desktop", [AUTO, ...["2", "3", "4", "5"].map((n) => ({ value: n, label: n }))], {
            ...LAYOUT,
            ...(columnsWhen ? { when: columnsWhen } : {}),
            display: "buttons",
          }),
          select("columnsMobile", "Cards across on phones", [AUTO, { value: "1", label: "1" }, { value: "2", label: "2" }], {
            ...LAYOUT,
            ...(columnsWhen ? { when: columnsWhen } : {}),
            display: "buttons",
          }),
          select(
            "gap",
            "Space between cards",
            [AUTO, { value: "none", label: "None" }, { value: "tight", label: "Tight" }, { value: "roomy", label: "Roomy" }],
            { ...LAYOUT, ...(columnsWhen ? { when: columnsWhen } : {}) },
          ),
        ] as const)
      : ([] as const)),
    select("imageShape", "Photo shape", IMAGE_SHAPES, LAYOUT),
    number("imageRadius", "Photo corners (px)", { ...LAYOUT, min: 0, max: 40, default: 0 }),
    select(
      "imageOverlay",
      "Colour over the photos",
      [{ value: "none", label: "None" }, { value: "color", label: "A colour" }],
      { ...LAYOUT, help: "Tints every photo, so they look alike or text on them reads better." },
    ),
    color("overlayColor", "Overlay colour", { ...LAYOUT, when: { field: "imageOverlay", is: ["color"] }, help: "Empty: black." }),
    number("overlayOpacity", "Overlay strength (%)", { ...LAYOUT, min: 5, max: 90, default: 30, when: { field: "imageOverlay", is: ["color"] } }),
    select(
      "cardStyle",
      "Card style",
      [
        { value: "plain", label: "Plain" },
        { value: "card", label: "On a coloured card" },
        { value: "box", label: "With a border" },
        { value: "lines", label: "Divided by lines" },
      ],
      LAYOUT,
    ),
    color("cardColor", "Card colour", { ...LAYOUT, when: { field: "cardStyle", is: ["card"] }, help: "Empty: a light tint of the text colour." }),
    color("cardBorderColor", "Border colour", { ...LAYOUT, when: { field: "cardStyle", is: ["box", "lines"] }, help: "Empty: a soft line in the text colour." }),
    ...(names
      ? ([
          select("titleSize", "Name size", TITLE_SIZES, LAYOUT),
          color("titleColor", "Name colour", { ...LAYOUT, help: "Leave empty for the section's text colour." }),
        ] as const)
      : ([] as const)),
    select(
      "cardAlign",
      "Text in the cards",
      [AUTO, { value: "left", label: "Left" }, { value: "center", label: "Centre" }],
      { ...LAYOUT, display: "buttons" },
    ),
  ] as const;

/**
 * A collection card's three texts, each with its size and colour — the title on the photo
 * (the collection's name in large letters, or its logo), the collection's name under the
 * photo, and the designer under that. Same four sizes for each, so it stays simple.
 */
const TEXT_SIZES = [
  AUTO,
  { value: "small", label: "Small" },
  { value: "standard", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
] as const;

export const collectionTextFields = () =>
  [
    select("markSize", "Title on the photo — size", TEXT_SIZES, { ...LAYOUT, help: "The collection's name, or its logo, laid over the photo." }),
    color("markColor", "Title on the photo — colour", { ...LAYOUT, help: "Leave empty for the light colour it is designed in." }),
    select("titleSize", "Collection name — size", TEXT_SIZES, { ...LAYOUT, help: "The name under the photo." }),
    color("titleColor", "Collection name — colour", { ...LAYOUT, help: "Leave empty for the section's text colour." }),
    select("bylineSize", "Designer — size", TEXT_SIZES, { ...LAYOUT, help: "“by” and the designer under the name." }),
    color("bylineColor", "Designer — colour", { ...LAYOUT, help: "Leave empty for the section's text colour." }),
  ] as const;

/** A photograph with something drawn over it (a collection's photo, a project's). */
export const overlayFields = () =>
  [
    select("overlay", "Colour over the photo", [{ value: "none", label: "None" }, { value: "color", label: "A colour" }], LAYOUT),
    color("overlayColor", "Overlay colour", { ...LAYOUT, when: { field: "overlay", is: ["color"] }, help: "Empty: black." }),
    number("overlayOpacity", "Overlay strength (%)", { ...LAYOUT, min: 5, max: 90, default: 30, when: { field: "overlay", is: ["color"] } }),
  ] as const;

/* -------------------------------------------------------------------------- *
 * Drawing
 * -------------------------------------------------------------------------- */

const HEADING_CLASS = { h3: "text-h3", h2: "text-h2", h1: "text-h1", display: "text-display" } as const;

/** The heading's classes and style; `fallback` is the class it is drawn with as designed. */
export function headingLook(
  s: { headingSize?: string; headingColor?: string; headingAlign?: string },
  fallback: string,
): { className: string; style: React.CSSProperties | undefined } {
  const size = HEADING_CLASS[s.headingSize as keyof typeof HEADING_CLASS] ?? fallback;
  const align = s.headingAlign === "center" ? " text-center" : s.headingAlign === "left" ? " text-left" : "";
  return { className: `${size}${align}`, style: s.headingColor ? { color: s.headingColor } : undefined };
}

const RATIO = { portrait: "3 / 4", tall: "2 / 3", square: "1 / 1", landscape: "4 / 3", wide: "16 / 9" } as const;
const GAP = { none: "0px", tight: "0.25rem", roomy: "2.5rem" } as const;
const TITLE = { small: "var(--fs-tertiary)", standard: "var(--fs-h4)", large: "var(--fs-h3)", xlarge: "var(--fs-h2)" } as const;
/** The name on the photo: its letters, and — when the collection has a logo — the logo's width. */
const MARK = {
  small: { size: "var(--fs-h2)", logo: "40%" },
  standard: { size: "var(--fs-h1)", logo: "50%" },
  large: { size: "var(--fs-display)", logo: "70%" },
  xlarge: { size: "var(--fs-display-lg)", logo: "85%" },
} as const;
/** The designer under a collection's name. */
const BYLINE = { small: "var(--fs-caption)", standard: "var(--fs-tertiary)", large: "var(--fs-secondary)", xlarge: "var(--fs-body)" } as const;

type CardSettings = {
  columnsDesktop?: string;
  columnsMobile?: string;
  gap?: string;
  imageShape?: string;
  imageRadius?: number;
  imageOverlay?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  cardStyle?: string;
  cardColor?: string;
  cardBorderColor?: string;
  titleSize?: string;
  titleColor?: string;
  cardAlign?: string;
  markSize?: string;
  markColor?: string;
  bylineSize?: string;
  bylineColor?: string;
};

export const tint = (hex: string, percent: number) => `color-mix(in srgb, ${hex} ${percent}%, transparent)`;

/**
 * The wrapper's attributes for the card settings — null while all are as designed, so
 * nothing is added to the page then.
 */
export function cardLook(s: CardSettings): { attrs: Record<string, string>; style: Record<string, string> } | null {
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  if (s.columnsDesktop && s.columnsDesktop !== "auto") {
    attrs["data-tl-cols-d"] = "";
    style["--tl-cols-d"] = s.columnsDesktop;
  }
  if (s.columnsMobile && s.columnsMobile !== "auto") {
    attrs["data-tl-cols-m"] = "";
    style["--tl-cols-m"] = s.columnsMobile;
  }
  if (s.gap && s.gap in GAP) {
    attrs["data-tl-gap"] = "";
    style["--tl-gap"] = GAP[s.gap as keyof typeof GAP];
  }
  if (s.imageShape && s.imageShape in RATIO) {
    attrs["data-tl-shape"] = "";
    style["--tl-ratio"] = RATIO[s.imageShape as keyof typeof RATIO];
  }
  if (s.imageRadius) {
    attrs["data-tl-radius"] = "";
    style["--tl-radius"] = `${s.imageRadius}px`;
  }
  if (s.imageOverlay === "color") {
    attrs["data-tl-overlay"] = "";
    // Black until another colour is picked: choosing "A colour" shows at once.
    style["--tl-overlay"] = tint(s.overlayColor || "#000000", s.overlayOpacity ?? 30);
  }
  if (s.cardStyle && s.cardStyle !== "plain") {
    attrs["data-tl-card"] = s.cardStyle;
    if (s.cardStyle === "card" && s.cardColor) style["--tl-card"] = s.cardColor;
    if ((s.cardStyle === "box" || s.cardStyle === "lines") && s.cardBorderColor) style["--tl-border"] = s.cardBorderColor;
  }
  if (s.titleSize && s.titleSize in TITLE) {
    attrs["data-tl-title"] = "";
    style["--tl-title"] = TITLE[s.titleSize as keyof typeof TITLE];
  }
  if (s.titleColor) {
    attrs["data-tl-title-color"] = "";
    style["--tl-title-color"] = s.titleColor;
  }
  if (s.cardAlign && s.cardAlign !== "auto") attrs["data-tl-align"] = s.cardAlign;
  if (s.markSize && s.markSize in MARK) {
    attrs["data-tl-mark"] = "";
    style["--tl-mark"] = MARK[s.markSize as keyof typeof MARK].size;
    style["--tl-mark-logo"] = MARK[s.markSize as keyof typeof MARK].logo;
  }
  if (s.markColor) {
    attrs["data-tl-mark-color"] = "";
    style["--tl-mark-color"] = s.markColor;
  }
  if (s.bylineSize && s.bylineSize in BYLINE) {
    attrs["data-tl-byline"] = "";
    style["--tl-byline"] = BYLINE[s.bylineSize as keyof typeof BYLINE];
  }
  if (s.bylineColor) {
    attrs["data-tl-byline-color"] = "";
    style["--tl-byline-color"] = s.bylineColor;
  }
  return Object.keys(attrs).length ? { attrs: { "data-tl": "", ...attrs }, style } : null;
}
