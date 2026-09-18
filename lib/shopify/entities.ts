import {
  fieldBool,
  fieldImage,
  fieldImages,
  fieldInt,
  fieldMetaobjects,
  fieldProducts,
  fieldRichText,
  fieldText,
  fieldVideo,
  toFieldMap,
  type ShopifyVideo,
} from "./transforms";
import type { Maybe, ShopifyImage, ShopifyMetaobject } from "./types";

/**
 * Metaobjects arrive as a flat `fields[]` of `{ key, value, reference }`. These
 * turn the three content types into shapes the UI can use directly.
 */

export type CaptionedImage = {
  handle: string;
  image: Maybe<ShopifyImage>;
  /** When set, this entry plays as a video — `image` is still its poster/thumb. */
  video: Maybe<ShopifyVideo>;
  caption: Maybe<string>;
  altText: Maybe<string>;
  credit: Maybe<string>;
};

export function normalizeCaptionedImage(entry: ShopifyMetaobject): CaptionedImage {
  const fields = toFieldMap(entry.fields);
  const image = fieldImage(fields, "image");
  const altText = fieldText(fields, "alt_text");

  return {
    handle: entry.handle,
    image: image ? { ...image, altText: altText ?? image.altText } : null,
    video: fieldVideo(fields, "video"),
    caption: fieldText(fields, "caption"),
    altText,
    credit: fieldText(fields, "credit"),
  };
}

/* -------------------------------------------------------------------------- *
 * Project
 * -------------------------------------------------------------------------- */

export const PROJECT_CATEGORIES = ["Commercial", "Hospitality", "Residential"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export type ProjectCard = {
  handle: string;
  title: string;
  subtitle: Maybe<string>;
  location: Maybe<string>;
  year: Maybe<string>;
  category: Maybe<string>;
  cardImage: Maybe<ShopifyImage>;
  heroImage: Maybe<ShopifyImage>;
  sortOrder: Maybe<number>;
  isSelected: boolean;
};

export type Project = ProjectCard & {
  bodyHtml: string;
  creativeLead: Maybe<string>;
  collaborators: Maybe<string>;
  photography: Maybe<string>;
  gallery: CaptionedImage[];
  featuredProductIds: string[];
  relatedProjects: ProjectCard[];
};

export function normalizeProjectCard(entry: ShopifyMetaobject): ProjectCard {
  const fields = toFieldMap(entry.fields);
  const hero = fieldImage(fields, "hero_image");

  return {
    handle: entry.handle,
    title: fieldText(fields, "title") ?? entry.handle,
    subtitle: fieldText(fields, "subtitle"),
    location: fieldText(fields, "location"),
    year: fieldText(fields, "year"),
    category: fieldText(fields, "category"),
    // Falls back to the hero so a project without a card image still shows one.
    cardImage: fieldImage(fields, "card_image") ?? hero,
    heroImage: hero,
    sortOrder: fieldInt(fields, "sort_order"),
    isSelected: fieldBool(fields, "is_selected"),
  };
}

export function normalizeProject(entry: ShopifyMetaobject): Project {
  const fields = toFieldMap(entry.fields);

  return {
    ...normalizeProjectCard(entry),
    bodyHtml: fieldRichText(fields, "body"),
    creativeLead: fieldText(fields, "creative_lead"),
    collaborators: fieldText(fields, "collaborators"),
    photography: fieldText(fields, "photography"),
    gallery: fieldMetaobjects(fields, "gallery").map(normalizeCaptionedImage),
    featuredProductIds: fieldProducts(fields, "featured_items").map((node) => node.id),
    relatedProjects: fieldMetaobjects(fields, "related_projects").map(normalizeProjectCard),
  };
}

/** `metaobjects` has no sort argument, so ordering happens here. */
export function sortProjects(projects: ProjectCard[]): ProjectCard[] {
  return [...projects].sort((a, b) => {
    const left = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const right = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.title.localeCompare(b.title);
  });
}

/* -------------------------------------------------------------------------- *
 * Designer
 * -------------------------------------------------------------------------- */

export type Designer = {
  handle: string;
  name: string;
  studio: Maybe<string>;
  byline: Maybe<string>;
  bioShort: Maybe<string>;
  bioHtml: string;
  portrait: Maybe<ShopifyImage>;
  sortOrder: Maybe<number>;
};

export function normalizeDesigner(entry: ShopifyMetaobject): Designer {
  const fields = toFieldMap(entry.fields);
  const portrait = fieldImage(fields, "portrait");
  const alt = fieldText(fields, "portrait_alt");

  return {
    handle: entry.handle,
    name: fieldText(fields, "name") ?? entry.handle,
    studio: fieldText(fields, "studio"),
    byline: fieldText(fields, "byline"),
    bioShort: fieldText(fields, "bio_short"),
    bioHtml: fieldRichText(fields, "bio_full"),
    portrait: portrait ? { ...portrait, altText: alt ?? portrait.altText } : null,
    sortOrder: fieldInt(fields, "sort_order"),
  };
}

/* -------------------------------------------------------------------------- *
 * Location — a showroom or workshop, for Our Locations
 * -------------------------------------------------------------------------- */

export type Location = {
  handle: string;
  name: string;
  kind: Maybe<string>;
  address: Maybe<string>;
  phone: Maybe<string>;
  email: Maybe<string>;
  hours: Maybe<string>;
  image: Maybe<ShopifyImage>;
  mapUrl: Maybe<string>;
  sortOrder: Maybe<number>;
};

export function normalizeLocation(entry: ShopifyMetaobject): Location {
  const fields = toFieldMap(entry.fields);

  return {
    handle: entry.handle,
    name: fieldText(fields, "name") ?? entry.handle,
    kind: fieldText(fields, "kind"),
    address: fieldText(fields, "address"),
    phone: fieldText(fields, "phone"),
    email: fieldText(fields, "email"),
    hours: fieldText(fields, "hours"),
    image: fieldImage(fields, "image"),
    mapUrl: fieldText(fields, "map_url"),
    sortOrder: fieldInt(fields, "sort_order"),
  };
}

/* -------------------------------------------------------------------------- *
 * Gallery / story blocks — PAGE metafields reuse captioned_image
 * -------------------------------------------------------------------------- */

export const galleryImagesFrom = (entry: ShopifyMetaobject, key: string): ShopifyImage[] =>
  fieldImages(toFieldMap(entry.fields), key);

/* -------------------------------------------------------------------------- *
 * Site settings — the singleton
 * -------------------------------------------------------------------------- */

/**
 * Store-wide copy that used to be string literals in components.
 *
 * Every field is nullable and every consumer falls back to the literal it
 * replaced, so an empty field — or the whole entry missing, on a store where
 * `scripts/add-site-settings.mjs` has not run — renders exactly what the site
 * rendered before. That is the property that makes this safe to read from the
 * footer, which appears on all twenty-three routes: there is no state of the
 * data that can leave a page blank.
 */
export type SiteSettings = {
  footerTagline: Maybe<string>;
  newsletterInvitation: Maybe<string>;
  footerRegionLine: Maybe<string>;
  contactCtaBody: Maybe<string>;
  contactCtaLabel: Maybe<string>;
  /** Keyed by the metaobject field key, e.g. `social_instagram`. */
  social: Record<string, Maybe<string>>;
};

const SOCIAL_KEYS = [
  "social_instagram",
  "social_facebook",
  "social_pinterest",
  "social_linkedin",
  "social_five",
  "social_six",
] as const;

export function normalizeSiteSettings(entry: ShopifyMetaobject): SiteSettings {
  const fields = toFieldMap(entry.fields);

  return {
    footerTagline: fieldText(fields, "footer_tagline"),
    newsletterInvitation: fieldText(fields, "newsletter_invitation"),
    footerRegionLine: fieldText(fields, "footer_region_line"),
    contactCtaBody: fieldText(fields, "contact_cta_body"),
    contactCtaLabel: fieldText(fields, "contact_cta_label"),
    social: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, fieldText(fields, key)])),
  };
}

/** What every consumer sees when the entry is absent or unreadable. */
export const EMPTY_SITE_SETTINGS: SiteSettings = {
  footerTagline: null,
  newsletterInvitation: null,
  footerRegionLine: null,
  contactCtaBody: null,
  contactCtaLabel: null,
  social: {},
};
