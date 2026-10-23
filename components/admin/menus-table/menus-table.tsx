import { AppLink } from "@/components/admin/app-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { menuDisplayName, menuUsedBy, paramFromMenuId, type Menu } from "@/lib/admin/menus";

/**
 * A plain table, like the Pages list and for the same reason: eight rows, none
 * of which anybody creates.
 *
 * "Where it shows" is what makes the screen usable: the menu titles were named for
 * the code, and only the place on the page tells a person which one to open.
 * Shopify's own defaults are filtered out before this — see `siteMenus`.
 */
export function MenusTable({ menus }: { menus: Menu[] }) {
  const countItems = (menu: Menu) =>
    menu.items.length + menu.items.reduce((total, item) => total + item.items.length, 0);

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
            const usedBy = menuUsedBy(menu.handle);

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
                  {countItems(menu)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
