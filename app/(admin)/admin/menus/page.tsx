import { PageHeader } from "@/components/admin/page-header";
import { MenusTable } from "@/components/admin/menus-table/menus-table";
import { listMenus } from "@/lib/admin/menus";

export const metadata = { title: "Menus" };

/**
 * Navigation menus. A static segment, so it wins over `/admin/[slug]`; a
 * metaobject type named `menus` would be shadowed and `reservedSlug()` says so.
 */
export default async function MenusScreen() {
  const menus = await listMenus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description="The header and footer navigation. Menus are created by schema-push, because a menu exists to be read by a component that asks for it by handle — a new one would be read by nothing."
        meta={`${menus.length} menus`}
      />

      <MenusTable menus={menus} />
    </div>
  );
}
