/**
 * Shopify is a catalogue and CMS here, never a shop. Nothing in this module may
 * reference price, inventory or availability — see `fragments.ts`.
 */

export const METAFIELD_NAMESPACE = "custom";

/** Keys needed to render a product card in a grid. Kept deliberately small. */
export const PRODUCT_CARD_METAFIELDS = ["collection_label"] as const;

/** Everything Shop Detail renders. Mirrors schema-push's PRODUCT definitions. */
export const PRODUCT_DETAIL_METAFIELDS = [
  "designer",
  "collection_label",
  "signature_collection",
  "material_finish",
  "colour",
  "upholstery",
  "availability",
  "technical_specifications",
  "dimensions",
  "care_maintenance",
  "shipping_delivery",
  "downloads",
  "idea_body",
  "idea_image",
  "in_context_images",
  "moq",
  "lead_time_weeks",
] as const;

export const COLLECTION_METAFIELDS = [
  "is_signature",
  "hero_image",
  "hero_logo",
  "card_image",
  "designer",
  "idea_title",
  "idea_body",
  "idea_image",
  "in_context_projects",
  "sort_order",
] as const;

export const PAGE_METAFIELDS = [
  "hero_slides",
  "story_block_1",
  "feature_images",
  "story_block_2",
  "gallery",
  "intro_body",
  "channels",
  "inquiry_types",
  // Landing page
  "new_in",
  "monthly_selection",
  "story_image",
  "projects_intro",
  "locations",
] as const;

/** Metaobject types provisioned by schema-push. */
export const METAOBJECT_TYPES = {
  captionedImage: "captioned_image",
  designer: "designer",
  project: "project",
  contactChannel: "contact_channel",
  faqItem: "faq_item",
  location: "location",
} as const;

/** Cache tags, so a webhook can revalidate one entity class at a time. */
export const TAGS = {
  products: "products",
  collections: "collections",
  metaobjects: "metaobjects",
  content: "content",
} as const;

/** ISR windows in seconds. Catalogue moves slowly; CMS copy moves less. */
export const REVALIDATE = {
  products: 60 * 15,
  collections: 60 * 30,
  metaobjects: 60 * 30,
  content: 60 * 60,
} as const;

/**
 * Sort options offered in the UI. Price and availability are deliberately
 * absent — see the inquiry-only business model.
 */
export const SORT_OPTIONS = [
  { value: "relevance", label: "relevance", sortKey: "RELEVANCE", reverse: false },
  { value: "newest", label: "newest", sortKey: "CREATED_AT", reverse: true },
  { value: "a-z", label: "a–z", sortKey: "TITLE", reverse: false },
  { value: "z-a", label: "z–a", sortKey: "TITLE", reverse: true },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortValue = "relevance";

export function resolveSort(value?: string | null) {
  return SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
}

/**
 * Collection.products takes ProductCollectionSortKeys, which has no CREATED_AT
 * and no RELEVANCE outside a search context.
 */
export function resolveCollectionSort(value?: string | null) {
  switch (value) {
    case "newest":
      return { sortKey: "CREATED", reverse: true } as const;
    case "a-z":
      return { sortKey: "TITLE", reverse: false } as const;
    case "z-a":
      return { sortKey: "TITLE", reverse: true } as const;
    default:
      return { sortKey: "COLLECTION_DEFAULT", reverse: false } as const;
  }
}

export const PRODUCTS_PER_PAGE = 24;
