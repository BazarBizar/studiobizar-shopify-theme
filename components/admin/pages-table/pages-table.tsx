import { ExternalLinkIcon, PencilIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { Button } from "@/components/admin/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { formatDate } from "@/lib/admin/field-values";
import type { PageRow } from "@/lib/admin/page-builder";

import { PageStatusBadge } from "./page-editor-bar";
import { paramFromPageId } from "@/lib/admin/pages";

/**
 * Pages — the one list of the site's pages.
 *
 * Two questions, two columns, never one word for both:
 *  - **Visibility**: can visitors reach the page at all (Shopify's own switch).
 *  - **Content**: is what the page shows up to date with what was last edited.
 *
 * Each row offers the page's two tabs: Content (the page builder) and Settings.
 * A page whose layout is code has Settings only.
 *
 * A server-rendered table, not `DataTable`: a couple of dozen rows need no
 * client-side sorting or paging. Work still to do is sorted to the top.
 */

// The status words and colours are shared with the page editor's bar — see `lib/admin/page-status.ts`.

export function PagesTable({ pages, routeFor }: { pages: PageRow[]; routeFor: (handle: string) => string }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Last edited</TableHead>
            <TableHead className="w-0 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {pages.map((page) => {
            const param = paramFromPageId(page.id);
            const route = routeFor(page.handle);
            const primary = page.editable ? `/admin/pages/${param}/content` : `/admin/pages/${param}`;

            return (
              <TableRow key={page.id}>
                <TableCell>
                  <AppLink href={primary} className="font-medium underline-offset-4 hover:underline">
                    {page.title}
                  </AppLink>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {page.isPublished ? (
                      <a
                        href={route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      >
                        {route}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : (
                      route
                    )}
                  </p>
                </TableCell>

                <TableCell className="max-w-64">
                  <PageStatusBadge isPublished={page.isPublished} content={page.status} showHint />
                </TableCell>

                <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                  {page.savedAt ? (
                    <>
                      {formatDate(page.savedAt, true)}
                      {page.savedBy && (
                        <span className="block max-w-48 truncate">
                          {page.savedBy.replace(/\s*\(migration\)$/, "")}
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {page.editable && (
                      <Button asChild variant="outline" size="sm">
                        <AppLink href={`/admin/pages/${param}/content`}>
                          {page.status === "setup" ? <PlusIcon /> : <PencilIcon />}
                          Edit content
                        </AppLink>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <AppLink href={`/admin/pages/${param}`} aria-label={`Settings for ${page.title}`}>
                        <SettingsIcon />
                        <span className="hidden sm:inline">{page.editable ? "Settings" : "Edit"}</span>
                      </AppLink>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
