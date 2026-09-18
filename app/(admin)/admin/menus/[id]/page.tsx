import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/admin/detail-header";
import { MenuEditor } from "@/components/admin/menus-table/menu-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import {
  getMenu,
  listMenuDestinations,
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
        title={menu.title}
        meta={usedBy ? `${menu.handle} · ${usedBy}` : menu.handle}
      />

      {!usedBy && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Not read by this site</AlertTitle>
          <AlertDescription>
            This is one of Shopify&rsquo;s own menus. Editing it changes nothing on the
            storefront, which reads only the five menus named in{" "}
            <code>lib/navigation.ts</code>.
          </AlertDescription>
        </Alert>
      )}

      <MenuEditor menu={menu} options={options} />
    </div>
  );
}
