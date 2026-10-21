import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/admin/detail-header";
import { MenuEditor } from "@/components/admin/menus-table/menu-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import {
  getMenu,
  listMenuDestinations,
  menuDisplayName,
  menuIdFromParam,
  menuUsedBy,
  MenuNotFoundError,
} from "@/lib/admin/menus";
import { InfoIcon } from "lucide-react";

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

  const options = await listMenuDestinations();
  const usedBy = menuUsedBy(menu.handle);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/admin/menus"
        backLabel="Menus"
        title={menuDisplayName(menu)}
        meta={usedBy ?? undefined}
      />

      {!usedBy && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Not shown on the site</AlertTitle>
          <AlertDescription>
            This is one of Shopify&rsquo;s own menus. The site does not show it, so changes
            here will not appear anywhere. Go back to Menus to pick one that is shown.
          </AlertDescription>
        </Alert>
      )}

      <MenuEditor menu={menu} options={options} />
    </div>
  );
}
