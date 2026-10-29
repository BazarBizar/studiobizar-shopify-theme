import { InfoIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/admin/detail-header";
import { MenuEditor } from "@/components/admin/menus-table/menu-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import {
  getMenu,
  isSiteMenu,
  listMenuDestinations,
  menuDisplayName,
  menuIdFromParam,
  menusInAppearance,
  menuUsedBy,
  MenuNotFoundError,
  productIdsIn,
} from "@/lib/admin/menus";

export const metadata = { title: "Menu" };

export default async function MenuDetail({ params }: PageProps<"/admin/menus/[id]">) {
  const { id } = await params;

  const gid = menuIdFromParam(id);
  if (!gid) notFound();

  let menu;
  try {
    menu = await getMenu(gid);
  } catch (error) {
    if (error instanceof MenuNotFoundError) notFound();
    throw error;
  }

  const [destinations, shown] = await Promise.all([
    listMenuDestinations(productIdsIn(menu.items)),
    // Unknown counts as shown: the editor then keeps the handle and offers no delete
    // (the server checks again either way).
    menusInAppearance().catch(() => null),
  ]);
  const usedBy = menuUsedBy(menu.handle);
  const inAppearance = shown ? shown.has(menu.handle) : true;

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/admin/menus"
        backLabel="Menus"
        title={menuDisplayName(menu)}
        meta={usedBy ?? (inAppearance ? "Shown in Appearance" : "Not shown yet")}
      />

      {menu.isDefault ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Not shown on the site</AlertTitle>
          <AlertDescription>
            This is one of Shopify&rsquo;s own menus. The site does not show it, so changes here will not appear anywhere. Go
            back to Menus to pick one that is shown.
          </AlertDescription>
        </Alert>
      ) : null}

      <MenuEditor menu={menu} destinations={destinations} site={isSiteMenu(menu.handle)} inAppearance={inAppearance} />
    </div>
  );
}
