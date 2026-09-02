import type { MenuLink } from "./shopify/types";

/** Menu handles created by `schema-push`. */
export const MENUS = {
  primary: "desk-primary",
  secondary: "desk-secondary",
  footerAbout: "desk-footer-about",
  footerInfo: "desk-footer-info",
  footerLegal: "desk-footer-legal",
} as const;

/**
 * Used when Shopify is unreachable or a menu has been deleted, so the shell
 * still renders a usable nav instead of collapsing.
 */
export const FALLBACK_NAV: Record<keyof typeof MENUS, MenuLink[]> = {
  primary: [
    { id: "f-products", title: "Products", href: "/shop", items: [] },
    { id: "f-collections", title: "Collections", href: "/collections", items: [] },
    { id: "f-projects", title: "Projects", href: "/projects", items: [] },
    { id: "f-services", title: "Services", href: "/services", items: [] },
  ],
  secondary: [
    { id: "f-about", title: "About", href: "/our-story", items: [] },
    { id: "f-info", title: "Info", href: "/faq", items: [] },
    { id: "f-professionals", title: "Professionals", href: "/professionals", items: [] },
  ],
  footerAbout: [
    { id: "f-our-story", title: "Our Story", href: "/our-story", items: [] },
    { id: "f-our-services", title: "Our Services", href: "/services", items: [] },
    { id: "f-f-projects", title: "Projects", href: "/projects", items: [] },
    { id: "f-items", title: "Items", href: "/shop", items: [] },
  ],
  footerInfo: [
    { id: "f-faq", title: "FAQ", href: "/faq", items: [] },
    { id: "f-careers", title: "Careers", href: "/careers", items: [] },
    { id: "f-contact", title: "Contact", href: "/contact", items: [] },
  ],
  footerLegal: [
    { id: "f-privacy", title: "Privacy Policy", href: "/legal/privacy-policy", items: [] },
    { id: "f-terms", title: "Terms & Conditions", href: "/legal/terms-conditions", items: [] },
    { id: "f-shipping", title: "Shipping & Delivery", href: "/legal/shipping-delivery", items: [] },
    { id: "f-returns", title: "Returns & Refunds", href: "/legal/returns-refunds", items: [] },
  ],
};

export const FOOTER_COLUMNS = [
  { heading: "About", key: "footerAbout" },
  { heading: "Info", key: "footerInfo" },
  { heading: "Legal", key: "footerLegal" },
] as const;
