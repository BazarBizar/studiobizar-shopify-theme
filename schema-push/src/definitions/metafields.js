/**
 * Metafield definitions for PRODUCT, COLLECTION and PAGE owners.
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
  {
    key: 'channels',
    name: 'Contact Channels',
    type: 'list.metaobject_reference',
    validations: [metaobjectRef('contact_channel')],
  },
  { key: 'inquiry_types', name: 'Inquiry Types', type: 'list.single_line_text_field' },
];

/**
 * Flattened list — every entry carries its ownerType and namespace so the
 * pusher can group and filter without extra bookkeeping.
 */
export const metafieldDefinitions = [
  ...product.map((d) => ({ ...d, ownerType: 'PRODUCT', namespace: NAMESPACE })),
  ...collection.map((d) => ({ ...d, ownerType: 'COLLECTION', namespace: NAMESPACE })),
  ...page.map((d) => ({ ...d, ownerType: 'PAGE', namespace: NAMESPACE })),
];

/** Owner types this script touches, in the order they are pushed. */
export const OWNER_TYPES = ['PRODUCT', 'COLLECTION', 'PAGE'];
