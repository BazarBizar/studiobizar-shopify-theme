/**
 * TEMPLATES — the layouts of the pages that are drawn from an item rather than
 * written one by one: every product, every collection, every project and designer,
 * and the lists (all products with their filters, search results, all collections,
 * all projects). Elementor calls these Theme Builder templates; Shopify calls them
 * `templates/product.json` and friends.
 *
 * One template per kind, built with the page builder from the same sections a page
 * uses PLUS the sections of its kind ("Product details", "The idea", …), which draw
 * the item the visitor opened. Stored like the header and footer: three JSON copies
 * on the shop — published (the only one the storefront reads), draft and previous.
 *
 * Until a template is first published, its route draws the layout written in its
 * code, exactly as before; the editor opens on `defaultTemplateContent`, which
 * reproduces that layout section for section, so nothing moves until an edit does.
 *
 * Pure — no React, no `server-only` — like the rest of `lib/page-builder`.
 */

export const TEMPLATE_KINDS = [
  "product",
  "collection",
  "project",
  "designer",
  "shop",
  "search",
  "collections",
  "projects",
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** The kind of item a template's preview is drawn with, picked in the editor. */
export type TemplateSample = "product" | "collection" | "project" | "designer" | "query" | null;

export type TemplateInfo = {
  /** What the editor sees: the name of the pages it shapes. */
  label: string;
  /** One line in the Templates list. */
  description: string;
  /** Where these pages are, as a visitor sees it. */
  path: string;
  /** The Add section group of this kind's own sections — worded as the page. */
  category: TemplateCategory;
  sample: TemplateSample;
  /** Where the panel edits the items themselves. */
  items: { label: string; href: string } | null;
};

export type TemplateCategory =
  | "Product page"
  | "Collection page"
  | "Project page"
  | "Designer page"
  | "Products list"
  | "Search results"
  | "Collections list"
  | "Projects list";

export const TEMPLATES: Record<TemplateKind, TemplateInfo> = {
  product: {
    label: "Product page",
    description: "Every product's own page — photos, details, the inquiry button and what follows.",
    path: "/shop/…",
    category: "Product page",
    sample: "product",
    items: { label: "Products", href: "/admin/products" },
  },
  collection: {
    label: "Collection page",
    description: "Every collection's own page — its large photo, the idea, the designer and its pieces.",
    path: "/collections/…",
    category: "Collection page",
    sample: "collection",
    items: { label: "Collections", href: "/admin/collections" },
  },
  project: {
    label: "Project page",
    description: "Every project's own page — the photo, the story, the credits and the gallery.",
    path: "/projects/…",
    category: "Project page",
    sample: "project",
    items: { label: "Projects", href: "/admin/project" },
  },
  designer: {
    label: "Designer page",
    description: "Every designer's own page — portrait, biography and the pieces they designed.",
    path: "/designers/…",
    category: "Designer page",
    sample: "designer",
    items: { label: "Designers", href: "/admin/designer" },
  },
  shop: {
    label: "All products",
    description: "The shop — every product, with the category and collection filters and sorting.",
    path: "/shop",
    category: "Products list",
    sample: null,
    items: { label: "Shop categories", href: "/admin/shop-categories" },
  },
  search: {
    label: "Search results",
    description: "What a visitor sees after searching — the search box, the number found and the results.",
    path: "/search",
    category: "Search results",
    sample: "query",
    items: null,
  },
  collections: {
    label: "All collections",
    description: "The list of every collection.",
    path: "/collections",
    category: "Collections list",
    sample: null,
    items: { label: "Collections", href: "/admin/collections" },
  },
  projects: {
    label: "All projects",
    description: "The list of every project, with its category filter.",
    path: "/projects",
    category: "Projects list",
    sample: null,
    items: { label: "Projects", href: "/admin/project" },
  },
};

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = TEMPLATE_KINDS.map((kind) => TEMPLATES[kind].category);

export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === "string" && (TEMPLATE_KINDS as readonly string[]).includes(value);
}

/** The three shop metafields one template is kept in (namespace `custom`). */
export function templateMetafields(kind: TemplateKind) {
  return {
    published: `template_${kind}`,
    draft: `template_${kind}_draft`,
    previous: `template_${kind}_previous`,
  } as const;
}
