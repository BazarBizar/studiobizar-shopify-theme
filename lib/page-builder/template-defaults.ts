import { createSection, type DocumentContent, type PageSurface, type SectionInstance } from "./document";
import { SECTIONS, type SectionType } from "./registry";
import type { TemplateKind } from "./template-kinds";

/**
 * What a template is before anyone has edited it: the page its route draws today,
 * section for section. The editor opens on this, so the first thing an editor
 * sees is the page as it is — and publishing it untouched changes nothing a
 * visitor can see (`yarn check:templates` proves it, page by page).
 */

type Part = { type: SectionType; settings?: Record<string, unknown> };

function section({ type, settings }: Part): SectionInstance {
  const created = createSection(type);
  const definition = SECTIONS[type];
  return {
    ...created,
    settings: definition.lenient({ ...(created.settings as Record<string, unknown>), ...settings }),
  } as SectionInstance;
}

const LAYOUTS: Record<TemplateKind, { surface: PageSurface; parts: Part[] }> = {
  product: {
    surface: "light",
    parts: [
      { type: "product_main" },
      { type: "product_idea" },
      { type: "product_designer" },
      { type: "product_collection" },
      { type: "product_recommendations" },
    ],
  },
  collection: {
    surface: "light",
    parts: [
      { type: "collection_hero" },
      { type: "collection_idea" },
      { type: "collection_designer" },
      { type: "collection_products" },
      { type: "collection_in_context" },
      { type: "contact_cta" },
      { type: "go_back", settings: { fallback: "/collections" } },
    ],
  },
  project: {
    surface: "black",
    parts: [
      { type: "project_hero" },
      { type: "project_details" },
      { type: "project_featured" },
      { type: "project_others" },
      { type: "go_back", settings: { fallback: "/projects" } },
    ],
  },
  designer: {
    surface: "mocha",
    parts: [
      { type: "designer_profile" },
      { type: "designer_products" },
      { type: "go_back", settings: { fallback: "/designers" } },
    ],
  },
  shop: { surface: "light", parts: [{ type: "shop_main" }] },
  search: { surface: "light", parts: [{ type: "search_main" }] },
  collections: { surface: "light", parts: [{ type: "collections_main" }] },
  projects: { surface: "light", parts: [{ type: "projects_main" }] },
};

export function defaultTemplateContent(kind: TemplateKind): DocumentContent {
  const layout = LAYOUTS[kind];
  return {
    page: { surface: layout.surface, footerSurface: "olive" },
    sections: layout.parts.map(section),
  };
}
