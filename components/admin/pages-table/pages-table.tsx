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
import { paramFromPageId, type PageSummary } from "@/lib/admin/pages";

/**
 * A plain server-rendered table, not `DataTable`.
 *
 * The store has a couple of dozen pages: the ones `schema-push` provisions, one
 * per storefront route, plus whatever the page builder has made. Sorting,
 * faceting, column menus, pagination and client-side search are all answers to a
 * problem that many rows do not have, and every one of them would ship
 * JavaScript to render a list that fits on the screen.
 *
 * Move this to `DataTable` once builder pages run into the hundreds.
 */
export function PagesTable({
  pages,
  routeFor,
}: {
  pages: PageSummary[];
  /** Handle -> the storefront path that renders it. */
  routeFor: (handle: string) => string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>Handle</TableHead>
            <TableHead>Renders at</TableHead>
            <TableHead className="w-28">Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {pages.map((page) => {
            const route = routeFor(page.handle);

            return (
              <TableRow key={page.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AppLink
                      href={`/admin/pages/${paramFromPageId(page.id)}${page.builder ? "/builder" : ""}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {page.title}
                    </AppLink>
                    {page.builder && (
                      <Badge variant="outline" className="text-[11px] font-normal">
                        Page builder
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground font-mono text-xs">
                  {page.handle}
                </TableCell>

                <TableCell className="text-muted-foreground font-mono text-xs">
                  {route}
                </TableCell>

                <TableCell>
                  {page.isPublished ? (
                    <Badge variant="secondary">Published</Badge>
                  ) : (
                    <Badge variant="outline">Hidden</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
