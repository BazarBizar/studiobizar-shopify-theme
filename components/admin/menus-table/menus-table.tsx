import { AppLink } from "@/components/admin/app-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { menuDisplayName, menuUsedBy, paramFromMenuId, type Menu, type MenuItemNode } from "@/lib/admin/menus";

/**
 * A plain table, like the Pages list: a handful of rows.
 *
 * "Where it shows" is what makes the screen usable: the site's menu titles were named
 * for the code, and only the place on the page tells a person which one to open. A
 * menu made here shows where Appearance puts it — `shown` holds the handles a Theme
 * Builder layout uses. Shopify's own defaults are filtered out before this.
 */
export function MenusTable({ menus, shown }: { menus: Menu[]; shown?: Set<string> }) {
  const countItems = (items: MenuItemNode[]): number => items.reduce((total, item) => total + 1 + countItems(item.items), 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Menu</TableHead>
            <TableHead>Where it shows</TableHead>
            <TableHead className="w-20 text-right">Links</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {menus.map((menu) => {
            const usedBy =
              menuUsedBy(menu.handle) ??
              (shown?.has(menu.handle) ? "In Appearance (header or footer)" : "Not shown yet — choose it in Appearance");

            return (
              <TableRow key={menu.id}>
                <TableCell>
                  <AppLink
                    href={`/admin/menus/${paramFromMenuId(menu.id)}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {menuDisplayName(menu)}
                  </AppLink>
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">{usedBy}</TableCell>

                <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                  {countItems(menu.items)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
