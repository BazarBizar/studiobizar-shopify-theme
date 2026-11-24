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
  // Page builder — the PUBLISHED document only. `sections_draft` and
  // `sections_previous` are storefront access NONE and must never be listed here.
  "sections",
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

/**
 * The `site_identity` singleton (`scripts/add-site-identity.mjs`): logo, browser-tab
 * icon, name and search/share defaults. Asked for by handle, like site_settings.
 */
export const SITE_IDENTITY_TYPE = "site_identity";
export const SITE_IDENTITY_HANDLE = "site-identity";

/** Metaobject types provisioned by schema-push. */
export const METAOBJECT_TYPES = {
  captionedImage: "captioned_image",
  designer: "designer",
  project: "project",
  contactChannel: "contact_channel",
  faqItem: "faq_item",
  location: "location",
} as const;

/** Cache tags, so a write or a webhook can revalidate one entity class at a time. */
export const TAGS = {
  products: "products",
  collections: "collections",
  metaobjects: "metaobjects",
  content: "content",
  /** The list of pages (the sitemap) — a publish or delete changes it, an edit does not. */
  pages: "pages",
} as const;

/**
 * One page's own document (`getPage(handle)`), so publishing a page refreshes that page
 * and not every page on the site. `getPage` also carries `content`, so the site-wide
 * drops (menus, header and footer, site texts) still reach it.
 */
export const pageTag = (handle: string) => `page:${handle}`;

/**
 * One template's published document (`getPublishedTemplate`) — publishing the product
 * template refreshes the product pages, not every page on the site. Read under
 * `content` too, so the site-wide drops still reach it.
 */
export const templateTag = (kind: string) => `template:${kind}`;

/**
 * ISR windows in seconds — A SAFETY NET, NOT THE WAY CHANGES ARRIVE.
 *
 * Every change made in the panel drops the matching tag at once (`lib/admin/revalidate.ts`),
 * and Shopify's product, collection and metaobject webhooks do the same for changes made in
 * Shopify itself (`app/api/webhooks/shopify`). So the window only decides how long
 * something changed BEHIND both of them can stay old — and how often every cached page is
 * re-drawn for nothing. A day keeps that cost low.
 *
 * All four are the same on purpose: a page is re-drawn at the SHORTEST window of anything
 * on it, and every page carries the header and footer (`content`, `metaobjects`), so one
 * shorter window would quietly set the pace for the whole site.
 */
const DAY = 60 * 60 * 24;
export const REVALIDATE = {
  products: DAY,
  collections: DAY,
  metaobjects: DAY,
  content: DAY,
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
