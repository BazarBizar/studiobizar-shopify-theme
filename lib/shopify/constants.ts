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

/**
 * The `site_settings` singleton, created by `scripts/add-site-settings.mjs`.
 *
 * Not in METAOBJECT_TYPES below because that list is what schema-push provisions,
 * and this one is not schema-push's. The handle is fixed: there is exactly one
 * entry and every reader asks for it by name rather than taking the first row of
 * a list, so a second entry created by accident changes nothing.
 */
export const SITE_SETTINGS_TYPE = "site_settings";
export const SITE_SETTINGS_HANDLE = "site-settings";

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
 *
 * `relevance` USED TO BE HERE AND WAS THE DEFAULT. It is gone because
 * `RELEVANCE` is a sort key Shopify only defines inside a search context; on a
 * plain `products()` query it produces no stable order, and cursor pagination
 * over an unstable order loses and repeats records.
 *
 * That was not a small effect. Walking the whole catalogue 24 at a time — which
 * is exactly what /shop's infinite scroll does — returned **192 of 1,595
 * products, with 144 duplicates**, and stopped after 15 pages instead of 67. A
 * visitor on the default setting was seeing about an eighth of the catalogue,
 * with no error anywhere to say so.
 *
 * All three keys below were measured over the same walk and each returned 1,595
 * distinct products in 67 pages. `search()` still sorts by RELEVANCE, and that
 * is correct — there it has a query to be relevant to, and it does not go
 * through `resolveSort`.
 */
export const SORT_OPTIONS = [
  { value: "newest", label: "newest", sortKey: "CREATED_AT", reverse: true },
  { value: "a-z", label: "a–z", sortKey: "TITLE", reverse: false },
  { value: "z-a", label: "z–a", sortKey: "TITLE", reverse: true },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Also what `resolveSort` falls back to, so an unrecognised `?sort=` in the URL
 * — or none at all — lands on a key that pages completely.
 */
export const DEFAULT_SORT: SortValue = "newest";

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
