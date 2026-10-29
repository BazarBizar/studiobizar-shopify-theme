import { CreateMenuButton } from "@/components/admin/menus-table/create-menu";
import { MenusTable } from "@/components/admin/menus-table/menus-table";
import { PageHeader } from "@/components/admin/page-header";
import { listMenus, madeMenus, menusInAppearance, siteMenus } from "@/lib/admin/menus";

export const metadata = { title: "Menus" };

/**
 * Navigation menus: the site's own five, then the ones made here. A static segment,
 * so it wins over `/admin/[slug]`; a metaobject type named `menus` would be shadowed
 * and `reservedSlug()` says so.
 */
export default async function MenusScreen() {
  const [menus, shown] = await Promise.all([listMenus(), menusInAppearance().catch(() => new Set<string>())]);
  const made = madeMenus(menus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description="The links at the top and bottom of every page. Open a menu to add, nest, reorder or remove its links."
        actions={<CreateMenuButton />}
      />

      <MenusTable menus={siteMenus(menus)} />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Your menus</h2>
          <p className="text-muted-foreground text-sm">
            Made here — for a column in the footer, a second row of links, a mega menu. Show one by choosing it in a Menu
            element under Appearance.
          </p>
        </div>
        {made.length ? (
          <MenusTable menus={made} shown={shown} />
        ) : (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            None yet. Use Create menu to make one.
          </p>
        )}
      </section>
    </div>
  );
}
