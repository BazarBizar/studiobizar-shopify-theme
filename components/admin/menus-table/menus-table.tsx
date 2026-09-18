import { AppLink } from "@/components/admin/app-link";
import { Badge } from "@/components/admin/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { menuUsedBy, paramFromMenuId, type Menu } from "@/lib/admin/menus";

/**
 * A plain table, like the Pages list and for the same reason: eight rows, none
 * of which anybody creates.
 *
 * The "Used by" column is what makes the screen usable. Shopify's own defaults
 * sit alongside this site's five menus and look identical; without saying which
 * is which, the fastest way to find out is to edit the wrong one and reload the
 * storefront.
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
            <TableHead>Handle</TableHead>
            <TableHead>Used by</TableHead>
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
                    {menu.title}
                  </AppLink>
                </TableCell>

                <TableCell className="text-muted-foreground font-mono text-xs">
                  {menu.handle}
                </TableCell>

                <TableCell className="text-muted-foreground text-xs">
                  {usedBy ?? (
                    <Badge variant="outline" className="font-normal">
                      Shopify default — not read by this site
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
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
