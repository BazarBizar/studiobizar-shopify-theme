/**
 * Metaobject definitions, in dependency order.
 *
 * ORDER MATTERS. A definition that is referenced by another one must appear
 * first, because the referencing field needs the target's `gid` in its
 * `metaobject_definition_id` validation, and that gid only exists once the
 * target has been created. `push-metaobjects.js` walks this array top to bottom
 * and keeps a `type -> gid` map as it goes.
 *
 * Field validations use a small placeholder: instead of a literal
 *   { name: 'metaobject_definition_id', value: 'gid://shopify/MetaobjectDefinition/123' }
 * we write
 *   { name: 'metaobject_definition_id', metaobjectType: 'captioned_image' }
 * and the pusher swaps `metaobjectType` for the real gid at runtime.
 */

/** Restrict a file_reference to images (no video / PDF). */
export const IMAGE_ONLY = { name: 'file_type_options', value: JSON.stringify(['Image']) };

/** Fixed set of allowed values for a single_line_text_field. */
export const choices = (...values) => ({ name: 'choices', value: JSON.stringify(values) });

/** Placeholder resolved to a MetaobjectDefinition gid during the push. */
export const metaobjectRef = (type) => ({ name: 'metaobject_definition_id', metaobjectType: type });

export const metaobjectDefinitions = [
  /* ------------------------------------------------------------------ *
   * A1. captioned_image — referenced by project, product and page.
   *     Must be created first. No template needed.
   * ------------------------------------------------------------------ */
  {
    type: 'captioned_image',
    name: 'Captioned Image',
    description: 'A single image with caption, alt text and photo credit.',
    displayNameKey: 'caption',
    publishable: false,
    fields: [
      { key: 'image', name: 'Image', type: 'file_reference', required: true, validations: [IMAGE_ONLY] },
      { key: 'caption', name: 'Caption', type: 'single_line_text_field' },
      { key: 'alt_text', name: 'Alt Text', type: 'single_line_text_field' },
      { key: 'credit', name: 'Credit', type: 'single_line_text_field' },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A2. designer — referenced by product.designer and collection.designer.
   *     publishable so entries can be drafted before going live.
   * ------------------------------------------------------------------ */
  {
    type: 'designer',
    name: 'Designer',
    description: 'A designer or studio behind a product or collection.',
    displayNameKey: 'name',
    publishable: true,
    // Entries render at /pages/designers/{handle} from
    // templates/metaobject/designer.json in the theme.
    onlineStore: { urlHandle: 'designers' },
    renderable: { metaTitleKey: 'name', metaDescriptionKey: 'bio_short' },
    fields: [
      { key: 'name', name: 'Name', type: 'single_line_text_field', required: true },
      { key: 'studio', name: 'Studio', type: 'single_line_text_field' },
      { key: 'byline', name: 'Byline', type: 'single_line_text_field', required: true },
      { key: 'portrait', name: 'Portrait', type: 'file_reference', required: true, validations: [IMAGE_ONLY] },
      { key: 'portrait_alt', name: 'Portrait Alt Text', type: 'single_line_text_field' },
      { key: 'bio_short', name: 'Short Bio', type: 'multi_line_text_field' },
      { key: 'bio_full', name: 'Full Bio', type: 'rich_text_field', required: true },
      { key: 'sort_order', name: 'Sort Order', type: 'number_integer' },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A3. project — references captioned_image (created above) AND ITSELF
   *     via `related_projects`.
   *
   *     THE SELF-REFERENCE: a definition cannot reference its own gid at
   *     create time, because that gid does not exist until the create call
   *     returns. `related_projects` is therefore marked `deferred: true`:
   *     the pusher omits it from metaobjectDefinitionCreate, then adds it in
   *     a second pass with metaobjectDefinitionUpdate once the gid is known.
   *     See the "deferred fields" section of push-metaobjects.js.
   * ------------------------------------------------------------------ */
  {
    type: 'project',
    name: 'Project',
    description: 'A realised interior project featuring Studio Bizar pieces.',
    displayNameKey: 'title',
    publishable: true,
    // Entries render at /pages/projects/{handle} from
    // templates/metaobject/project.json in the theme.
    onlineStore: { urlHandle: 'projects' },
    renderable: { metaTitleKey: 'title', metaDescriptionKey: 'subtitle' },
    fields: [
      { key: 'title', name: 'Title', type: 'single_line_text_field', required: true },
      { key: 'subtitle', name: 'Subtitle', type: 'multi_line_text_field' },
      { key: 'location', name: 'Location', type: 'single_line_text_field', required: true },
      // Deliberately text, not number_integer — allows "2023-2024" and "Ongoing".
      { key: 'year', name: 'Year', type: 'single_line_text_field', required: true },
      {
        key: 'category',
        name: 'Category',
        type: 'single_line_text_field',
        required: true,
        validations: [choices('Commercial', 'Hospitality', 'Residential')],
      },
      { key: 'hero_image', name: 'Hero Image', type: 'file_reference', required: true, validations: [IMAGE_ONLY] },
      { key: 'card_image', name: 'Card Image', type: 'file_reference', validations: [IMAGE_ONLY] },
      { key: 'body', name: 'Body', type: 'rich_text_field', required: true },
      { key: 'creative_lead', name: 'Creative Lead', type: 'single_line_text_field' },
      { key: 'collaborators', name: 'Collaborators', type: 'multi_line_text_field' },
      { key: 'photography', name: 'Photography', type: 'single_line_text_field' },
      {
        key: 'gallery',
        name: 'Gallery',
        type: 'list.metaobject_reference',
        required: true,
        validations: [metaobjectRef('captioned_image')],
      },
      { key: 'featured_items', name: 'Featured Items', type: 'list.product_reference' },
      {
        key: 'related_projects',
        name: 'Related Projects',
        type: 'list.metaobject_reference',
        validations: [metaobjectRef('project')],
        // Self-reference — added in the deferred second pass, never at create time.
        deferred: true,
      },
      { key: 'sort_order', name: 'Sort Order', type: 'number_integer' },
      { key: 'is_selected', name: 'Is Selected', type: 'boolean' },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A4. contact_channel — referenced by page.channels.
   * ------------------------------------------------------------------ */
  {
    type: 'contact_channel',
    name: 'Contact Channel',
    description: 'One row on the contact page: label, value and how to link it.',
    displayNameKey: 'label',
    publishable: false,
    fields: [
      { key: 'label', name: 'Label', type: 'single_line_text_field', required: true },
      { key: 'value', name: 'Value', type: 'single_line_text_field', required: true },
      {
        key: 'link_type',
        name: 'Link Type',
        type: 'single_line_text_field',
        required: true,
        validations: [choices('email', 'phone', 'url', 'text')],
      },
      { key: 'link_url', name: 'Link URL', type: 'url' },
      { key: 'sort_order', name: 'Sort Order', type: 'number_integer', required: true },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A5. faq_item — standalone, referenced by nothing.
   * ------------------------------------------------------------------ */
  {
    type: 'faq_item',
    name: 'FAQ Item',
    description: 'A single question and answer.',
    displayNameKey: 'question',
    publishable: false,
    fields: [
      { key: 'question', name: 'Question', type: 'single_line_text_field', required: true },
      { key: 'answer', name: 'Answer', type: 'rich_text_field', required: true },
      { key: 'category', name: 'Category', type: 'single_line_text_field' },
      { key: 'sort_order', name: 'Sort Order', type: 'number_integer' },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A6. service — the ten entries listed on the Our Services page.
   * ------------------------------------------------------------------ */
  {
    type: 'service',
    name: 'Service',
    description: 'One offering in the Design Program, e.g. "Concept Development".',
    displayNameKey: 'title',
    publishable: false,
    fields: [
      { key: 'title', name: 'Title', type: 'single_line_text_field', required: true },
      { key: 'body', name: 'Body', type: 'rich_text_field' },
      { key: 'sort_order', name: 'Sort Order', type: 'number_integer' },
    ],
  },

  /* ------------------------------------------------------------------ *
   * A7. inquiry — a submitted product inquiry.
   *
   *     Written by the storefront (POST /api/inquiry), not by hand in the
   *     admin, so `inquiry_id` doubles as the handle. `items` is JSON rather
   *     than product references: it has to survive a product being renamed or
   *     deleted, because it is a record of what was asked for at the time.
   * ------------------------------------------------------------------ */
  {
    type: 'inquiry',
    name: 'Inquiry',
    description: 'A product inquiry submitted from the storefront.',
    displayNameKey: 'inquiry_id',
    publishable: false,
    fields: [
      { key: 'inquiry_id', name: 'Inquiry ID', type: 'single_line_text_field', required: true },
      { key: 'submitted_at', name: 'Submitted At', type: 'date_time', required: true },
      { key: 'customer_name', name: 'Customer Name', type: 'single_line_text_field', required: true },
      { key: 'company', name: 'Company', type: 'single_line_text_field' },
      { key: 'email', name: 'Email', type: 'single_line_text_field', required: true },
      { key: 'phone', name: 'Phone', type: 'single_line_text_field' },
      { key: 'message', name: 'Message', type: 'multi_line_text_field' },
      { key: 'items', name: 'Items', type: 'json', required: true },
      { key: 'total_products', name: 'Total Products', type: 'number_integer', required: true },
      { key: 'total_quantity', name: 'Total Quantity', type: 'number_integer', required: true },
      {
        key: 'status',
        name: 'Status',
        type: 'single_line_text_field',
        required: true,
        validations: [choices('new', 'contacted', 'closed')],
      },
    ],
  },
];

/*
 * ---------------------------------------------------------------------------
 * NOTE ON THEME PAGES FOR designer / project
 * ---------------------------------------------------------------------------
 * `publishable: true` gives entries a draft/active status. It does NOT give
 * them a URL of their own. If you want /designers/<handle> to render from a
 * Liquid template, the definition also needs the onlineStore capability.
 *
 * To turn that on, add this line to the definition above:
 *
 *   onlineStore: { urlHandle: 'designers' },
 *
 * push-metaobjects.js expands that into the full capabilities payload
 * (renderable + onlineStore + createRedirects). It is left off by default
 * because it changes the storefront URL structure.
 * ---------------------------------------------------------------------------
 */
