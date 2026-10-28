import { defineSection, HIDE_ON_OPTIONS } from "./define-section";
import {
  block,
  blocks,
  color,
  design,
  image,
  link,
  number,
  product,
  richText,
  select,
  text,
  textarea,
  toggle,
  url,
  video,
  type BlockLayout,
  type DesignTarget,
} from "./fields";
import { SECTION_ICONS } from "./icons";

/**
 * CUSTOM SECTION — the one section an editor builds themselves, block by block, the
 * way Elementor's container takes widgets: a heading, text, a photo, buttons, an
 * icon with text, a card, a video, a list, a quote, a fold-out, a line, some space,
 * a product. Each block has its own settings, and where it sits (alignment, space
 * above, which devices) under "Position & style".
 *
 * COLUMNS without nesting. A Column block starts a column; the blocks after it, up
 * to the next Column, sit in it. So "photo left, words right" is
 * `Column · Image · Column · Heading · Text · Button` — still one flat list, which is
 * what a Shopify section's blocks are, so the Liquid theme renders the same document
 * (`theme/sections/sb-custom.liquid`). Blocks before the first Column fill the width.
 *
 * Every choice is still one the design system has: the type scale, the one button,
 * the icon set, `#rrggbb` colours. Widths and spaces are named steps drawn by
 * `styles/sb-blocks.css`, which both builds import.
 */

/* -------------------------------------------------------------------------- *
 * Shared choices
 * -------------------------------------------------------------------------- */

const BUTTON_STYLES = [
  { value: "solid", label: "Filled" },
  { value: "outline", label: "Outlined" },
  { value: "text", label: "Underlined text" },
] as const;

const ALIGN = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
] as const;

/** A column's width, as a share of the row. `equal` shares what is left with the other `equal` columns. */
const WIDTHS = [
  { value: "equal", label: "Auto" },
  { value: "100", label: "100%" },
  { value: "75", label: "75%" },
  { value: "67", label: "66%" },
  { value: "50", label: "50%" },
  { value: "33", label: "33%" },
  { value: "25", label: "25%" },
  { value: "20", label: "20%" },
] as const;

const IMAGE_RATIOS = [
  { value: "adapt", label: "Original" },
  { value: "square", label: "Square" },
  { value: "portrait", label: "Tall" },
  { value: "landscape", label: "Wide" },
] as const;

/* -------------------------------------------------------------------------- *
 * What every block has: where it sits
 * -------------------------------------------------------------------------- */

const LOOK = { group: "layout" } as const;

/**
 * Alignment, space above and devices — the same three on every content block, under
 * "Position & style". `align: false` where there is nothing to line up (some space).
 */
function placement({ align = true }: { align?: boolean } = {}) {
  return [
    ...(align
      ? [
          select("align", "Alignment", [{ value: "inherit", label: "As the section" }, ...ALIGN], {
            ...LOOK,
            display: "buttons",
          }),
        ]
      : []),
    select(
      "space",
      "Space above",
      [
        { value: "auto", label: "Normal" },
        { value: "none", label: "None" },
        { value: "sm", label: "Small" },
        { value: "lg", label: "Large" },
        { value: "xl", label: "Extra large" },
      ],
      { ...LOOK, display: "buttons", help: "Normal is the section's “Space between blocks”." },
    ),
    select("hideOn", "Show on", HIDE_ON_OPTIONS, { ...LOOK }),
  ] as const;
}

/** Fonts, sizes and colours for this block alone — Next only for now, like the section's own. */
const typography = (targets: readonly DesignTarget[]) =>
  design("design", "Typography", { ...LOOK, parts: ["typography"], targets, nextOnly: true });

/* -------------------------------------------------------------------------- *
 * The blocks
 * -------------------------------------------------------------------------- */

const columnBlock = block(
  "column",
  "Column",
  [
    select("width", "Width on desktop", WIDTHS, {
      display: "buttons",
      help: "Auto columns share the row equally. Columns that do not fit move to the next row.",
    }),
    select("widthTablet", "Width on tablets", [{ value: "same", label: "As desktop" }, ...WIDTHS], {
      display: "buttons",
    }),
    select("widthMobile", "Width on phones", WIDTHS, { display: "buttons", default: "100" }),
    select(
      "position",
      "Content position",
      [
        { value: "top", label: "Top" },
        { value: "middle", label: "Middle" },
        { value: "bottom", label: "Bottom" },
      ],
      { help: "Where the blocks sit when the column next to it is taller." },
    ),
    toggle("mobileFirst", "Show first on phones", {
      help: "On phones the columns are stacked. Turn on to put this one on top — a photo on the right then comes above its text.",
    }),
    color("background", "Background colour", { group: "layout" }),
    select(
      "padding",
      "Space inside",
      [
        { value: "none", label: "None" },
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
      ],
      { group: "layout", display: "buttons", help: "Room between the column's edge and its blocks — useful with a background colour or a line." },
    ),
    toggle("border", "Line around", { group: "layout" }),
    number("radius", "Rounded corners (px)", { group: "layout", min: 0, max: 48, default: 0 }),
    select("hideOn", "Show on", HIDE_ON_OPTIONS, { group: "layout" }),
  ],
  { column: true, description: "Start a new column — the blocks below it go inside." },
);

const headingBlock = block(
  "heading",
  "Heading",
  [
    text("title", "Heading", { required: true, max: 200 }),
    select(
      "size",
      "Size",
      [
        { value: "h4", label: "XS" },
        { value: "h3", label: "S" },
        { value: "h2", label: "M" },
        { value: "h1", label: "L" },
        { value: "display", label: "XL" },
      ],
      { default: "h2", display: "buttons" },
    ),
    select(
      "tag",
      "Heading level",
      [
        { value: "auto", label: "Automatic" },
        { value: "h1", label: "H1" },
        { value: "h2", label: "H2" },
        { value: "h3", label: "H3" },
        { value: "h4", label: "H4" },
      ],
      {
        ...LOOK,
        display: "buttons",
        help: "For search engines; it does not change the look. Use H1 only for the page's main title, once.",
      },
    ),
    ...placement(),
    typography(["heading"]),
  ],
  { summaryKey: "title", description: "A title, in five sizes." },
);

const eyebrowBlock = block(
  "eyebrow",
  "Small label",
  [text("eyebrow", "Label", { required: true, max: 80, help: "A few words above a heading, in small capitals." }), ...placement(), typography(["text"])],
  { summaryKey: "eyebrow", description: "Small capitals above a heading." },
);

const textBlock = block(
  "text",
  "Text",
  [
    richText("body", "Text", { required: true }),
    select(
      "size",
      "Size",
      [
        { value: "small", label: "Small" },
        { value: "body", label: "Normal" },
        { value: "lead", label: "Large" },
      ],
      { default: "body", display: "buttons" },
    ),
    toggle("narrow", "Short lines", { ...LOOK, help: "Keeps lines to a comfortable reading length on wide screens." }),
    ...placement(),
    typography(["text"]),
  ],
  { description: "Paragraphs, with bold, italics and links." },
);

const imageBlock = block(
  "image",
  "Image",
  [
    image("image", "Image", { required: true }),
    text("caption", "Caption", { max: 200, help: "Optional — a line under the photo." }),
    url("href", "Link", { help: "Optional — makes the photo clickable." }),
    select("ratio", "Shape", IMAGE_RATIOS, { display: "buttons" }),
    select(
      "size",
      "Image width",
      [
        { value: "100", label: "100%" },
        { value: "75", label: "75%" },
        { value: "50", label: "50%" },
        { value: "25", label: "25%" },
      ],
      { ...LOOK, display: "buttons", help: "Of the column it is in." },
    ),
    ...placement(),
  ],
  { summaryKey: "caption", description: "One photograph, any shape." },
);

const buttonBlock = block(
  "button",
  "Button",
  [
    link("link", "Button", { required: true }),
    select("style", "Style", BUTTON_STYLES, { display: "buttons" }),
    link("second", "Second button", { help: "Optional — shown beside the first." }),
    select("secondStyle", "Second button style", BUTTON_STYLES, { default: "outline", display: "buttons" }),
    toggle("stretch", "Full width on phones", { ...LOOK }),
    ...placement(),
    design("design", "Button look", { ...LOOK, parts: ["typography", "buttons"], targets: ["button"], nextOnly: true }),
  ],
  { description: "One or two buttons side by side." },
);

const iconBlock = block(
  "icon",
  "Icon & text",
  [
    select("icon", "Icon", SECTION_ICONS, { display: "icons", default: "sparkles" }),
    text("title", "Heading", { max: 120 }),
    richText("body", "Text"),
    link("link", "Link"),
    select(
      "layout",
      "Icon",
      [
        { value: "above", label: "Above the text" },
        { value: "beside", label: "Beside the text" },
      ],
      { ...LOOK },
    ),
    select(
      "iconSize",
      "Icon size",
      [
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
      ],
      { ...LOOK, default: "md", display: "buttons" },
    ),
    ...placement(),
    typography(["heading", "text"]),
  ],
  { summaryKey: "title", description: "An icon with a short heading and text — a feature, a promise." },
);

const cardBlock = block(
  "card",
  "Card",
  [
    image("image", "Image"),
    text("title", "Heading", { max: 120 }),
    richText("body", "Text"),
    link("link", "Link"),
    select("ratio", "Image shape", IMAGE_RATIOS, { ...LOOK, default: "portrait", display: "buttons" }),
    select(
      "style",
      "Style",
      [
        { value: "plain", label: "Plain" },
        { value: "panel", label: "Soft panel" },
        { value: "outline", label: "Line around" },
      ],
      { ...LOOK, display: "buttons" },
    ),
    ...placement(),
    typography(["heading", "text"]),
  ],
  { summaryKey: "title", description: "A photo with a heading, text and a link." },
);

const videoBlock = block(
  "video",
  "Video",
  [
    video("url", "Video", { required: true }),
    image("cover", "Cover image", { help: "Shown until play is pressed. Nothing loads from YouTube or Vimeo before that." }),
    text("caption", "Caption", { max: 200 }),
    select(
      "ratio",
      "Shape",
      [
        { value: "16:9", label: "16:9" },
        { value: "4:3", label: "4:3" },
        { value: "9:16", label: "Upright" },
      ],
      { display: "buttons" },
    ),
    ...placement(),
  ],
  { summaryKey: "caption", description: "A YouTube or Vimeo film." },
);

const listBlock = block(
  "list",
  "List",
  [
    textarea("items", "Items", { required: true, max: 2000, help: "One item per line." }),
    select(
      "marker",
      "Marker",
      [
        { value: "dot", label: "Dots" },
        { value: "check", label: "Ticks" },
        { value: "number", label: "Numbers" },
        { value: "dash", label: "Dashes" },
      ],
      { display: "buttons" },
    ),
    ...placement(),
    typography(["text"]),
  ],
  { summaryKey: "items", description: "Points one under the other, with dots, ticks or numbers." },
);

const quoteBlock = block(
  "quote",
  "Quote",
  [
    textarea("quote", "Quote", { required: true, max: 600 }),
    text("author", "Who said it", { max: 80 }),
    text("role", "Their role or company", { max: 80 }),
    select(
      "size",
      "Size",
      [
        { value: "body", label: "Normal" },
        { value: "large", label: "Large" },
      ],
      { display: "buttons" },
    ),
    ...placement(),
    typography(["text"]),
  ],
  { summaryKey: "quote", description: "A client's words, with their name." },
);

const foldBlock = block(
  "fold",
  "Fold-out text",
  [
    text("title", "Title", { required: true, max: 160 }),
    richText("body", "Text", { required: true }),
    toggle("open", "Open at first"),
    ...placement(),
    typography(["heading", "text"]),
  ],
  { summaryKey: "title", description: "A title that opens to show more — a question and its answer." },
);

const lineBlock = block(
  "line",
  "Line",
  [
    select(
      "length",
      "Length",
      [
        { value: "full", label: "Full" },
        { value: "half", label: "Half" },
        { value: "short", label: "Short" },
      ],
      { display: "buttons" },
    ),
    number("thickness", "Thickness (px)", { min: 1, max: 8, default: 1 }),
    color("color", "Colour", { help: "Leave empty for a soft line in the text colour." }),
    ...placement(),
  ],
  { description: "A thin line between blocks." },
);

const spaceBlock = block(
  "space",
  "Empty space",
  [
    number("height", "Height on desktop (px)", { min: 0, max: 240, default: 48 }),
    number("heightMobile", "Height on phones (px)", { min: 0, max: 240, default: 24 }),
    select("hideOn", "Show on", HIDE_ON_OPTIONS, { ...LOOK }),
  ],
  { description: "Extra room between two blocks." },
);

const productBlock = block(
  "product",
  "Product",
  [product("product", "Product", { required: true }), ...placement({ align: false })],
  { summaryKey: "product", description: "One product as a card, linking to its page." },
);

/* -------------------------------------------------------------------------- *
 * The section
 * -------------------------------------------------------------------------- */

/**
 * Ready-made arrangements the block picker offers beside single blocks — a Column
 * block is easiest understood by seeing two of them side by side. Each adds ordinary
 * blocks (example content is filled in as for any new block).
 */
const CUSTOM_LAYOUTS: readonly BlockLayout[] = [
  {
    id: "two-columns",
    label: "Two columns",
    description: "Side by side on desktop, stacked on phones.",
    blocks: [{ type: "column" }, { type: "heading", settings: { size: "h3" } }, { type: "text" }, { type: "column" }, { type: "heading", settings: { size: "h3" } }, { type: "text" }],
  },
  {
    id: "photo-text",
    label: "Photo beside text",
    description: "A photograph on the left, a heading, text and a button on the right.",
    blocks: [
      { type: "column" },
      { type: "image", settings: { ratio: "portrait" } },
      { type: "column", settings: { position: "middle" } },
      { type: "eyebrow" },
      { type: "heading" },
      { type: "text" },
      { type: "button" },
    ],
  },
  {
    id: "three-features",
    label: "Three features",
    description: "Three icons with a heading and a line each.",
    blocks: [
      { type: "column", settings: { widthMobile: "100" } },
      { type: "icon", settings: { icon: "hammer" } },
      { type: "column" },
      { type: "icon", settings: { icon: "truck" } },
      { type: "column" },
      { type: "icon", settings: { icon: "shield" } },
    ],
  },
  {
    id: "four-cards",
    label: "Four cards",
    description: "Four on desktop, two on tablets, one under the other on phones.",
    blocks: Array.from({ length: 4 }, () => [
      { type: "column", settings: { width: "25", widthTablet: "50" } },
      { type: "card" },
    ]).flat(),
  },
];

export const CUSTOM_BLOCKS = [
  headingBlock,
  eyebrowBlock,
  textBlock,
  buttonBlock,
  imageBlock,
  iconBlock,
  cardBlock,
  listBlock,
  quoteBlock,
  foldBlock,
  videoBlock,
  productBlock,
  lineBlock,
  spaceBlock,
  columnBlock,
] as const;

export const customSection = defineSection({
  type: "custom_section",
  label: "Custom section",
  description: "Build it yourself: add headings, text, photos, buttons, icons, video and more — stacked or in columns.",
  category: "Build your own",
  fields: [
    blocks("blocks", "Blocks", {
      max: 40,
      required: true,
      defaults: ["heading", "text", "button"],
      blocks: CUSTOM_BLOCKS,
      layouts: CUSTOM_LAYOUTS,
    }),
    select("align", "Alignment", ALIGN, { group: "layout", display: "buttons", help: "Every block lines up this way, unless it has its own." }),
    select(
      "width",
      "Width",
      [
        { value: "page", label: "Page" },
        { value: "medium", label: "Medium" },
        { value: "narrow", label: "Narrow" },
        { value: "full", label: "Edge to edge" },
      ],
      { group: "layout", display: "buttons", help: "Narrow is easiest to read. Edge to edge has no side margins — for photos." },
    ),
    select(
      "gap",
      "Space between blocks",
      [
        { value: "none", label: "None" },
        { value: "sm", label: "S" },
        { value: "md", label: "M" },
        { value: "lg", label: "L" },
        { value: "xl", label: "XL" },
      ],
      { group: "layout", display: "buttons", default: "md" },
    ),
    select(
      "columnGap",
      "Space between columns",
      [
        { value: "none", label: "None" },
        { value: "sm", label: "S" },
        { value: "md", label: "M" },
        { value: "lg", label: "L" },
        { value: "xl", label: "XL" },
      ],
      { group: "layout", display: "buttons", default: "md", help: "Only when the section has Column blocks." },
    ),
  ],
  // Alignment is the Layout choice above, with an override per block.
  textAlign: false,
});

/**
 * The flat block list → its columns: blocks before the first Column fill the width
 * on their own (`column: null`); each Column holds the blocks after it, up to the
 * next. A Column with nothing in it is kept — an empty column still takes its share
 * of the row, which is how a layout leaves a gap on purpose.
 */
export function groupColumns<B extends { type: string }>(list: readonly B[]): { column: B | null; blocks: B[] }[] {
  const groups: { column: B | null; blocks: B[] }[] = [];
  for (const item of list) {
    if (item.type === "column") groups.push({ column: item, blocks: [] });
    else if (groups.length === 0) groups.push({ column: null, blocks: [item] });
    else groups[groups.length - 1]!.blocks.push(item);
  }
  return groups;
}
