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
import {
  collectionDesigner,
  collectionHero,
  collectionIdea,
  collectionInContext,
  collectionProducts,
  collectionsMain,
  designerProducts,
  designerCollections,
  designerProjects,
  designerProfile,
  productCollection,
  productDesigner,
  productIdea,
  productMain,
  productRecommendations,
  projectDetails,
  projectFeatured,
  projectHero,
  projectOthers,
  projectsMain,
  searchMain,
  shopMain,
} from "./sections-template";
import { TEMPLATE_CATEGORIES, type TemplateKind } from "./template-kinds";

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
  // The templates' own sections — offered only in their template; see sections-template.ts.
  [productMain.type]: productMain,
  [productIdea.type]: productIdea,
  [productDesigner.type]: productDesigner,
  [productCollection.type]: productCollection,
  [productRecommendations.type]: productRecommendations,
  [collectionHero.type]: collectionHero,
  [collectionIdea.type]: collectionIdea,
  [collectionDesigner.type]: collectionDesigner,
  [collectionProducts.type]: collectionProducts,
  [collectionInContext.type]: collectionInContext,
  [projectHero.type]: projectHero,
  [projectDetails.type]: projectDetails,
  [projectFeatured.type]: projectFeatured,
  [projectOthers.type]: projectOthers,
  [designerProfile.type]: designerProfile,
  [designerProducts.type]: designerProducts,
  [designerCollections.type]: designerCollections,
  [designerProjects.type]: designerProjects,
  [shopMain.type]: shopMain,
  [searchMain.type]: searchMain,
  [collectionsMain.type]: collectionsMain,
  [projectsMain.type]: projectsMain,
} as const;

export type SectionType = keyof typeof SECTIONS;

export type SettingsFor<T extends SectionType> = ReturnType<(typeof SECTIONS)[T]["defaults"]>;

/** The order categories appear in Add section. */
export const SECTION_CATEGORIES: readonly SectionCategory[] = [
  // First in a template's Add section — and never shown on a page (see `sectionTypesFor`).
  ...TEMPLATE_CATEGORIES,
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

/**
 * The section types a document may hold: every ordinary section, plus — in a
 * template — that template's own. `null` is a page (or the header and footer).
 */
export function isSectionAllowedIn(type: string, template: TemplateKind | null): boolean {
  const definition = sectionDefinition(type);
  if (!definition) return false;
  return definition.template === null || definition.template === template;
}

/** The types NOT offered in Add section here — what `AddSectionDialog`'s `exclude` takes. */
export function sectionTypesExcludedFrom(template: TemplateKind | null): SectionType[] {
  return SECTION_TYPES.filter((type) => !isSectionAllowedIn(type, template));
}
