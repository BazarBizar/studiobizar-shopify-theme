import { carouselViewFields } from "./carousel";
import { defineSection } from "./define-section";
import { block, blocks, color, number, richText, select, text, textarea, toggle } from "./fields";
import { TEMPLATES } from "./template-kinds";
import { cardFields, collectionTextFields, headingFields, overlayFields } from "./template-look";

/**
 * THE TEMPLATES' OWN SECTIONS — each draws part of the item the visitor opened:
 * the product's photos and details, the collection's large photo, the project's
 * credits. Offered only in their own template (`template`), beside every ordinary
 * section, which a template may use as freely as a page.
 *
 * What they show comes from the item (Products, Collections, Projects, Designers)
 * and from Site texts; the settings here only decide what is shown and how. Every
 * default reproduces the page as its route draws it today, so a template opened for
 * the first time is the page as it is (`template-defaults.ts`).
 *
 * Drawn by `components/page-builder/renderers-template.tsx`. Next only for now —
 * Shopify's own equivalent is a theme's `templates/product.json`, which the Liquid
 * theme can follow later.
 */

const SIDES = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
] as const;

const SITE_TEXT = "Leave empty to use the wording under Settings → Site texts.";

const from = (label: string, href: string) => () => ({ label, href });

const LAYOUT = { group: "layout" } as const;

/** A photo beside text (The idea, About the designer): the controls Image with text has. */
const mediaTextFields = ({ button }: { button: boolean }) =>
  [
    select(
      "imageWidth",
      "Photo width",
      [
        { value: "half", label: "Half" },
        { value: "narrow", label: "Smaller" },
        { value: "wide", label: "Larger" },
      ],
      { ...LAYOUT, display: "buttons" },
    ),
    select(
      "ratio",
      "Photo shape",
      [
        { value: "portrait", label: "Portrait (2:3)" },
        { value: "square", label: "Square" },
        { value: "landscape", label: "Landscape (4:3)" },
        { value: "adapt", label: "As the photo is" },
      ],
      LAYOUT,
    ),
    select(
      "verticalAlign",
      "Text beside the photo",
      [
        { value: "center", label: "Middle" },
        { value: "top", label: "Top" },
        { value: "bottom", label: "Bottom" },
      ],
      { ...LAYOUT, display: "buttons" },
    ),
    select(
      "padding",
      "Width",
      [
        { value: "wide", label: "Inset" },
        { value: "normal", label: "Standard" },
      ],
      { ...LAYOUT, display: "buttons" },
    ),
    ...(button
      ? ([
          select(
            "buttonStyle",
            "Link style",
            [
              { value: "outline", label: "Outlined" },
              { value: "solid", label: "Filled" },
              { value: "text", label: "Underlined text" },
            ],
            LAYOUT,
          ),
        ] as const)
      : ([] as const)),
  ] as const;

/** A row of products under a heading: its "view all" link. */
const viewAllFields = () =>
  [
    toggle("viewAll", "Show “view all”", { default: true }),
    text("viewAllLabel", "“View all” text", { max: 40, default: "view all", when: { field: "viewAll", is: [true] } }),
    select(
      "viewAllPlacement",
      "“View all” position",
      [
        { value: "below", label: "Under the row" },
        { value: "heading", label: "Beside the heading" },
      ],
      { ...LAYOUT, when: { field: "viewAll", is: [true] } },
    ),
  ] as const;

/* -------------------------------------------------------------------------- *
 * Product page
 * -------------------------------------------------------------------------- */

const productItems = TEMPLATES.product.items!;

export const productMain = defineSection({
  type: "product_main",
  label: "Product details",
  description: "The product's photos beside its name, designer, description, details and the inquiry button. Each part can be moved or removed.",
  category: "Product page",
  template: "product",
  heading: true,
  fields: [
    blocks("blocks", "Parts", {
      max: 16,
      help: "Change the order, or remove a part you do not want — Add block puts it back. What each part shows comes from the product.",
      blocks: [
        block("breadcrumb", "Path (products › type)", [], { description: "A link back to all products, then the product's type." }),
        block("title", "Product name", [], { description: "The page's main heading." }),
        block("designer", "Designer", [text("prefix", "Text before the name", { default: "by", max: 20 })], {
          description: "“by” and the designer's name and studio.",
        }),
        block("description", "Description", [], { description: "The product's description." }),
        block("in_context", "Photos in a room", [], { description: "The product's “in context” photographs, if it has any." }),
        block("specs", "Details", [], { description: "Dimensions, materials and the other rows chosen under Content → Product details." }),
        block("price", "Price note", [], { description: "“Price on request” — the wording is under Settings → Site texts." }),
        block("inquiry", "Inquiry button", [], { description: "The quantity and Add to inquiry button." }),
        block("panels", "Fold-out panels", [toggle("downloads", "Show downloads", { default: true })], {
          description: "Care, delivery and the other panels chosen under Content → Product details.",
        }),
        block("text", "Your own text", [richText("body", "Text", { required: true })], {
          description: "A paragraph you write, the same on every product.",
        }),
      ],
      defaults: ["breadcrumb", "title", "designer", "description", "in_context", "specs", "price", "inquiry", "panels"],
    }),
    select("galleryPosition", "Photos on the", SIDES, { group: "layout", display: "buttons" }),
    select(
      "galleryWidth",
      "Photos take",
      [
        { value: "half", label: "Half" },
        { value: "wide", label: "More room" },
        { value: "narrow", label: "Less room" },
      ],
      { ...LAYOUT, display: "buttons" },
    ),
    select(
      "columnGap",
      "Space between photos and details",
      [
        { value: "standard", label: "Standard" },
        { value: "tight", label: "Tight" },
        { value: "roomy", label: "Roomy" },
      ],
      LAYOUT,
    ),
    toggle("sticky", "Keep the details in view while scrolling past the photos", { group: "layout" }),
    ...headingFields("Name"),
  ],
  universal: ["surface", "hideOn"],
  source: from(productItems.label, productItems.href),
});

export const productIdea = defineSection({
  type: "product_idea",
  label: "The idea",
  description: "The story behind the product, with its photo. Hidden on products that have none.",
  category: "Product page",
  template: "product",
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    select("align", "Photo on the", SIDES, { group: "layout", display: "buttons" }),
    select(
      "tone",
      "Background",
      [
        { value: "olive", label: "Black olive" },
        { value: "page", label: "Same as page" },
      ],
      { group: "layout" },
    ),
    ...mediaTextFields({ button: false }),
  ],
  universal: ["hideOn"],
  source: from(productItems.label, productItems.href),
});

export const productDesigner = defineSection({
  type: "product_designer",
  label: "About the designer",
  description: "The designer's portrait and biography, with a link to their page. Hidden when the product has no designer.",
  category: "Product page",
  template: "product",
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    text("linkLabel", "Link text", { help: SITE_TEXT, max: 40 }),
    select("align", "Portrait on the", SIDES, { group: "layout", display: "buttons", default: "right" }),
    ...mediaTextFields({ button: true }),
  ],
  source: () => ({ label: "Designers", href: "/admin/designer" }),
});

export const productCollection = defineSection({
  type: "product_collection",
  label: "More from the collection",
  description: "Other pieces from the product's collection, in a scrolling row. Hidden when it is in none.",
  category: "Product page",
  template: "product",
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    number("limit", "How many", { min: 2, max: 24, default: 4, help: "The product being viewed is left out of the row." }),
    ...viewAllFields(),
    ...carouselViewFields(),
    ...cardFields({ columns: false }),
  ],
  source: () => ({ label: "Collections", href: "/admin/collections" }),
});

export const productRecommendations = defineSection({
  type: "product_recommendations",
  label: "You may also like",
  description: "Products like this one, in a scrolling row — Shopify's suggestions, else products of the same type.",
  category: "Product page",
  template: "product",
  fields: [text("title", "Heading", { help: SITE_TEXT }), ...viewAllFields(), ...carouselViewFields(), ...cardFields({ columns: false })],
});

/* -------------------------------------------------------------------------- *
 * Collection page
 * -------------------------------------------------------------------------- */

const collectionItems = TEMPLATES.collection.items!;

export const collectionHero = defineSection({
  type: "collection_hero",
  label: "Collection photo and name",
  description: "The collection's large photograph with its logo — or its name in large letters — over it.",
  category: "Collection page",
  template: "collection",
  heading: true,
  fields: [
    select(
      "height",
      "Height",
      [
        { value: "standard", label: "Standard" },
        { value: "short", label: "Low" },
        { value: "screen", label: "Whole screen" },
      ],
      { group: "layout" },
    ),
    toggle("logo", "Show the logo when there is one", { default: true, group: "layout", help: "Off: the collection's name in large letters." }),
    select(
      "nameSize",
      "Name size",
      [
        { value: "display-lg", label: "Extra large" },
        { value: "display", label: "Large" },
        { value: "h1", label: "Medium" },
      ],
      LAYOUT,
    ),
    color("nameColor", "Name colour", { ...LAYOUT, help: "Leave empty for the light text the photo is designed with." }),
    ...overlayFields(),
  ],
  universal: ["hideOn"],
  source: from(collectionItems.label, collectionItems.href),
});

export const collectionIdea = defineSection({
  type: "collection_idea",
  label: "The idea",
  description: "The thought behind the collection, with its photo. Hidden on collections that have none.",
  category: "Collection page",
  template: "collection",
  fields: [
    text("title", "Heading", { help: "Leave empty to use the collection's own (else “The Idea”)." }),
    select("align", "Photo on the", SIDES, { group: "layout", display: "buttons" }),
    ...mediaTextFields({ button: false }),
  ],
  universal: ["hideOn"],
  source: from(collectionItems.label, collectionItems.href),
});

export const collectionDesigner = defineSection({
  type: "collection_designer",
  label: "About the designer",
  description: "The designer's portrait and biography. Hidden when the collection names no designer.",
  category: "Collection page",
  template: "collection",
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    text("linkLabel", "Link text", { default: "learn more", max: 40 }),
    select("align", "Portrait on the", SIDES, { group: "layout", display: "buttons", default: "right" }),
    select(
      "tone",
      "Background",
      [
        { value: "olive", label: "Black olive" },
        { value: "page", label: "Same as page" },
      ],
      { group: "layout" },
    ),
    ...mediaTextFields({ button: true }),
  ],
  universal: ["hideOn"],
  source: () => ({ label: "Designers", href: "/admin/designer" }),
});

export const collectionProducts = defineSection({
  type: "collection_products",
  label: "Collection pieces",
  description: "The collection's name and description, then its products.",
  category: "Collection page",
  template: "collection",
  fields: [
    toggle("showTitle", "Show the collection's name", { default: true }),
    toggle("showDescription", "Show the description", { default: true }),
    select(
      "layout",
      "Products as",
      [
        { value: "mosaic", label: "Mosaic (large and small)" },
        { value: "grid", label: "Even grid" },
      ],
      { group: "layout" },
    ),
    number("limit", "How many products", { min: 1, max: 24, default: 10, group: "layout" }),
    ...headingFields("Name"),
    // Columns only for the even grid: the mosaic is a composition of its own.
    ...cardFields({ columns: true, columnsWhen: { field: "layout", is: ["grid"] } }),
  ],
  universal: ["surface", "hideOn"],
  source: from(collectionItems.label, collectionItems.href),
});

export const collectionInContext = defineSection({
  type: "collection_in_context",
  label: "Projects with this collection",
  description: "Projects the collection appears in, edge to edge in a scrolling row. Hidden when there are none.",
  category: "Collection page",
  template: "collection",
  fields: [text("title", "Heading", { help: SITE_TEXT }), ...headingFields(), ...cardFields({ columns: false })],
  universal: ["hideOn"],
  source: from(collectionItems.label, collectionItems.href),
});

/* -------------------------------------------------------------------------- *
 * Project page
 * -------------------------------------------------------------------------- */

const projectItems = TEMPLATES.project.items!;

export const projectHero = defineSection({
  type: "project_hero",
  label: "Project photo",
  description: "The project's main photograph, the full width of the page.",
  category: "Project page",
  template: "project",
  fields: [
    select(
      "height",
      "Shape",
      [
        { value: "standard", label: "As designed (tall on phones, wide on screens)" },
        { value: "wide", label: "Wide everywhere" },
        { value: "screen", label: "Whole screen" },
      ],
      { group: "layout" },
    ),
    ...overlayFields(),
  ],
  universal: ["hideOn"],
  source: from(projectItems.label, projectItems.href),
});

export const projectDetails = defineSection({
  type: "project_details",
  label: "Project story",
  description: "The project's name, subtitle, credits (location, year, team), its story and the photo gallery.",
  category: "Project page",
  template: "project",
  heading: true,
  fields: [
    toggle("showSubtitle", "Show the subtitle", { default: true }),
    toggle("showCredits", "Show location, year and credits", { default: true }),
    toggle("showBody", "Show the story", { default: true }),
    toggle("showGallery", "Show the photo gallery", { default: true }),
    select(
      "creditsPlacement",
      "Credits",
      [
        { value: "side", label: "Beside the story" },
        { value: "above", label: "Above the story" },
      ],
      { ...LAYOUT, display: "buttons" },
    ),
    ...headingFields("Name"),
  ],
  universal: ["surface", "hideOn"],
  source: from(projectItems.label, projectItems.href),
});

export const projectFeatured = defineSection({
  type: "project_featured",
  label: "Pieces in this project",
  description: "The products used in the project, in a scrolling row. Hidden when none are chosen.",
  category: "Project page",
  template: "project",
  fields: [text("title", "Heading", { help: SITE_TEXT }), ...viewAllFields(), ...carouselViewFields(), ...cardFields({ columns: false })],
  source: from(projectItems.label, projectItems.href),
});

export const projectOthers = defineSection({
  type: "project_others",
  label: "Other projects",
  description: "More projects — the ones chosen on the project, else the newest others.",
  category: "Project page",
  template: "project",
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    number("limit", "How many", { min: 1, max: 9, default: 3, help: "When the project has none chosen, this many of the newest others." }),
    ...headingFields(),
    ...cardFields({ columns: true }),
  ],
  source: from(projectItems.label, projectItems.href),
});

/* -------------------------------------------------------------------------- *
 * Designer page
 * -------------------------------------------------------------------------- */

const designerItems = TEMPLATES.designer.items!;

export const designerProfile = defineSection({
  type: "designer_profile",
  label: "Designer profile",
  description: "The designer's portrait beside their name, studio, line and biography.",
  category: "Designer page",
  template: "designer",
  heading: true,
  fields: [
    select("align", "Portrait on the", SIDES, { group: "layout", display: "buttons" }),
    toggle("showCollections", "List their collections", { default: true }),
    select(
      "portraitShape",
      "Portrait shape",
      [
        { value: "auto", label: "As designed" },
        { value: "square", label: "Square" },
        { value: "portrait", label: "Portrait (3:4)" },
        { value: "landscape", label: "Landscape (4:3)" },
      ],
      LAYOUT,
    ),
    number("portraitRadius", "Portrait corners (px)", { ...LAYOUT, min: 0, max: 40, default: 0 }),
    ...headingFields("Name"),
  ],
  universal: ["surface", "hideOn"],
  source: from(designerItems.label, designerItems.href),
});

export const designerProducts = defineSection({
  type: "designer_products",
  label: "Pieces by the designer",
  description: "The products the designer made, in a grid. Hidden when there are none.",
  category: "Designer page",
  template: "designer",
  fields: [
    text("title", "Heading", { help: "Leave empty for “Designed by” and the designer's name." }),
    number("limit", "How many", { min: 1, max: 24, default: 8 }),
    ...headingFields(),
    ...cardFields({ columns: true }),
  ],
  universal: ["surface", "hideOn"],
  source: from(designerItems.label, designerItems.href),
});

/* -------------------------------------------------------------------------- *
 * The lists
 * -------------------------------------------------------------------------- */

const INTRO_HELP = "Leave empty to use the summary of the Shopify page of the same name, when there is one.";

export const shopMain = defineSection({
  type: "shop_main",
  label: "Products with filters",
  description: "The heading, the category and collection filters, sorting and every product, loading more as visitors scroll.",
  category: "Products list",
  template: "shop",
  heading: true,
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    textarea("intro", "Intro", { max: 600, help: INTRO_HELP }),
    toggle("showControls", "Show filters and sorting", { default: true }),
    ...headingFields(),
    // No columns: visitors choose the size of the grid themselves (S / M / L).
    ...cardFields({ columns: false }),
  ],
  universal: ["surface", "hideOn"],
  source: () => ({ label: "Shop categories", href: "/admin/shop-categories" }),
});

export const searchMain = defineSection({
  type: "search_main",
  label: "Search box and results",
  description: "The heading, the search box, how many were found and the products, loading more as visitors scroll.",
  category: "Search results",
  template: "search",
  heading: true,
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    text("placeholder", "Text in the empty search box", { default: "Search products", max: 60 }),
    text("button", "Button text", { default: "Search", max: 30 }),
    toggle("showCount", "Show how many were found", { default: true }),
    text("empty", "When nothing is found", {
      default: "Nothing matched “{query}”. Try a different word, or browse",
      max: 160,
      help: "{query} is replaced by what the visitor typed. A link to all products follows.",
    }),
    ...headingFields(),
    ...cardFields({ columns: false }),
  ],
  universal: ["surface", "hideOn"],
});

export const collectionsMain = defineSection({
  type: "collections_main",
  label: "Collections list",
  description: "The heading and intro, then every collection marked to be listed.",
  category: "Collections list",
  template: "collections",
  heading: true,
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    textarea("intro", "Intro", { max: 600, help: INTRO_HELP }),
    ...headingFields(),
    ...collectionTextFields(),
    ...cardFields({ columns: true, names: false }),
  ],
  universal: ["surface", "hideOn"],
  source: from(collectionItems.label, collectionItems.href),
});

export const projectsMain = defineSection({
  type: "projects_main",
  label: "Projects with filters",
  description: "The heading and intro, the category filter and the medium / large view, then every project.",
  category: "Projects list",
  template: "projects",
  heading: true,
  fields: [
    text("title", "Heading", { help: SITE_TEXT }),
    textarea("intro", "Intro", { max: 600, help: INTRO_HELP }),
    toggle("showControls", "Show the filter and view switch", { default: true }),
    ...headingFields(),
    ...cardFields({ columns: true }),
  ],
  universal: ["surface", "hideOn"],
  source: from(projectItems.label, projectItems.href),
});

export const TEMPLATE_SECTIONS = [
  productMain,
  productIdea,
  productDesigner,
  productCollection,
  productRecommendations,
  collectionHero,
  collectionIdea,
  collectionDesigner,
  collectionProducts,
  collectionInContext,
  projectHero,
  projectDetails,
  projectFeatured,
  projectOthers,
  designerProfile,
  designerProducts,
  shopMain,
  searchMain,
  collectionsMain,
  projectsMain,
] as const;
