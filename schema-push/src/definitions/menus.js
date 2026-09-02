/**
 * The header and footer navigation, one menu per nav in the design.
 *
 *   desk-primary        Products · Collections · Projects · Services
 *   desk-secondary      About · Info · Professionals
 *   desk-footer-about   Our Story · Our Services · Projects · Items
 *   desk-footer-info    FAQ · Careers · Contact
 *   desk-footer-legal   Privacy Policy · Terms & Conditions ·
 *                       Shipping & Delivery · Returns & Refunds
 *
 * Deliberately *not* `main-menu` / `footer`. Those two handles exist on every
 * Shopify store, pre-filled with Shopify's default links, and this script
 * overwrites nothing — pushing into them would either be skipped (leaving the
 * wrong nav live) or clobber a nav someone already built. Dedicated handles
 * sidestep both. The theme points at them from
 * shopify_theme/sections/header-group.json and footer-group.json.
 *
 * Item shapes — exactly one destination per item:
 *
 *   { page: 'faq' }                     PAGE, resolved from the page handle
 *   { collection: 'shop-all',
 *     fallbackType: 'CATALOG' }          COLLECTION, resolved from the handle;
 *                                        `fallbackType` is used when the store
 *                                        has no such collection yet
 *   { type: 'COLLECTIONS' }             a bare MenuItemType, no resource
 *   { policy: 'PRIVACY_POLICY',
 *     page: 'privacy-policy' }          SHOP_POLICY when the store has that
 *                                       policy written, else the page
 *   { url: 'https://…' }                HTTP
 *
 * Anything that cannot be resolved degrades to an HTTP link pointing at the
 * canonical storefront path, so a menu is never created with a dead item.
 */

/**
 * The catalogue collection. The theme's `collection.shop-all.json` template
 * suffix is meant to be assigned to it — see shopify_theme/README.md.
 */
export const CATALOGUE_COLLECTION = 'shop-all';

export const menuDefinitions = [
  {
    handle: 'desk-primary',
    title: 'DESK primary',
    items: [
      { title: 'Products', collection: CATALOGUE_COLLECTION, fallbackType: 'CATALOG' },
      { title: 'Collections', type: 'COLLECTIONS' },
      { title: 'Projects', page: 'projects' },
      { title: 'Services', page: 'our-services' },
    ],
  },
  {
    handle: 'desk-secondary',
    title: 'DESK secondary',
    items: [
      { title: 'About', page: 'our-story' },
      { title: 'Info', page: 'faq' },
      { title: 'Professionals', page: 'professionals' },
    ],
  },
  {
    handle: 'desk-footer-about',
    title: 'Footer — About',
    items: [
      { title: 'Our Story', page: 'our-story' },
      { title: 'Our Services', page: 'our-services' },
      { title: 'Projects', page: 'projects' },
      { title: 'Items', collection: CATALOGUE_COLLECTION, fallbackType: 'CATALOG' },
    ],
  },
  {
    handle: 'desk-footer-info',
    title: 'Footer — Info',
    items: [
      { title: 'FAQ', page: 'faq' },
      { title: 'Careers', page: 'careers' },
      { title: 'Contact', page: 'contact' },
    ],
  },
  {
    handle: 'desk-footer-legal',
    title: 'Footer — Legal',
    items: [
      { title: 'Privacy Policy', policy: 'PRIVACY_POLICY', page: 'privacy-policy' },
      { title: 'Terms & Conditions', policy: 'TERMS_OF_SERVICE', page: 'terms-conditions' },
      { title: 'Shipping & Delivery', policy: 'SHIPPING_POLICY', page: 'shipping-delivery' },
      { title: 'Returns & Refunds', policy: 'REFUND_POLICY', page: 'returns-refunds' },
    ],
  },
];
