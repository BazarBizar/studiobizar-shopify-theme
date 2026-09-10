/**
 * The icon for each sidebar row, chosen to match what the row IS rather than which group
 * it sits in.
 *
 * This replaces one-icon-per-group. With a handful of rows a shared group icon reads as
 * decoration — five identical marks down the sidebar carry no information and the label
 * does all the work. A distinct icon per row is what makes the list scannable at a
 * glance, which is the only reason to have icons at all.
 *
 * Keyed by Shopify metaobject TYPE and by the bespoke screens' paths, because those are
 * the two kinds of row the sidebar builds. A type with no entry here falls back to the
 * group's icon, so a definition created in Shopify tomorrow still gets a sensible mark —
 * the same promise auto-discovery makes everywhere else.
 */

import {
  BoxIcon,
  BuildingIcon,
  FileTextIcon,
  HelpCircleIcon,
  ImagesIcon,
  InboxIcon,
  LayersIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MapPinIcon,
  PackageIcon,
  PencilRulerIcon,
  PhoneIcon,
  SettingsIcon,
  ShapesIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";

/** Metaobject type -> icon. */
const BY_TYPE: Record<string, LucideIcon> = {
  designer: PencilRulerIcon,
  project: BuildingIcon,
  captioned_image: ImagesIcon,
  service: LayersIcon,
  faq_item: HelpCircleIcon,
  location: MapPinIcon,
  contact_channel: PhoneIcon,
  inquiry: InboxIcon,
  site_settings: SettingsIcon,
};

/** Bespoke screens, keyed by their path. */
const BY_HREF: Record<string, LucideIcon> = {
  "/admin": LayoutDashboardIcon,
  "/admin/products": PackageIcon,
  "/admin/collections": BoxIcon,
  "/admin/customers": UsersRoundIcon,
};

/** Last resort, by group, so an unclassified new definition still gets a mark. */
const BY_GROUP: Record<string, LucideIcon> = {
  catalogue: LayersIcon,
  pages: FileTextIcon,
  library: ImagesIcon,
  inbox: InboxIcon,
  settings: SettingsIcon,
  other: ShapesIcon,
};

export function navIconName(
  href: string,
  type: string | null,
  group: string,
): LucideIcon {
  return (
    BY_HREF[href] ??
    (type ? BY_TYPE[type] : undefined) ??
    BY_GROUP[group] ??
    ShapesIcon
  );
}

export { UserRoundIcon };
