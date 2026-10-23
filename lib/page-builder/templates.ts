import { createSection, emptyDocument, type PageDocument, type PageSurface } from "./document";
import type { SectionType } from "./registry";

/**
 * Starting points for a new page. A template is nothing more than a list of
 * sections in their default state — once the page exists it is an ordinary
 * document, and changing a template later changes no page already made from it.
 */

export type PageTemplate = {
  id: string;
  label: string;
  description: string;
  surface: PageSurface;
  sections: readonly SectionType[];
};

export const PAGE_TEMPLATES = [
  {
    id: "blank",
    label: "Blank",
    description: "A heading and nothing else.",
    surface: "light",
    sections: ["page_heading"],
  },
  {
    id: "content",
    label: "Content page",
    description: "Heading, image with text, three photographs and the contact prompt.",
    surface: "blue",
    sections: ["page_heading", "media_text", "captioned_row", "contact_cta"],
  },
  {
    id: "landing",
    label: "Landing page",
    description: "Hero, intro text, a product carousel, image with text and the contact prompt.",
    surface: "dark",
    sections: ["hero", "text_block", "product_rail", "media_text", "contact_cta"],
  },
  {
    id: "information",
    label: "Information page",
    description: "Heading, text and buttons, questions and answers, the contact prompt.",
    surface: "light",
    sections: ["page_heading", "rich_text", "faq", "contact_cta", "go_back"],
  },
  {
    id: "campaign",
    label: "Campaign",
    description: "Hero, text, a product mosaic, collections and Instagram.",
    surface: "dark",
    sections: ["hero", "text_block", "product_mosaic", "collection_carousel", "instagram", "contact_cta"],
  },
] as const satisfies readonly PageTemplate[];

export type PageTemplateId = (typeof PAGE_TEMPLATES)[number]["id"];

export const PAGE_TEMPLATE_IDS = PAGE_TEMPLATES.map((template) => template.id) as [
  PageTemplateId,
  ...PageTemplateId[],
];

export function documentFromTemplate(id: PageTemplateId): PageDocument {
  const template = PAGE_TEMPLATES.find((candidate) => candidate.id === id) ?? PAGE_TEMPLATES[0];
  const doc = emptyDocument();

  return {
    ...doc,
    page: { ...doc.page, surface: template.surface },
    sections: template.sections.map((type) => createSection(type)),
  };
}
