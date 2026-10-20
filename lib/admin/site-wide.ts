/**
 * The Site-wide screen: settings that belong to the whole site rather than to one page,
 * gathered as tabs on ONE screen instead of a sidebar row each.
 *
 * Two kinds of tab:
 *  - SINGLETON — one entry, so the tab IS the form. A list with a single row and a
 *    click-through to edit it is ceremony.
 *  - COLLECTION — several entries, so the tab embeds the same table the type's own
 *    list screen would show. Rows still open `/admin/<type>/<id>`, whose back link
 *    returns here.
 *
 * Every type listed here leaves the sidebar, and its old list URL `/admin/<type>`
 * redirects to its tab, so a bookmark or a breadcrumb still lands somewhere.
 *
 * Plain data, no `server-only`: the breadcrumb and the sidebar read it too.
 */

export const SITE_WIDE_HREF = "/admin/site-wide";

export type SiteWideSection = {
  type: string;
  /** Tab label — overrides the module label, which is written for a sidebar row. */
  label: string;
  kind: "singleton" | "collection";
  /** One line under the tabs: what this is for and who reads it. */
  description: string;
  /** Singletons only: what creates the entry, for the empty state. */
  setup?: string;
};

/** Tab order. */
export const SITE_WIDE_SECTIONS: SiteWideSection[] = [
  {
    type: "site_settings",
    label: "Site settings",
    kind: "singleton",
    description:
      "Footer copy, contact call-to-action, social links and featured collections. Read by every storefront page.",
    setup: "node --env-file=.env scripts/add-site-settings.mjs",
  },
  {
    type: "location",
    label: "Locations",
    kind: "collection",
    description: "Showrooms and studios, shown on Our Locations and wherever a page links them.",
  },
  {
    type: "contact_channel",
    label: "Contact channels",
    kind: "collection",
    description: "Email, phone and social rows on the Contact page.",
  },
  {
    type: "email_notification",
    label: "Email notifications",
    kind: "collection",
    description:
      "Who receives the staff copy of each storefront email. A type without an entry uses 'default'; a disabled entry mutes its type.",
  },
  {
    type: "admin_settings",
    label: "Admin panel",
    kind: "singleton",
    description:
      "This panel's own name, logo, browser-tab icon and dashboard heading. Not the storefront. Light/dark is per person, in the sidebar.",
    setup: "node --env-file=.env scripts/add-admin-settings.mjs",
  },
];

const BY_TYPE = new Map(SITE_WIDE_SECTIONS.map((section) => [section.type, section]));

export function siteWideSection(type: string): SiteWideSection | undefined {
  return BY_TYPE.get(type);
}

export function isSiteWide(type: string): boolean {
  return BY_TYPE.has(type);
}

export function siteWideTabHref(type: string): string {
  return `${SITE_WIDE_HREF}?tab=${encodeURIComponent(type)}`;
}

/**
 * Where "back" goes from a type's entry or new-entry screen: its Site-wide tab when it
 * has one, otherwise its own list.
 */
export function listHrefFor(type: string): string {
  return isSiteWide(type) ? siteWideTabHref(type) : `/admin/${type}`;
}
