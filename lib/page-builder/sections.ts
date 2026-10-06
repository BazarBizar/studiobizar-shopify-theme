import { defineSection } from "./define-section";
import {
  block,
  blocks,
  collection,
  collections,
  image,
  imageList,
  link,
  number,
  products,
  richText,
  select,
  text,
  textarea,
  toggle,
  url,
} from "./fields";

/** The three weights `components/ui/button.tsx` defines, and no others. */
const BUTTON_STYLES = [
  { value: "outline", label: "Outlined" },
  { value: "solid", label: "Filled" },
  { value: "text", label: "Underlined text" },
] as const;

/**
 * The sections an operator can put on a builder page — each one a band that
 * already exists on the storefront, with the settings its component already
 * takes. Nothing here is a new design; the renderer for each lives in
 * `components/page-builder/renderers.tsx`, keyed by the same `type`.
 *
 * ADDING ONE: declare it here, add it to `SECTIONS` in `registry.ts`, and give it
 * a renderer. The renderer map is typed against the registry, so forgetting the
 * third step is a build error rather than a band that silently never draws.
 *
 * `type` values are snake_case and match the Liquid section names where one
 * exists (`media_text` ↔ `sb-media-text`), so a theme renderer can switch on them
 * unchanged.
 */

export const pageHeading = defineSection({
  type: "page_heading",
  label: "Page heading",
  description: "The page's title as its one visible heading, with an optional intro.",
  category: "Intro",
  fields: [
    text("title", "Heading", { help: "Leave empty to use the page title." }),
    richText("intro", "Intro"),
  ],
  universal: ["surface", "rhythm"],
  summaryKey: "title",
});

export const hero = defineSection({
  type: "hero",
  label: "Hero slideshow",
  description: "Full-width photographs at the top of a page. One image is a still; several play as a slideshow.",
  category: "Intro",
  fields: [
    imageList("slides", "Slides", {
      max: 8,
      required: true,
      help: "The caption is read aloud by screen readers when the image has no alt text.",
    }),
  ],
  universal: ["hideOn"],
});

export const textBlock = defineSection({
  type: "text_block",
  label: "Heading & text",
  description: "A heading, a few paragraphs and an optional button.",
  category: "Text & media",
  fields: [
    text("title", "Heading", { required: true }),
    richText("body", "Text"),
    link("link", "Button"),
    select("buttonStyle", "Button style", BUTTON_STYLES),
  ],
  summaryKey: "title",
});

/**
 * Text built from BLOCKS — headings, paragraphs and buttons in any order. The
 * same section as the theme's `sb-rich-text`, setting for setting, so a page made
 * here reads the same way to a Liquid renderer.
 */
export const richTextSection = defineSection({
  type: "rich_text",
  label: "Text & buttons",
  description: "Headings, paragraphs and buttons in any order, in one column.",
  category: "Text & media",
  fields: [
    blocks("blocks", "Content", {
      max: 12,
      required: true,
      defaults: ["heading", "text"],
      blocks: [
        block(
          "heading",
          "Heading",
          [
            text("text", "Heading", { required: true }),
            select("level", "Size", [
              { value: "h2", label: "Large" },
              { value: "h3", label: "Small" },
            ]),
          ],
          { summaryKey: "text" },
        ),
        block("text", "Text", [
          richText("body", "Text", { required: true }),
          select("scale", "Copy size", [
            { value: "body", label: "Running copy" },
            { value: "lead", label: "Lead — heading size" },
          ]),
        ]),
        block("button", "Button", [link("link", "Button", { required: true }), select("style", "Style", BUTTON_STYLES)]),
      ],
    }),
    select(
      "width",
      "Measure",
      [
        { value: "medium", label: "Medium" },
        { value: "narrow", label: "Narrow" },
        { value: "full", label: "Full width" },
      ],
      { group: "layout", help: "How wide the copy runs before it wraps. Narrow keeps a line readable." },
    ),
    select(
      "align",
      "Alignment",
      [
        { value: "left", label: "Left" },
        { value: "center", label: "Centred" },
      ],
      { group: "layout" },
    ),
  ],
});

export const itemList = defineSection({
  type: "item_list",
  label: "Two-column list",
  description: "Named items with a short text each, in two columns — like Our Services.",
  category: "Text & media",
  fields: [
    text("title", "Heading"),
    select("source", "Items", [
      { value: "custom", label: "Items I write" },
      { value: "services", label: "The services list" },
    ]),
    blocks("items", "Items", {
      max: 24,
      required: true,
      when: { field: "source", is: ["custom"] },
      defaults: ["item", "item"],
      blocks: [block("item", "Item", [text("title", "Title", { required: true }), richText("body", "Text")], { summaryKey: "title" })],
    }),
  ],
  summaryKey: "title",
});

export const faq = defineSection({
  type: "faq",
  label: "Questions & answers",
  description: "Questions that open to their answer — written here, or taken from the FAQ entries.",
  category: "Text & media",
  fields: [
    text("title", "Heading"),
    select("source", "Questions", [
      { value: "custom", label: "Questions I write" },
      { value: "all", label: "All FAQ entries" },
      { value: "category", label: "FAQ entries in one category" },
    ]),
    text("category", "Category", {
      required: true,
      when: { field: "source", is: ["category"] },
      help: "As written on the FAQ entries, e.g. Delivery.",
    }),
    blocks("questions", "Questions", {
      max: 40,
      required: true,
      when: { field: "source", is: ["custom"] },
      defaults: ["question"],
      blocks: [
        block(
          "question",
          "Question",
          [text("question", "Question", { required: true, max: 200 }), richText("answer", "Answer", { required: true })],
          { summaryKey: "question" },
        ),
      ],
    }),
  ],
  summaryKey: "title",
});

export const mediaText = defineSection({
  type: "media_text",
  label: "Image with text",
  description: "A tall photograph beside a heading, text and an optional button.",
  category: "Text & media",
  fields: [
    text("title", "Heading", { required: true }),
    richText("body", "Text"),
    image("image", "Image", { required: true }),
    link("link", "Button"),
    select(
      "align",
      "Image position",
      [
        { value: "left", label: "Image left" },
        { value: "right", label: "Image right" },
      ],
      { group: "layout" },
    ),
    select(
      "padding",
      "Width",
      [
        { value: "normal", label: "Standard" },
        { value: "wide", label: "Inset" },
      ],
      { group: "layout" },
    ),
  ],
  summaryKey: "title",
});

export const captionedRow = defineSection({
  type: "captioned_row",
  label: "Three photographs",
  description: "A row of up to three captioned photographs.",
  category: "Images",
  fields: [imageList("images", "Photographs", { max: 3, required: true })],
});

export const fullImage = defineSection({
  type: "full_image",
  label: "Full-width image",
  description: "One photograph, edge to edge.",
  category: "Images",
  fields: [image("image", "Image", { required: true })],
  universal: ["hideOn"],
});

export const productRail = defineSection({
  type: "product_rail",
  label: "Product carousel",
  description: "A scrolling row of products from a collection, or ones you choose.",
  category: "Catalogue",
  fields: [
    text("title", "Heading", { required: true }),
    select("source", "Products from", [
      { value: "collection", label: "A collection" },
      { value: "products", label: "Products I choose" },
    ]),
    collection("collection", "Collection", {
      required: true,
      when: { field: "source", is: ["collection"] },
    }),
    products("products", "Products", {
      max: 24,
      required: true,
      when: { field: "source", is: ["products"] },
    }),
    number("limit", "How many", {
      min: 4,
      max: 24,
      default: 12,
      when: { field: "source", is: ["collection"] },
    }),
    toggle("viewAll", "Show “view all”", {
      default: true,
      when: { field: "source", is: ["collection"] },
    }),
  ],
  summaryKey: "title",
});

export const productMosaic = defineSection({
  type: "product_mosaic",
  label: "Product mosaic",
  description: "Ten products from a collection in the mosaic used on collection pages.",
  category: "Catalogue",
  fields: [text("title", "Heading"), collection("collection", "Collection", { required: true })],
  summaryKey: "title",
});

export const collectionCarousel = defineSection({
  type: "collection_carousel",
  label: "Collection carousel",
  description: "A scrolling row of collection cards on an earth band.",
  category: "Catalogue",
  fields: [
    text("title", "Heading", { required: true, default: "Signature Collections" }),
    select("source", "Collections", [
      { value: "signature", label: "Signature collections" },
      { value: "picked", label: "Collections I choose" },
    ]),
    collections("collections", "Collections", {
      max: 12,
      required: true,
      when: { field: "source", is: ["picked"] },
    }),
    toggle("viewAll", "Show “view all”", { default: true }),
  ],
  universal: ["hideOn"],
  summaryKey: "title",
});

export const projectCards = defineSection({
  type: "project_cards",
  label: "Projects",
  description: "Project cards, three across or one per row.",
  category: "Catalogue",
  fields: [
    text("title", "Heading", { required: true, default: "Selected Projects" }),
    select("source", "Projects", [
      { value: "selected", label: "Projects marked as selected" },
      { value: "all", label: "All projects, in order" },
    ]),
    number("limit", "How many", { min: 1, max: 12, default: 3 }),
    select(
      "view",
      "Layout",
      [
        { value: "m", label: "Three across" },
        { value: "l", label: "One per row" },
      ],
      { group: "layout" },
    ),
    toggle("viewAll", "Show “view all”", { default: true }),
  ],
  summaryKey: "title",
});

export const productGrid = defineSection({
  type: "product_grid",
  label: "Product grid",
  description: "Products four across, from a collection or ones you choose.",
  category: "Catalogue",
  fields: [
    text("title", "Heading"),
    select("source", "Products from", [
      { value: "collection", label: "A collection" },
      { value: "products", label: "Products I choose" },
    ]),
    collection("collection", "Collection", { required: true, when: { field: "source", is: ["collection"] } }),
    products("products", "Products", { max: 48, required: true, when: { field: "source", is: ["products"] } }),
    number("limit", "How many", { min: 4, max: 48, default: 12, when: { field: "source", is: ["collection"] } }),
    toggle("viewAll", "Show “view all”", { default: true, when: { field: "source", is: ["collection"] } }),
  ],
  summaryKey: "title",
});

export const collectionGrid = defineSection({
  type: "collection_grid",
  label: "Collection grid",
  description: "Collection cards four across.",
  category: "Catalogue",
  fields: [
    text("title", "Heading"),
    select("source", "Collections", [
      { value: "listed", label: "All collections" },
      { value: "signature", label: "Signature collections" },
      { value: "picked", label: "Collections I choose" },
    ]),
    collections("collections", "Collections", { max: 24, required: true, when: { field: "source", is: ["picked"] } }),
  ],
  summaryKey: "title",
});

export const designerGrid = defineSection({
  type: "designer_grid",
  label: "Designers",
  description: "Designer portraits four across, in the order set on the designer entries.",
  category: "Catalogue",
  fields: [text("title", "Heading"), number("limit", "How many", { min: 4, max: 40, default: 12 })],
  summaryKey: "title",
});

export const gallery = defineSection({
  type: "gallery",
  label: "Gallery",
  description: "Photographs at their own proportions, each opening full screen.",
  category: "Images",
  fields: [text("title", "Heading"), imageList("images", "Photographs", { max: 60, required: true })],
  summaryKey: "title",
});

export const locations = defineSection({
  type: "locations",
  label: "Locations",
  description: "The showrooms and workshops, two across, from the location entries.",
  category: "Site",
  fields: [text("title", "Heading")],
  summaryKey: "title",
});

export const contactForm = defineSection({
  type: "contact_form",
  label: "Contact form",
  description: "The contact form. Messages go to the address set for contact under Site-wide.",
  category: "Site",
  fields: [
    text("title", "Heading"),
    textarea("types", "Inquiry types", {
      max: 1000,
      help: "One per line — what the “Type of inquiry” menu offers. Leave empty for General only.",
    }),
  ],
  summaryKey: "title",
});

export const goBack = defineSection({
  type: "go_back",
  label: "Go back link",
  description: "The underlined “go back” link that closes most pages.",
  category: "Site",
  fields: [
    text("label", "Link text", { default: "go back", max: 40 }),
    url("fallback", "If there is no previous page, go to", { default: "/" }),
  ],
  universal: ["hideOn"],
});

export const instagram = defineSection({
  type: "instagram",
  label: "Instagram",
  description: "The live Instagram feed, with a link to the profile.",
  category: "Site",
  fields: [
    imageList("fallback", "Fallback images", {
      max: 10,
      captions: false,
      help: "Shown only when the live feed cannot be reached.",
    }),
  ],
  universal: ["hideOn"],
});

export const contactCta = defineSection({
  type: "contact_cta",
  label: "Contact prompt",
  description: "The closing “contact us” block. Its copy is edited once, under Site-wide.",
  category: "Site",
  fields: [],
});
