/**
 * The Online Store pages behind the header and footer navigation.
 *
 *   header   Products · Collections · Projects · Services
 *                                    About · Info · Professionals
 *   footer   ABOUT  Our Story · Our Services · Projects · Items
 *            INFO   FAQ · Careers · Contact
 *            LEGAL  Privacy Policy · Terms & Conditions ·
 *                   Shipping & Delivery · Returns & Refunds
 *
 * Handles are the contract. `definitions/menus.js` points at pages by handle
 * and the pusher resolves each one to a gid, exactly like the metaobject
 * references. Renaming a handle here means re-pointing the menu item too.
 *
 * `templateSuffix` maps onto shopify_theme/templates/page.<suffix>.json:
 *   projects -> page.projects.json  (desk-page-header + desk-project-list)
 *   contact  -> page.contact.json   (main-page + contact-form)
 * Those two pages get no body — their template supplies the content.
 *
 * Products and Items are not pages: they point at the catalogue collection,
 * and Collections points at the collection list. See menus.js.
 */

/** Neutral filler so a freshly created page is not blank on the storefront. */
const placeholder = (title) =>
  `<p>${title} — placeholder copy. Replace this in Online Store &rsaquo; Pages.</p>`;

export const pageDefinitions = [
  { handle: 'our-story', title: 'Our Story', body: placeholder('Our Story') },
  { handle: 'our-services', title: 'Our Services', body: placeholder('Our Services') },
  { handle: 'projects', title: 'Projects', templateSuffix: 'projects' },
  { handle: 'professionals', title: 'Professionals', body: placeholder('Professionals') },
  { handle: 'faq', title: 'FAQ', body: placeholder('FAQ') },
  { handle: 'careers', title: 'Careers', body: placeholder('Careers') },
  { handle: 'contact', title: 'Contact', templateSuffix: 'contact' },

  /*
   * The LEGAL column. Shopify's own shop policies are preferred by the menu
   * pusher whenever the store has them written; these pages are the fallback
   * so the footer never links to an empty /policies/ URL.
   */
  { handle: 'privacy-policy', title: 'Privacy Policy', body: placeholder('Privacy Policy') },
  {
    handle: 'terms-conditions',
    title: 'Terms & Conditions',
    body: placeholder('Terms &amp; Conditions'),
  },
  {
    handle: 'shipping-delivery',
    title: 'Shipping & Delivery',
    body: placeholder('Shipping &amp; Delivery'),
  },
  {
    handle: 'returns-refunds',
    title: 'Returns & Refunds',
    body: placeholder('Returns &amp; Refunds'),
  },
];
