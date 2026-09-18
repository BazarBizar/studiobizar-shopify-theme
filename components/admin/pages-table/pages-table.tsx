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
 * The store has eleven pages and no mechanism that creates more — they come from
 * `schema-push`, one per storefront route. Sorting, faceting, column menus,
 * pagination and client-side search are all answers to a problem eleven rows do
 * not have, and every one of them would ship JavaScript to render a list that
 * fits on the screen.
 *
 * Move this to `DataTable` if pages ever become something people create freely.
 * Today that would be furniture.
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
                  <AppLink
                    href={`/admin/pages/${paramFromPageId(page.id)}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {page.title}
                  </AppLink>
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
