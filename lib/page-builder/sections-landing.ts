import { carouselViewFields, showMoreLinkField, showMoreToggle } from "./carousel";
import { defineSection, OWN_GROUND } from "./define-section";
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
} from "./fields";
import { SECTION_ICONS } from "./icons";

/**
 * LANDING SECTIONS — the composable bands a landing page is built from, in the
 * vocabulary a Shopify theme editor uses: banners, columns, numbers, quotes,
 * logos, steps, tabs, a video, a call to action.
 *
 * Unlike `sections.ts`, these are not lifted from a hand-built page; they are
 * new bands drawn ONLY with the design system — the type scale, the six surfaces,
 * the section rhythm, the one button — so every combination of settings still
 * looks like this site. No setting takes a colour, a size in pixels, a class or
 * markup: each one is a choice between values the design already has.
 *
 * Renderers: `components/page-builder/renderers.tsx`. Components:
 * `components/sections/landing/`. Presets (what Add section offers, with demo
 * copy): `presets.ts`.
 */

/* -------------------------------------------------------------------------- *
 * Shared choices
 * -------------------------------------------------------------------------- */

const BUTTON_STYLES = [
  { value: "solid", label: "Filled" },
  { value: "outline", label: "Outlined" },
  { value: "text", label: "Underlined text" },
] as const;

const HEADING_SIZES = [
  { value: "h2", label: "Standard" },
  { value: "h1", label: "Large" },
  { value: "display", label: "Extra large" },
] as const;

const TEXT_ALIGN = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centred" },
  { value: "right", label: "Right" },
] as const;

const TEXT_ALIGN_2 = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centred" },
] as const;

/** Where the copy sits on an image — drawn as a 3 × 3 picker. */
export const POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "middle-center", label: "Centre" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

const BANNER_HEIGHTS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "screen", label: "Full screen" },
  { value: "adapt", label: "Fit the image" },
] as const;

/** Light copy needs a dark image under it, and the reverse — the operator knows which their photo is. */
const TEXT_TONES = [
  { value: "light", label: "Light text" },
  { value: "dark", label: "Dark text" },
] as const;

const IMAGE_RATIOS = [
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
  { value: "landscape", label: "Landscape" },
  { value: "adapt", label: "Original" },
] as const;

const WIDTHS = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "full", label: "Full width" },
] as const;

// On the Style tab, in Background — with the colours, gradient and overlay.
const overlay = () =>
  number("overlay", "Image darkening (%)", {
    min: 0,
    max: 80,
    default: 30,
    group: "style",
    help: "Darkens the photograph so the text stays readable. 0 shows it as it is.",
  });

/** The copy fields a banner-like section opens with. */
const intro = (opts: { titleRequired?: boolean } = {}) =>
  [
    text("eyebrow", "Small label", { max: 60, help: "Optional, above the heading — e.g. “New season”." }),
    text("title", "Heading", { max: 160, required: opts.titleRequired }),
    textarea("body", "Text", { max: 600 }),
  ] as const;

const buttons = () =>
  [
    link("primary", "First button"),
    select("primaryStyle", "First button style", BUTTON_STYLES, { default: "solid" }),
    link("secondary", "Second button"),
    select("secondaryStyle", "Second button style", BUTTON_STYLES, { default: "outline" }),
  ] as const;

/* -------------------------------------------------------------------------- *
 * Banners
 * -------------------------------------------------------------------------- */

export const imageBanner = defineSection({
  type: "image_banner",
  label: "Image banner",
  description: "A large photograph with a heading, text and buttons on it — where it sits on the image is yours to choose.",
  category: "Banners",
  fields: [
    image("image", "Image", { required: true }),
    image("mobileImage", "Image on phones", {
      group: "advanced",
      help: "Optional. A taller crop for narrow screens; the main image is used if empty.",
    }),
    ...intro(),
    select("headingSize", "Heading size", HEADING_SIZES, { default: "h1" }),
    ...buttons(),
    select("height", "Height", BANNER_HEIGHTS, { default: "large", group: "layout" }),
    select("position", "Text position", POSITIONS, { default: "middle-center", group: "layout", display: "position" }),
    select("align", "Text alignment", TEXT_ALIGN, { default: "center", group: "layout" }),
    select("tone", "Text colour", TEXT_TONES, { group: "layout" }),
    overlay(),
    toggle("panel", "Put the text on a panel", {
      group: "layout",
      help: "A solid block behind the text — earth under dark text, off-black under light text.",
    }),
  ],
  // The photograph is the ground; a Background setting would change nothing.
  universal: ["hideOn"],
  omitStyle: OWN_GROUND,
  // Its height is the photograph's (or the Height choice), so space inside changes nothing.
  innerSpacing: false,
  summaryKey: "title",
});

/** "Same as desktop", then the nine places — for a slide's position on phones. */
const MOBILE_POSITIONS = [{ value: "same", label: "Same as desktop" }, ...POSITIONS] as const;

const TEXT_WIDTHS = [
  { value: "wide", label: "Wide" },
  { value: "medium", label: "Medium" },
  { value: "narrow", label: "Narrow" },
  { value: "full", label: "Full width" },
] as const;

/**
 * THE HERO SLIDER. Every slide is its own design: photograph (and a phone crop), copy,
 * two buttons, where the copy sits on desktop and on phones, its own darkening and
 * colour, its own typography. Fields marked `nextOnly` are not in the Liquid theme yet.
 */
export const slideshow = defineSection({
  type: "slideshow",
  label: "Hero slider",
  description: "Full-width slides, each designed on its own — photo, text, buttons, position and style. Plays by itself or by arrows.",
  category: "Banners",
  fields: [
    blocks("slides", "Slides", {
      max: 8,
      required: true,
      defaults: ["slide", "slide"],
      blocks: [
        block(
          "slide",
          "Slide",
          [
            image("image", "Image", { required: true }),
            image("mobileImage", "Image on phones", {
              nextOnly: true,
              help: "Optional — a taller crop for narrow screens. Empty uses the image above.",
            }),
            text("eyebrow", "Small label", { max: 60 }),
            text("title", "Heading", { max: 160 }),
            textarea("body", "Text", { max: 400 }),
            link("link", "Button"),
            select("buttonStyle", "Button style", BUTTON_STYLES),
            link("link2", "Second button", { nextOnly: true }),
            select("buttonStyle2", "Second button style", BUTTON_STYLES, { default: "outline", nextOnly: true }),
            select("position", "Text position", POSITIONS, { default: "bottom-left", display: "position", group: "style" }),
            select("positionMobile", "Text position on phones", MOBILE_POSITIONS, { default: "same", group: "style", nextOnly: true }),
            select("textWidth", "Text width", TEXT_WIDTHS, { default: "wide", group: "style", nextOnly: true }),
            select("tone", "Text colour", TEXT_TONES, { group: "style" }),
            select(
              "overlayMode",
              "Darkening",
              [
                { value: "slider", label: "Same as the other slides" },
                { value: "own", label: "This slide’s own" },
              ],
              { group: "style", nextOnly: true },
            ),
            number("slideOverlay", "This slide’s darkening (%)", {
              min: 0,
              max: 90,
              default: 30,
              group: "style",
              nextOnly: true,
              when: { field: "overlayMode", is: ["own"] },
            }),
            color("overlayColor", "Darkening colour", {
              group: "style",
              nextOnly: true,
              when: { field: "overlayMode", is: ["own"] },
              help: "Empty uses black.",
            }),
            design("design", "Typography & buttons", { group: "style", parts: ["typography", "buttons"], nextOnly: true }),
          ],
          { summaryKey: "title" },
        ),
      ],
    }),
    select("headingSize", "Heading size", HEADING_SIZES, { default: "h1" }),
    select("height", "Height", BANNER_HEIGHTS.filter((option) => option.value !== "adapt"), {
      default: "large",
      group: "layout",
    }),
    select(
      "heightMobile",
      "Height on phones",
      [{ value: "same", label: "Same as desktop" }, ...BANNER_HEIGHTS.filter((option) => option.value !== "adapt")],
      { default: "same", group: "layout", nextOnly: true },
    ),
    overlay(),
    toggle("autoplay", "Change slides automatically", { default: true, group: "layout" }),
    number("interval", "Seconds per slide", {
      min: 3,
      max: 12,
      default: 6,
      group: "layout",
      when: { field: "autoplay", is: [true] },
    }),
    select(
      "controls",
      "Controls",
      [
        { value: "both", label: "Arrows and dots" },
        { value: "dots", label: "Dots" },
        { value: "arrows", label: "Arrows" },
      ],
      { group: "layout" },
    ),
    select(
      "transition",
      "Change between slides",
      [
        { value: "fade", label: "Fade" },
        { value: "slide", label: "Slide sideways" },
        { value: "zoom", label: "Fade, with a slow zoom" },
      ],
      {
        group: "layout",
        nextOnly: true,
        help: "Visitors who ask their device for less motion always get a plain fade.",
      },
    ),
  ],
  universal: ["hideOn"],
  omitStyle: OWN_GROUND,
  // Each slide places its text with "Text position".
  textAlign: false,
  // Its height is the Height choice, so space inside changes nothing.
  innerSpacing: false,
});

export const ctaBanner = defineSection({
  type: "cta_banner",
  label: "Call to action",
  description: "One message and one or two buttons, on a colour or a photograph — the section that closes a landing page.",
  category: "Banners",
  fields: [
    ...intro({ titleRequired: true }),
    select("headingSize", "Heading size", HEADING_SIZES, { default: "h1" }),
    ...buttons(),
    select(
      "layout",
      "Layout",
      [
        { value: "center", label: "Centred" },
        { value: "split", label: "Text left, buttons right" },
        { value: "image", label: "On a photograph" },
      ],
      { group: "layout" },
    ),
    image("image", "Background image", { when: { field: "layout", is: ["image"] }, required: true }),
    select("tone", "Text colour", TEXT_TONES, { group: "layout", when: { field: "layout", is: ["image"] } }),
    {
      ...overlay(),
      when: { field: "layout", is: ["image"] },
    },
    select("width", "Content width", WIDTHS, { default: "medium", group: "layout" }),
  ],
  summaryKey: "title",
});

/* -------------------------------------------------------------------------- *
 * Text & media
 * -------------------------------------------------------------------------- */

const sectionHeading = () =>
  [
    text("title", "Heading", { max: 160 }),
    textarea("intro", "Intro", { max: 600 }),
    select("headingAlign", "Heading alignment", TEXT_ALIGN_2, { group: "layout" }),
  ] as const;

export const multicolumn = defineSection({
  type: "multicolumn",
  label: "Columns",
  description: "Two to five columns side by side — each an image or an icon, a heading, a few lines and a link.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    blocks("columns", "Columns", {
      max: 12,
      required: true,
      defaults: ["column", "column", "column"],
      blocks: [
        block(
          "column",
          "Column",
          [
            image("image", "Image", { help: "Shown when the section's media is set to images." }),
            select("icon", "Icon", SECTION_ICONS, {
              display: "icons",
              help: "Shown when the section's media is set to icons.",
            }),
            text("title", "Heading", { max: 120 }),
            richText("body", "Text"),
            link("link", "Link"),
          ],
          { summaryKey: "title" },
        ),
      ],
    }),
    link("button", "Button under the columns"),
    select(
      "media",
      "Media",
      [
        { value: "image", label: "Images" },
        { value: "icon", label: "Icons" },
        { value: "none", label: "None" },
      ],
      { group: "layout" },
    ),
    select("ratio", "Image shape", IMAGE_RATIOS, { default: "portrait", group: "layout", when: { field: "media", is: ["image"] } }),
    select(
      "columnsDesktop",
      "Columns on desktop",
      [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
      ],
      { default: "3", group: "layout", display: "buttons" },
    ),
    select(
      "columnsMobile",
      "On phones",
      [
        { value: "1", label: "One per row" },
        { value: "2", label: "Two per row" },
        { value: "scroll", label: "Swipe" },
      ],
      { group: "layout" },
    ),
    select("align", "Text alignment", TEXT_ALIGN_2, { group: "layout" }),
    select(
      "style",
      "Style",
      [
        { value: "plain", label: "Plain" },
        { value: "cards", label: "Cards" },
        { value: "lines", label: "Divided by lines" },
      ],
      { group: "layout" },
    ),
  ],
  summaryKey: "title",
});

export const stats = defineSection({
  type: "stats",
  label: "Numbers",
  description: "Key figures in large type — years, pieces, workshops, countries — each with a short label.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    blocks("items", "Figures", {
      max: 8,
      required: true,
      defaults: ["stat", "stat", "stat"],
      blocks: [
        block(
          "stat",
          "Figure",
          [
            text("value", "Figure", { max: 24, required: true, help: "As it should read — “25+”, “1998”, “12 000”." }),
            text("label", "Label", { max: 80 }),
            textarea("body", "Text", { max: 300 }),
          ],
          { summaryKey: "value" },
        ),
      ],
    }),
    select(
      "size",
      "Figure size",
      [
        { value: "h1", label: "Large" },
        { value: "display", label: "Extra large" },
      ],
      { default: "display", group: "layout" },
    ),
    select("align", "Alignment", TEXT_ALIGN_2, { group: "layout" }),
    toggle("lines", "Lines between figures", { default: true, group: "layout" }),
  ],
  summaryKey: "title",
});

export const steps = defineSection({
  type: "steps",
  label: "Steps",
  description: "A process in numbered steps — how an order is made, how a commission works, what happens next.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    blocks("items", "Steps", {
      max: 10,
      required: true,
      defaults: ["step", "step", "step"],
      blocks: [
        block(
          "step",
          "Step",
          [
            image("image", "Image"),
            text("title", "Heading", { max: 120, required: true }),
            richText("body", "Text"),
          ],
          { summaryKey: "title" },
        ),
      ],
    }),
    select(
      "layout",
      "Layout",
      [
        { value: "row", label: "In a row" },
        { value: "timeline", label: "Timeline, top to bottom" },
      ],
      { group: "layout" },
    ),
    toggle("numbered", "Number the steps", { default: true, group: "layout" }),
    toggle("showImages", "Show images", { group: "layout" }),
  ],
  summaryKey: "title",
});

export const tabs = defineSection({
  type: "tabs",
  label: "Tabs",
  description: "Several short topics behind tabs — materials, care, delivery — each with text, an image and a link.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    blocks("items", "Tabs", {
      max: 8,
      required: true,
      defaults: ["tab", "tab", "tab"],
      blocks: [
        block(
          "tab",
          "Tab",
          [
            text("label", "Tab name", { max: 40, required: true }),
            text("title", "Heading", { max: 160 }),
            richText("body", "Text"),
            image("image", "Image"),
            link("link", "Button"),
          ],
          { summaryKey: "label" },
        ),
      ],
    }),
    select(
      "imageSide",
      "Image",
      [
        { value: "right", label: "Right" },
        { value: "left", label: "Left" },
      ],
      { group: "layout" },
    ),
    select(
      "tabStyle",
      "Tab style",
      [
        { value: "underline", label: "Underlined" },
        { value: "pills", label: "Buttons" },
      ],
      { group: "layout" },
    ),
  ],
  summaryKey: "title",
});

export const collapsible = defineSection({
  type: "collapsible",
  label: "Collapsible content",
  description: "Rows that open on click, beside an optional image — specifications, materials, care, delivery.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    blocks("rows", "Rows", {
      max: 20,
      required: true,
      defaults: ["row", "row", "row"],
      blocks: [
        block(
          "row",
          "Row",
          [text("heading", "Heading", { max: 160, required: true }), richText("body", "Content")],
          { summaryKey: "heading" },
        ),
      ],
    }),
    image("image", "Image"),
    select(
      "imageSide",
      "Image side",
      [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
      { group: "layout" },
    ),
    toggle("openFirst", "First row open", { group: "layout" }),
  ],
  summaryKey: "title",
});

export const videoSection = defineSection({
  type: "video",
  label: "Video",
  description: "A YouTube or Vimeo film. Nothing loads from YouTube or Vimeo until the visitor presses play.",
  category: "Text & media",
  fields: [
    ...sectionHeading(),
    video("url", "Video address", { required: true, help: "Paste the address of a YouTube or Vimeo video." }),
    image("cover", "Cover image", {
      help: "Shown until play is pressed. Empty shows a plain dark cover — nothing is loaded from YouTube or Vimeo before play.",
    }),
    text("caption", "Caption", { max: 200 }),
    select(
      "ratio",
      "Shape",
      [
        { value: "16:9", label: "16:9" },
        { value: "4:3", label: "4:3" },
        { value: "21:9", label: "Cinema" },
        { value: "9:16", label: "Vertical" },
      ],
      { group: "layout", display: "buttons" },
    ),
    select("width", "Width", WIDTHS, { default: "full", group: "layout" }),
  ],
  summaryKey: "title",
});

export const marquee = defineSection({
  type: "marquee",
  label: "Scrolling text",
  description: "Short phrases moving slowly across the page — a tagline, values, places. Stops for visitors who prefer less motion.",
  category: "Text & media",
  fields: [
    blocks("items", "Phrases", {
      max: 12,
      required: true,
      defaults: ["item", "item", "item"],
      blocks: [block("item", "Phrase", [text("text", "Text", { max: 80, required: true })], { summaryKey: "text" })],
    }),
    select(
      "size",
      "Size",
      [
        { value: "h2", label: "Standard" },
        { value: "h1", label: "Large" },
        { value: "display", label: "Extra large" },
      ],
      { default: "h1", group: "layout" },
    ),
    select(
      "speed",
      "Speed",
      [
        { value: "slow", label: "Slow" },
        { value: "normal", label: "Normal" },
        { value: "fast", label: "Fast" },
      ],
      { default: "normal", group: "layout" },
    ),
    select(
      "direction",
      "Direction",
      [
        { value: "left", label: "To the left" },
        { value: "right", label: "To the right" },
      ],
      { group: "layout" },
    ),
    select(
      "separator",
      "Between phrases",
      [
        { value: "dot", label: "·" },
        { value: "dash", label: "—" },
        { value: "star", label: "✦" },
        { value: "none", label: "Nothing" },
      ],
      { group: "layout", display: "buttons" },
    ),
    toggle("lines", "Lines above and below", { group: "layout" }),
  ],
  // A slim band by design (`py-section-xs`): the rhythm presets never applied to it.
  // Its height is set with Custom spacing on the Style tab instead.
  universal: ["surface", "hideOn"],
});

/* -------------------------------------------------------------------------- *
 * Images
 * -------------------------------------------------------------------------- */

export const collage = defineSection({
  type: "collage",
  label: "Collage",
  description: "Two to five photographs in an editorial arrangement, each with an optional title and link.",
  category: "Images",
  fields: [
    ...sectionHeading(),
    blocks("tiles", "Images", {
      max: 5,
      required: true,
      defaults: ["tile", "tile", "tile"],
      blocks: [
        block(
          "tile",
          "Image",
          [image("image", "Image", { required: true }), text("title", "Title", { max: 120 }), url("href", "Link to")],
          { summaryKey: "title" },
        ),
      ],
    }),
    select(
      "layout",
      "Arrangement",
      [
        { value: "large-left", label: "Large image left" },
        { value: "large-right", label: "Large image right" },
        { value: "even", label: "Even grid" },
      ],
      { group: "layout" },
    ),
    select(
      "captions",
      "Titles",
      [
        { value: "below", label: "Under the image" },
        { value: "overlay", label: "On the image" },
      ],
      { group: "layout" },
    ),
  ],
  summaryKey: "title",
});

/* -------------------------------------------------------------------------- *
 * Social proof
 * -------------------------------------------------------------------------- */

export const testimonials = defineSection({
  type: "testimonials",
  label: "Testimonials",
  description: "What clients, architects and the press say — as a grid, a carousel or one large quote.",
  category: "Social proof",
  fields: [
    ...sectionHeading(),
    blocks("quotes", "Quotes", {
      max: 12,
      required: true,
      defaults: ["quote", "quote", "quote"],
      blocks: [
        block(
          "quote",
          "Quote",
          [
            textarea("quote", "Quote", { max: 600, required: true }),
            text("author", "Name", { max: 80 }),
            text("role", "Role or place", { max: 120 }),
            image("image", "Portrait or logo"),
          ],
          { summaryKey: "author" },
        ),
      ],
    }),
    select(
      "layout",
      "Layout",
      [
        { value: "grid", label: "Grid" },
        { value: "carousel", label: "Carousel" },
        { value: "single", label: "One large quote at a time" },
      ],
      { group: "layout" },
    ),
    select(
      "columns",
      "Columns",
      [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
      { default: "3", group: "layout", when: { field: "layout", is: ["grid", "carousel"] } },
    ),
    ...carouselViewFields({ field: "layout", is: ["carousel"] }),
    toggle("marks", "Show quotation marks", { default: true, group: "layout" }),
    showMoreToggle(),
    showMoreLinkField("Where it goes — a page of reviews, say. Without a link it is not shown.", { field: "showMore", is: [true] }),
  ],
  summaryKey: "title",
});

export const logoList = defineSection({
  type: "logo_list",
  label: "Logo list",
  description: "A row of logos — press, partners, brands carried, projects delivered for.",
  category: "Social proof",
  fields: [
    ...sectionHeading(),
    blocks("logos", "Logos", {
      max: 24,
      required: true,
      defaults: ["logo", "logo", "logo", "logo"],
      blocks: [
        block(
          "logo",
          "Logo",
          [
            image("image", "Logo", { required: true }),
            text("name", "Name", { max: 80, help: "Read out by screen readers; not shown." }),
            url("href", "Link to"),
          ],
          { summaryKey: "name" },
        ),
      ],
    }),
    select(
      "columns",
      "Per row on desktop",
      [
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
        { value: "6", label: "6" },
      ],
      { default: "5", group: "layout", display: "buttons" },
    ),
    select(
      "size",
      "Logo size",
      [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      { default: "medium", group: "layout" },
    ),
    toggle("muted", "Soften the logos", { default: true, group: "layout", help: "Greyed out, full colour on hover." }),
  ],
  summaryKey: "title",
});

/* -------------------------------------------------------------------------- *
 * Catalogue
 * -------------------------------------------------------------------------- */

export const featuredProduct = defineSection({
  type: "featured_product",
  label: "Featured product",
  description: "One product with a whole section to itself — its photographs, its story and a link to it.",
  category: "Catalogue",
  fields: [
    product("product", "Product", { required: true }),
    text("eyebrow", "Small label", { max: 60 }),
    text("title", "Heading", { max: 160, help: "Leave empty to use the product's name." }),
    richText("body", "Text", { help: "Leave empty to use the product's description." }),
    text("buttonLabel", "Button text", { max: 40, default: "discover" }),
    select("buttonStyle", "Button style", BUTTON_STYLES),
    select(
      "imageSide",
      "Images",
      [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
      { group: "layout" },
    ),
    select(
      "images",
      "Photographs shown",
      [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
      { default: "2", group: "layout", display: "buttons" },
    ),
  ],
  summaryKey: "title",
});

/* -------------------------------------------------------------------------- *
 * Layout
 * -------------------------------------------------------------------------- */

export const spacer = defineSection({
  type: "spacer",
  label: "Spacer",
  description: "Empty space between two sections, with an optional line — for a little breathing room.",
  category: "Layout",
  fields: [
    select(
      "height",
      "Height",
      [
        { value: "xs", label: "Extra small" },
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
        { value: "xl", label: "Extra large" },
      ],
      { default: "sm" },
    ),
    select(
      "line",
      "Line",
      [
        { value: "none", label: "None" },
        { value: "contained", label: "Within the margins" },
        { value: "full", label: "Edge to edge" },
      ],
    ),
  ],
  universal: ["surface", "hideOn"],
});

/* -------------------------------------------------------------------------- *
 * Site
 * -------------------------------------------------------------------------- */

export const newsletter = defineSection({
  type: "newsletter",
  label: "Newsletter sign-up",
  description: "An email field and a short invitation — the same sign-up the footer has, in its own section.",
  category: "Site",
  fields: [
    text("title", "Heading", { max: 160 }),
    textarea("body", "Text", { max: 400 }),
    select("align", "Alignment", TEXT_ALIGN_2, { default: "center", group: "layout" }),
    select(
      "style",
      "Style",
      [
        { value: "plain", label: "Plain" },
        { value: "panel", label: "On a panel" },
      ],
      { group: "layout" },
    ),
  ],
  summaryKey: "title",
});
