import type { SectionCategory, SectionDefinition } from "./define-section";
import {
  captionedRow,
  collectionCarousel,
  collectionGrid,
  contactCta,
  contactDetails,
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
  projectCarousel,
  richTextSection,
  textBlock,
} from "./sections";
import {
  collage,
  collapsible,
  ctaBanner,
  featuredProduct,
  imageBanner,
  logoList,
  marquee,
  multicolumn,
  newsletter,
  slideshow,
  spacer,
  stats,
  steps,
  tabs,
  testimonials,
  videoSection,
} from "./sections-landing";
import { customSection } from "./sections-custom";

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
  [projectCarousel.type]: projectCarousel,
  [designerGrid.type]: designerGrid,
  [locations.type]: locations,
  [instagram.type]: instagram,
  [contactDetails.type]: contactDetails,
  [contactForm.type]: contactForm,
  [contactCta.type]: contactCta,
  [goBack.type]: goBack,
  // Landing sections — see sections-landing.ts.
  [imageBanner.type]: imageBanner,
  [slideshow.type]: slideshow,
  [ctaBanner.type]: ctaBanner,
  [multicolumn.type]: multicolumn,
  [stats.type]: stats,
  [steps.type]: steps,
  [tabs.type]: tabs,
  [collapsible.type]: collapsible,
  [videoSection.type]: videoSection,
  [marquee.type]: marquee,
  [collage.type]: collage,
  [testimonials.type]: testimonials,
  [logoList.type]: logoList,
  [featuredProduct.type]: featuredProduct,
  [spacer.type]: spacer,
  [newsletter.type]: newsletter,
  // Built block by block — see sections-custom.ts.
  [customSection.type]: customSection,
} as const;

export type SectionType = keyof typeof SECTIONS;

export type SettingsFor<T extends SectionType> = ReturnType<(typeof SECTIONS)[T]["defaults"]>;

/** The order categories appear in Add section. */
export const SECTION_CATEGORIES: readonly SectionCategory[] = [
  "Build your own",
  "Banners",
  "Intro",
  "Text & media",
  "Images",
  "Social proof",
  "Catalogue",
  "Layout",
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
