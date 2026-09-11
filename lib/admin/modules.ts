import "server-only";

/**
 * MODULE HINTS — preferences, not a schema.
 *
 * Nothing in this file describes what fields a metaobject has; Shopify is the
 * only authority on that, and `fieldDefinitions` is read live at runtime. What
 * lives here is the part Shopify cannot know: which column an operator wants
 * first, which field is too long to put in a table, which integer means
 * "drag me", and which records are somebody else's writing.
 *
 * The consequences of that split, and the reason it is worth the indirection:
 *
 *  - A key listed here that no longer exists in Shopify is IGNORED, not rendered
 *    as an empty column.
 *  - A field in Shopify that is not mentioned here still appears, behind the
 *    column menu. It is never silently dropped.
 *  - A metaobject type with no module at all still works, through
 *    `genericModule()`. That is what makes "create a definition in Shopify and it
 *    shows up in the panel with no code change" true rather than aspirational.
 */

export type LoadStrategy = "client" | "server";

export type ModuleDef = {
  /** Sidebar and screen title. Defaults to the definition's own name. */
  label?: string;
  /** Preferred column order. Unlisted fields follow, behind the column menu. */
  columns?: string[];
  /** Offered as filters above the table. */
  facets?: string[];
  /** Never a column: rich text, long JSON, big reference lists. */
  neverColumn?: string[];
  /** Free-text search looks in these. */
  searchFields?: string[];
  /**
   * `number_integer` field that expresses manual ordering. The table sorts by it
   * by default and offers drag-to-reorder.
   */
  orderField?: string;
  /**
   * Whether an entry of this type may be DELETED from the panel. Defaults to true for a
   * writable type, so a content type added in Shopify tomorrow behaves like the rest.
   *
   * Set it false where something depends on the record EXISTING rather than on what it
   * contains — a singleton the storefront reads has no meaningful "deleted" state, it
   * just breaks. A read-only type is never deletable whatever this says; see
   * `isDeletable`.
   */
  deletable?: boolean;
  /**
   * Records this panel must not author. See `assertWritable` in
   * `lib/admin/metaobjects.ts` — enforced there, in the data layer, NOT by
   * hiding a button.
   */
  readOnly?: boolean;
  /**
   * The per-field exception to `readOnly`. An operator may mark an inquiry
   * "contacted" without being able to rewrite what the customer said.
   * Never applies to create: a read-only type cannot be authored at all.
   */
  editableFields?: string[];
  /**
   * "client" fetches the whole collection and sorts/filters in the browser. That
   * is correct ONLY because the entire set is in memory — a faceted filter over a
   * partial set silently omits matches.
   *
   * "server" pushes search, filter and sort to Shopify with cursor paging, for
   * collections with no upper bound. In that mode per-column sorting must be
   * turned OFF: a column that sorts the fifty rows which happen to be loaded
   * looks right and is wrong.
   */
  load?: LoadStrategy;
  /**
   * Offers an `.xlsx` export alongside the generic CSV one. Only worth it where the rows
   * have structure a spreadsheet can show better than a flat file — inquiries have line
   * items and product thumbnails, which CSV cannot carry at all.
   */
  excelExport?: boolean;
};

/**
 * Fields that are never worth a table cell whatever the type. Rich text and JSON
 * are paragraphs; reference lists are unbounded.
 */
const HEAVY_TYPES = new Set([
  "rich_text_field",
  "json",
  "multi_line_text_field",
  "list.metaobject_reference",
  "list.product_reference",
  "list.collection_reference",
  "list.file_reference",
]);

export function isHeavyType(type: string): boolean {
  return HEAVY_TYPES.has(type);
}

/**
 * Keyed by Shopify metaobject type. Every entry is optional — deleting one
 * degrades that screen to the generic defaults, it does not break it.
 */
export const MODULES: Record<string, ModuleDef> = {
  captioned_image: {
    label: "Images",
    columns: ["image", "caption", "credit", "alt_text"],
    searchFields: ["caption", "credit", "alt_text"],
    load: "client",
  },

  designer: {
    label: "Designers",
    columns: ["portrait", "name", "studio", "byline", "sort_order"],
    neverColumn: ["bio_full", "bio_short"],
    searchFields: ["name", "studio"],
    orderField: "sort_order",
    load: "client",
  },

  project: {
    label: "Projects",
    columns: ["card_image", "title", "category", "location", "year", "is_selected", "sort_order"],
    facets: ["category", "is_selected"],
    neverColumn: ["body", "gallery", "related_projects", "featured_items", "subtitle"],
    searchFields: ["title", "location", "creative_lead"],
    orderField: "sort_order",
    load: "client",
  },

  service: {
    label: "Services",
    columns: ["title", "sort_order"],
    neverColumn: ["body"],
    searchFields: ["title"],
    orderField: "sort_order",
    load: "client",
  },

  faq_item: {
    label: "FAQ",
    columns: ["question", "category", "sort_order"],
    facets: ["category"],
    neverColumn: ["answer"],
    searchFields: ["question", "category"],
    orderField: "sort_order",
    load: "client",
  },

  location: {
    label: "Locations",
    columns: ["image", "name", "kind", "phone", "email", "sort_order"],
    facets: ["kind"],
    neverColumn: ["address", "hours"],
    searchFields: ["name", "address"],
    orderField: "sort_order",
    load: "client",
  },

  contact_channel: {
    label: "Contact channels",
    columns: ["label", "value", "link_type", "link_url", "sort_order"],
    facets: ["link_type"],
    searchFields: ["label", "value"],
    orderField: "sort_order",
    load: "client",
  },

  site_settings: {
    label: "Site settings",
    /** A singleton: one entry, so the list screen is a formality. */
    columns: ["title", "featured_collections"],
    /**
     * NOT DELETABLE, though it is perfectly writable. Every screen that reads a site
     * setting reads THIS entry, so removing it does not delete a record nobody wants
     * any more — it removes the only place those settings can live. Putting it back
     * means running `scripts/add-site-settings.mjs` again.
     */
    deletable: false,
    load: "client",
  },


  inquiry: {
    label: "Inquiries",
    /**
     * READ-ONLY, with one exception.
     *
     * These records are written by customers through the storefront's inquiry
     * form. Editing one would be rewriting what somebody said they wanted, and
     * creating one from the panel would be inventing a submission that never
     * happened — so `create` is refused outright, with no exception list.
     *
     * `status` is the operator's own annotation rather than the customer's words,
     * so it is the single field a staff member may change.
     */
    readOnly: true,
    editableFields: ["status"],
    excelExport: true,
    columns: [
      "inquiry_id",
      "submitted_at",
      "customer_name",
      "company",
      "email",
      "total_quantity",
      "status",
    ],
    facets: ["status"],
    neverColumn: ["items", "message"],
    searchFields: ["inquiry_id", "customer_name", "email", "company"],
    /**
     * Client-side: the whole set fits in memory today (single digits), and the
     * faceted status filter is only correct over the COMPLETE set — filtering a
     * partial page would quietly hide matching inquiries. Move this to "server"
     * before the collection outgrows one page, and disable per-column sorting at
     * the same time.
     */
    load: "client",
  },
};

/**
 * The fallback for a definition nobody has written a module for — a type created
 * in Shopify five minutes ago, for instance. It has to produce something usable
 * from the field definitions alone.
 */
export function genericModule(): ModuleDef {
  return { load: "client" };
}

export function moduleFor(type: string): ModuleDef {
  return MODULES[type] ?? genericModule();
}

/** True when this panel may author entries of the type at all. */
export function isReadOnly(type: string): boolean {
  return moduleFor(type).readOnly === true;
}

/**
 * True when an entry of this type may be deleted here.
 *
 * A read-only type is never deletable, and that is NOT the same rule as
 * `editableFields`. An inquiry allows its `status` to be changed precisely because the
 * annotation is the operator's rather than the customer's — but there is no partial
 * delete, so the exception that makes an annotation safe does nothing for removal.
 *
 * The trash icon consults this. So does `assertDeletable`, which is the one that counts.
 */
export function isDeletable(type: string): boolean {
  const moduleDef = moduleFor(type);
  if (moduleDef.readOnly) return false;

  return moduleDef.deletable !== false;
}
