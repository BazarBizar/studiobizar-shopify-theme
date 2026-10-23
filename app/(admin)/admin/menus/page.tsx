import { PageHeader } from "@/components/admin/page-header";
import { MenusTable } from "@/components/admin/menus-table/menus-table";
import { listMenus, siteMenus } from "@/lib/admin/menus";

export const metadata = { title: "Menus" };

/**
 * Navigation menus. A static segment, so it wins over `/admin/[slug]`; a
 * metaobject type named `menus` would be shadowed and `reservedSlug()` says so.
 */
export default async function MenusScreen() {
  const menus = siteMenus(await listMenus());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description="The links at the top and bottom of every page. Open a menu to rename, reorder, add or remove its links."
      />

      <MenusTable menus={menus} />
    </div>
  );
}
