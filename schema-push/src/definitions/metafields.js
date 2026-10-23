/**
 * Metafield definitions for PRODUCT, COLLECTION, PAGE and SHOP owners.
 *
 * All live in the `custom` namespace so the Liquid theme reads them as
 * `product.metafields.custom.designer`, `collection.metafields.custom.hero_image`,
 * `page.metafields.custom.hero_slides`, and so on.
 *
 * Anything typed `metaobject_reference` / `list.metaobject_reference` carries the
 * same `metaobjectType` placeholder used in metaobjects.js — the pusher resolves
 * it to a real gid before sending. Those metaobject definitions must therefore
 * exist first; `push --only=metafields` on a fresh store will fail loudly rather
 * than create a dangling reference.
 */

import { IMAGE_ONLY, metaobjectRef } from './metaobjects.js';

export const NAMESPACE = 'custom';

/* -------------------------------------------------------------------- *
 * B. PRODUCT
 * -------------------------------------------------------------------- */
const product = [
  {
    key: 'designer',
    name: 'Designer',
    type: 'metaobject_reference',
    validations: [metaobjectRef('designer')],
    description: 'The designer behind this piece.',
  },
  { key: 'collection_label', name: 'Collection Label', type: 'single_line_text_field' },
  { key: 'signature_collection', name: 'Signature Collection', type: 'collection_reference' },
  { key: 'is_new', name: 'Is New', type: 'boolean' },
  { key: 'material_finish', name: 'Material / Finish', type: 'single_line_text_field' },
  { key: 'colour', name: 'Colour', type: 'single_line_text_field' },
  { key: 'upholstery', name: 'Upholstery', type: 'single_line_text_field' },
  { key: 'availability', name: 'Availability', type: 'single_line_text_field' },
  { key: 'technical_specifications', name: 'Technical Specifications', type: 'rich_text_field' },
  { key: 'dimensions', name: 'Dimensions', type: 'rich_text_field' },
  { key: 'care_maintenance', name: 'Care & Maintenance', type: 'rich_text_field' },
  { key: 'shipping_delivery', name: 'Shipping & Delivery', type: 'rich_text_field' },
  { key: 'downloads', name: 'Downloads', type: 'list.file_reference' },
  { key: 'idea_body', name: 'The Idea — Body', type: 'rich_text_field' },
  { key: 'idea_image', name: 'The Idea — Image', type: 'file_reference', validations: [IMAGE_ONLY] },
  {
    key: 'in_context_images',
    name: 'In Context Images',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('captioned_image')],
  },
  { key: 'moq', name: 'Minimum Order Quantity', type: 'number_integer' },
  { key: 'lead_time_weeks', name: 'Lead Time', type: 'single_line_text_field' },
];

/* -------------------------------------------------------------------- *
 * C. COLLECTION
 * -------------------------------------------------------------------- */
const collection = [
  { key: 'is_signature', name: 'Is Signature Collection', type: 'boolean' },
  { key: 'hero_image', name: 'Hero Image', type: 'file_reference', validations: [IMAGE_ONLY] },
  { key: 'hero_logo', name: 'Hero Logo', type: 'file_reference', validations: [IMAGE_ONLY] },
  { key: 'card_image', name: 'Card Image', type: 'file_reference', validations: [IMAGE_ONLY] },
  {
    key: 'designer',
    name: 'Designer',
    type: 'metaobject_reference',
    validations: [metaobjectRef('designer')],
  },
  { key: 'idea_title', name: 'The Idea — Title', type: 'single_line_text_field' },
  { key: 'idea_body', name: 'The Idea — Body', type: 'rich_text_field' },
  { key: 'idea_image', name: 'The Idea — Image', type: 'file_reference', validations: [IMAGE_ONLY] },
  {
    key: 'in_context_projects',
    name: 'In Context Projects',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('project')],
  },
  { key: 'sort_order', name: 'Sort Order', type: 'number_integer' },
];

/* -------------------------------------------------------------------- *
 * D. PAGE
 *
 * Page metafields apply to every page in the store. That is fine and
 * intended — each page only fills in the handful of fields it needs
 * (home uses hero_slides/story_block_*, contact uses channels, etc.).
 * -------------------------------------------------------------------- */
const page = [
  {
    key: 'hero_slides',
    name: 'Hero Slides',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('captioned_image')],
  },
  { key: 'story_block_1', name: 'Story Block 1', type: 'rich_text_field' },
  {
    key: 'feature_images',
    name: 'Feature Images',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('captioned_image')],
  },
  { key: 'story_block_2', name: 'Story Block 2', type: 'rich_text_field' },
  {
    key: 'gallery',
    name: 'Gallery',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('captioned_image')],
  },
  { key: 'intro_body', name: 'Intro Body', type: 'rich_text_field' },
  // Landing page's "Selected Project" band — separate from `intro_body`,
  // which that page already spends on "Our Services".
  { key: 'projects_intro', name: 'Projects Intro', type: 'rich_text_field' },
  {
    key: 'channels',
    name: 'Contact Channels',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('contact_channel')],
  },
  { key: 'inquiry_types', name: 'Inquiry Types', type: 'list.single_line_text_field' },
  // Our Locations page.
  {
    key: 'locations',
    name: 'Locations',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('location')],
  },

  /* ------------------------------------------------------------------ *
   * Landing page. The home page picks which collection feeds each of its
   * two product carousels, rather than the choice being hard-coded, so
   * the rows can be re-pointed from the admin without a deploy.
   * ------------------------------------------------------------------ */
  { key: 'new_in', name: 'New In (collection)', type: 'collection_reference' },
  {
    key: 'monthly_selection',
    name: 'Monthly Selection (collection)',
    type: 'collection_reference',
  },
  { key: 'story_image', name: 'Story Image', type: 'file_reference', validations: [IMAGE_ONLY] },

  /* ------------------------------------------------------------------ *
   * Page builder (lib/page-builder/document.ts). Three copies of one JSON
   * document. Only the PUBLISHED copy is readable by the storefront — the
   * draft and the rollback copy are `storefrontAccess: 'NONE'`, so an
   * unpublished draft cannot be fetched through the Storefront API at all.
   * Written only by /api/admin/pages/builder, which validates every section.
   * ------------------------------------------------------------------ */
  {
    key: 'sections',
    name: 'Page Builder — Published',
    type: 'json',
    pin: false,
    description: 'Managed by the page builder in the admin panel. Do not edit by hand.',
  },
  {
    key: 'sections_draft',
    name: 'Page Builder — Draft',
    type: 'json',
    storefrontAccess: 'NONE',
    pin: false,
    description: 'Managed by the page builder in the admin panel. Do not edit by hand.',
  },
  {
    key: 'sections_previous',
    name: 'Page Builder — Previous version',
    type: 'json',
    storefrontAccess: 'NONE',
    pin: false,
    description: 'Managed by the page builder in the admin panel. Do not edit by hand.',
  },
];

/* -------------------------------------------------------------------- *
 * E. SHOP — the Theme Builder (lib/theme-builder/layout.ts). The site's header
 * and footer as one JSON document, three copies like a page's: only the
 * PUBLISHED copy is storefront-readable; the draft and the rollback copy are
 * `storefrontAccess: 'NONE'`. Written only by /api/admin/theme-builder.
 * Until the published copy exists the storefront draws its original header and
 * footer.
 * -------------------------------------------------------------------- */
const shop = [
  {
    key: 'theme_layout',
    name: 'Theme Builder — Published',
    type: 'json',
    pin: false,
    description: 'Header and footer, managed by the Theme Builder in the admin panel. Do not edit by hand.',
  },
  {
    key: 'theme_layout_draft',
    name: 'Theme Builder — Draft',
    type: 'json',
    storefrontAccess: 'NONE',
    pin: false,
    description: 'Header and footer, managed by the Theme Builder in the admin panel. Do not edit by hand.',
  },
  {
    key: 'theme_layout_previous',
    name: 'Theme Builder — Previous version',
    type: 'json',
    storefrontAccess: 'NONE',
    pin: false,
    description: 'Header and footer, managed by the Theme Builder in the admin panel. Do not edit by hand.',
  },
];

/**
 * Flattened list — every entry carries its ownerType and namespace so the
 * pusher can group and filter without extra bookkeeping.
 */
export const metafieldDefinitions = [
  ...product.map((d) => ({ ...d, ownerType: 'PRODUCT', namespace: NAMESPACE })),
  ...collection.map((d) => ({ ...d, ownerType: 'COLLECTION', namespace: NAMESPACE })),
  ...page.map((d) => ({ ...d, ownerType: 'PAGE', namespace: NAMESPACE })),
  ...shop.map((d) => ({ ...d, ownerType: 'SHOP', namespace: NAMESPACE })),
];

/** Owner types this script touches, in the order they are pushed. */
export const OWNER_TYPES = ['PRODUCT', 'COLLECTION', 'PAGE', 'SHOP'];
