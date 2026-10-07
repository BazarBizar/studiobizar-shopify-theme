import { createSection, DEFAULT_PAGE_SETTINGS, type DocumentContent, type PageSurface } from "./document";
import type { SectionInstance } from "./document";
import type { CaptionedImageValue, ImageRef, ResourceRef } from "./fields";

/**
 * MVP-2: hand-built pages that can move onto the page builder, one at a time.
 *
 * Each entry turns the page's CURRENT content — the PAGE metafields its route
 * reads today — into the builder document that draws the same page, so nobody
 * retypes anything. Converting only writes a DRAFT; the route keeps rendering its
 * own JSX until a builder version is published, and falls back to that JSX again
 * if the published document is ever unreadable.
 *
 * A page is added here only once its route has been made opt-in (it renders the
 * published document when there is one) and its builder rendering has been
 * diffed against the JSX it replaces. The sections must reproduce the page as
 * it is — a migration is not a redesign.
 *
 * Pure: the admin converts with it, the checks exercise it, nothing here talks to
 * Shopify.
 */

export type MigrationInput = {
  /** The page's `custom.*` metafield values by key, as stored. */
  metafields: Record<string, string | null | undefined>;
  /**
   * `list.metaobject_reference` metafields pointing at `captioned_image` entries,
   * resolved by the caller into the snapshots the builder stores. Positions are
   * kept — `null` for an entry with no image — because a page may take a slice of
   * a list by position, as Our Story takes the 4th to 6th gallery images.
   */
  images: Record<string, (CaptionedImageValue | null)[]>;
  /** `collection_reference` metafields, resolved — the landing page's New In and Monthly Selection. */
  collections: Record<string, ResourceRef | null>;
  /** `file_reference` metafields pointing at an image, resolved — the landing page's story image. */
  files: Record<string, ImageRef | null>;
  /** Shopify's plain-text summary of the page body. */
  bodySummary: string;
};

export type PageMigration = {
  handle: string;
  /** Where the page lives — its own route, which stays. */
  route: string;
  surface: PageSurface;
  /** Only where the page's footer is not the default olive — Contact is dark wood. */
  footerSurface?: PageSurface;
  build: (input: MigrationInput) => SectionInstance[];
};

function section<T extends Parameters<typeof createSection>[0]>(
  type: T,
  settings: Record<string, unknown> = {},
  visible = true,
) {
  const created = createSection(type);
  return { ...created, visible, settings: { ...created.settings, ...settings } } as SectionInstance;
}

/**
 * A band the hand-built page shows only when it has content becomes a HIDDEN
 * section when it has none — so the page still looks the same, and the operator
 * finds the band in the builder, ready to fill and switch on.
 */
const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/** A row of photographs takes three; `limit` is for a gallery, which takes them all. */
const imagesOf = (input: MigrationInput, key: string, from = 0, to?: number, limit = 3) =>
  (input.images[key] ?? []).slice(from, to).filter((item): item is CaptionedImageValue => item !== null).slice(0, limit);

/** Copy that is written in the page's code today, as rich text the builder can edit. */
function richText(text: string): string {
  return JSON.stringify({
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  });
}

const contactAndBack = () => [section("contact_cta"), section("go_back", { label: "go back", fallback: "/" })];

/**
 * Heading + intro, the contact prompt, go back — what `/careers` and
 * `/care-maintenance` are made of. The heading is left empty so it follows the
 * Shopify page title, exactly as the JSX's `page.title` does.
 */
const introPage = (input: MigrationInput): SectionInstance[] => [
  section("page_heading", { title: "", intro: input.metafields.intro_body ?? "" }),
  ...contactAndBack(),
];

/** Our Artisans — heading + story, three photographs, contact prompt, go back. */
const ourArtisans = (input: MigrationInput): SectionInstance[] => {
  const features = imagesOf(input, "feature_images");
  return [
    section("page_heading", { title: "", intro: input.metafields.story_block_1 ?? "" }),
    section("captioned_row", { images: features }, features.length > 0),
    ...contactAndBack(),
  ];
};

/**
 * Our Story — two story blocks around the feature photographs, then the 4th to
 * 6th gallery photographs. The second block follows a photograph row, which ends
 * in its own space, hence no space above it.
 */
const ourStory = (input: MigrationInput): SectionInstance[] => {
  const features = imagesOf(input, "feature_images");
  const gallery = imagesOf(input, "gallery", 3, 6);
  const blockTwo = input.metafields.story_block_2 ?? "";
  return [
    section("page_heading", { title: "", intro: input.metafields.story_block_1 ?? "" }),
    section("captioned_row", { images: features }, features.length > 0),
    section("text_block", { title: "Our Story", body: blockTwo, spaceAbove: "none" }, filled(blockTwo)),
    section("captioned_row", { images: gallery }, gallery.length > 0),
    ...contactAndBack(),
  ];
};

/**
 * Our Services. The heading and "Beyond The Project" are written in the route's
 * code today, not stored anywhere — they move into the document as they read,
 * and become editable for the first time.
 */
const ourServices = (input: MigrationInput): SectionInstance[] => {
  const features = imagesOf(input, "feature_images");
  return [
    section("page_heading", { title: "Design Program", intro: input.metafields.intro_body ?? "", introSpacing: "compact" }),
    section("item_list", { title: "Our Services", source: "services", items: [] }),
    section("text_block", {
      title: "Beyond The Project",
      body: richText(
        "Looking for ready-to-order collections? Our Bazar Bizar Partner Program provides direct access to real-time stock, pricing and an efficient order platform for professionals. Combined with our Design Program, it offers maximum flexibility.",
      ),
      link: { label: "read more", href: "/contact" },
      buttonStyle: "solid",
      textStyle: "plain",
      spaceAbove: "none",
    }),
    section("captioned_row", { images: features }, features.length > 0),
    ...contactAndBack(),
  ];
};

/**
 * The four pages whose list shares the opening band with the heading. The list
 * section takes `placement: "heading"` so it is drawn inside that band, as before.
 */
const faqPage = (): SectionInstance[] => [
  section("page_heading", { title: "" }),
  section("faq", { title: "", source: "all", placement: "heading" }),
  ...contactAndBack(),
];

const ourLocations = (input: MigrationInput): SectionInstance[] => [
  section("page_heading", { title: "", intro: input.metafields.intro_body ?? "" }),
  section("locations", { title: "", placement: "heading" }),
  ...contactAndBack(),
];

/** Shopify page `professionals`, at `/designers`. Its heading is written in the route, not stored. */
const ourDesigners = (input: MigrationInput): SectionInstance[] => [
  section("page_heading", { title: "Our Designers", style: "summary", summary: input.bodySummary.slice(0, 600) }),
  section("designer_grid", { title: "", limit: 200, placement: "heading" }),
  ...contactAndBack(),
];

/** No contact prompt on the gallery — only the way back. */
const galleryPage = (input: MigrationInput): SectionInstance[] => [
  section("page_heading", { title: "", style: "summary", summary: input.bodySummary.slice(0, 600) }),
  section("gallery", { title: "", images: imagesOf(input, "gallery", 0, undefined, 60), placement: "heading" }),
  section("go_back", { label: "go back", fallback: "/" }),
];

/** The stored inquiry types (a JSON list) as the section's one-per-line text. */
function linesOf(raw: string | null | undefined): string {
  try {
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").join("\n").slice(0, 1000) : "";
  } catch {
    return "";
  }
}

/** Contact — a lead-sized intro, then channels and the form in the opening band. No contact prompt. */
const contactPage = (input: MigrationInput): SectionInstance[] => [
  section("page_heading", { title: "Contact", style: "lead", intro: input.metafields.intro_body ?? "" }),
  section("contact_details", { title: "", types: linesOf(input.metafields.inquiry_types), placement: "heading" }),
  section("go_back", { label: "go back", fallback: "/" }),
];

/**
 * The landing page. Its headings and link labels are written in the route's code
 * today; they move into the document as they read. Which collection feeds each
 * product row, and the story image, come from the page's metafields.
 */
const homePage = (input: MigrationInput): SectionInstance[] => {
  const m = input.metafields;
  // The hero has no visible caption; a slide's caption was its alt text.
  const slides = imagesOf(input, "hero_slides", 0, undefined, 8).map((slide) => ({
    image: { ...slide.image, altText: slide.image.altText ?? (slide.caption || null) },
    caption: "",
  }));
  const features = imagesOf(input, "feature_images");
  const newIn = input.collections.new_in ?? null;
  const monthly = input.collections.monthly_selection ?? null;
  const story = input.files.story_image ?? null;

  const rail = (title: string, collection: ResourceRef | null) =>
    section(
      "product_rail",
      { title, source: "collection", collection, limit: 12, viewAll: true, viewAllPlacement: "heading" },
      collection !== null,
    );

  return [
    section("page_heading", { title: "Studio Bizar — designed for life, inspired by the world", style: "hidden" }),
    section("hero", { slides }, slides.length > 0),
    section(
      "text_block",
      { title: "Our Services", body: m.intro_body ?? "", link: { label: "explore our services", href: "/services" } },
      filled(m.intro_body),
    ),
    section("captioned_row", { images: features }, features.length > 0),
    section("project_cards", {
      title: "Selected Projects",
      source: "selected",
      limit: 3,
      view: "m",
      viewAll: true,
      introTitle: "Selected Project",
      introBody: m.projects_intro ?? "",
      introLink: { label: "view all projects", href: "/projects" },
    }),
    section("collection_carousel", { title: "Signature Collections", source: "signature", viewAll: true }),
    rail("New In", newIn),
    rail("Monthly Selection", monthly),
    // The route's alt text when the file has none.
    section("full_image", { image: story ? { ...story, altText: story.altText ?? "Studio Bizar" } : null }, story !== null),
    section(
      "text_block",
      { title: "Our Story", body: m.story_block_1 ?? "", link: { label: "read our story", href: "/our-story" } },
      filled(m.story_block_1),
    ),
    section("instagram", { fallback: imagesOf(input, "gallery", 0, undefined, 10) }),
    section("contact_cta"),
  ];
};

export const PAGE_MIGRATIONS: Record<string, PageMigration> = {
  careers: { handle: "careers", route: "/careers", surface: "mocha", build: introPage },
  "care-maintenance": { handle: "care-maintenance", route: "/care-maintenance", surface: "light", build: introPage },
  "our-artisans": { handle: "our-artisans", route: "/our-artisans", surface: "blue", build: ourArtisans },
  "our-story": { handle: "our-story", route: "/our-story", surface: "blue", build: ourStory },
  "our-services": { handle: "our-services", route: "/services", surface: "blue", build: ourServices },
  faq: { handle: "faq", route: "/faq", surface: "light", build: faqPage },
  "our-locations": { handle: "our-locations", route: "/our-locations", surface: "light", build: ourLocations },
  professionals: { handle: "professionals", route: "/designers", surface: "mocha", build: ourDesigners },
  gallery: { handle: "gallery", route: "/gallery", surface: "black", build: galleryPage },
  contact: { handle: "contact", route: "/contact", surface: "mocha", footerSurface: "dark", build: contactPage },
  home: { handle: "home", route: "/", surface: "dark", build: homePage },
};

export function pageMigration(handle: string): PageMigration | null {
  return Object.hasOwn(PAGE_MIGRATIONS, handle) ? PAGE_MIGRATIONS[handle]! : null;
}

/** The first draft for a page being moved onto the builder. */
export function migrateToDocument(migration: PageMigration, input: MigrationInput): DocumentContent {
  return {
    page: {
      ...DEFAULT_PAGE_SETTINGS,
      surface: migration.surface,
      footerSurface: migration.footerSurface ?? DEFAULT_PAGE_SETTINGS.footerSurface,
    },
    sections: migration.build(input),
  };
}
