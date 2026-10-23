import "server-only";

import { ROUTES, routeForPageHandle, shopifyUrlToRoute } from "@/lib/routes";

/**
 * Where a link can point, as the link picker offers it — in the page builder and the
 * Theme Builder alike. Visible pages only: a link to a hidden one 404s.
 */
export function linkTargetsFrom(
  pages: { title: string; handle: string; isPublished: boolean }[],
  collections: { title: string; handle: string }[],
) {
  return [
    ...pages
      .filter((entry) => entry.isPublished)
      .map((entry) => ({ label: entry.title, href: routeForPageHandle(entry.handle), group: "Pages" as const })),
    ...collections
      .filter((collection) => collection.handle !== "frontpage")
      .map((collection) => ({
        label: collection.title,
        href: shopifyUrlToRoute(`/collections/${collection.handle}`),
        group: "Collections" as const,
      })),
    { label: "Shop", href: ROUTES.shop, group: "Site" as const },
    { label: "All collections", href: ROUTES.collections, group: "Site" as const },
    { label: "Projects", href: ROUTES.projects, group: "Site" as const },
    { label: "Designers", href: ROUTES.designers, group: "Site" as const },
    { label: "Contact", href: ROUTES.contact, group: "Site" as const },
  ];
}
