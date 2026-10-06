import type { SectionCategory, SectionDefinition } from "./define-section";
import {
  captionedRow,
  collectionCarousel,
  collectionGrid,
  contactCta,
  contactForm,
  designerGrid,
  faq,
  fullImage,
  gallery,
  goBack,
  hero,
  instagram,
  itemList,
  locations,
  mediaText,
  pageHeading,
  productGrid,
  productMosaic,
  productRail,
  projectCards,
  richTextSection,
  textBlock,
} from "./sections";

/**
 * THE list of sections the builder offers. The panel's Add section menu, the
 * write API's validation and the storefront renderer all read it from here — a
 * type missing from this object does not exist anywhere.
 *
 * Keys are spelled `[x.type]` rather than written out so a key and its
 * definition's `type` cannot disagree.
 */
export const SECTIONS = {
  [pageHeading.type]: pageHeading,
  [hero.type]: hero,
  [textBlock.type]: textBlock,
  [richTextSection.type]: richTextSection,
  [mediaText.type]: mediaText,
  [itemList.type]: itemList,
  [faq.type]: faq,
  [captionedRow.type]: captionedRow,
  [fullImage.type]: fullImage,
  [gallery.type]: gallery,
  [productRail.type]: productRail,
  [productGrid.type]: productGrid,
  [productMosaic.type]: productMosaic,
  [collectionCarousel.type]: collectionCarousel,
  [collectionGrid.type]: collectionGrid,
  [projectCards.type]: projectCards,
  [designerGrid.type]: designerGrid,
  [locations.type]: locations,
  [instagram.type]: instagram,
  [contactForm.type]: contactForm,
  [contactCta.type]: contactCta,
  [goBack.type]: goBack,
} as const;

export type SectionType = keyof typeof SECTIONS;

export type SettingsFor<T extends SectionType> = ReturnType<(typeof SECTIONS)[T]["defaults"]>;

/** The order categories appear in Add section. */
export const SECTION_CATEGORIES: readonly SectionCategory[] = [
  "Intro",
  "Text & media",
  "Images",
  "Catalogue",
  "Site",
];

export const SECTION_TYPES = Object.keys(SECTIONS) as SectionType[];

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === "string" && Object.hasOwn(SECTIONS, value);
}

/** Widened for callers that hold a type as a plain string. */
export function sectionDefinition(type: string): SectionDefinition | null {
  return isSectionType(type) ? (SECTIONS[type] as unknown as SectionDefinition) : null;
}
