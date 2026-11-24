import { LayoutTemplateIcon, PencilIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { formatDate } from "@/lib/admin/field-values";
import { STATUS_TONE, type PageStatus } from "@/lib/admin/page-status";
import { listTemplates, type TemplateStatus } from "@/lib/admin/templates";
import { TEMPLATES } from "@/lib/page-builder/template-kinds";

export const metadata = { title: "Templates" };

const STATUS: Record<TemplateStatus, PageStatus> = {
  original: { label: "Original layout", tone: "off", hint: "Not edited yet. Visitors see the layout the site was built with." },
  draft: { label: "Not in use yet", tone: "waiting", hint: "Edited, not published. Visitors still see the original layout." },
  changes: { label: "Changes not published", tone: "waiting", hint: "In use. Your latest changes are waiting for Publish." },
  published: { label: "In use", tone: "live", hint: "Visitors see these pages drawn with this template." },
};

/**
 * Website → Templates. The pages drawn from an item — every product, collection,
 * project and designer, and the lists — have no page of their own in Pages: each kind
 * has ONE layout, edited here with the page builder, and every page of that kind
 * follows it. See `lib/page-builder/template-kinds.ts`.
 */
export default async function TemplatesScreen() {
  const rows = await listTemplates();
  const waiting = rows.filter((row) => row.status === "draft" || row.status === "changes").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="The layout of the pages that show a product, a collection, a project or a designer — and of the shop, search and list pages. Change a template once and every page of that kind follows: one layout for all product pages."
        meta={waiting ? `${waiting} waiting to be published` : undefined}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const info = TEMPLATES[row.kind];
          const status = STATUS[row.status];
          return (
            <Card key={row.kind} className="gap-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LayoutTemplateIcon className="text-muted-foreground size-4" />
                    {info.label}
                  </CardTitle>
                  <Badge variant="outline" className={STATUS_TONE[status.tone]} title={status.hint}>
                    {status.label}
                  </Badge>
                </div>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground mt-auto space-y-1 text-xs">
                <p>
                  Pages: <span className="text-foreground font-mono">{info.path}</span>
                </p>
                <p>
                  {row.sections} section{row.sections === 1 ? "" : "s"}
                  {row.savedAt ? ` · saved ${formatDate(row.savedAt, true)}` : ""}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <AppLink href={`/admin/templates/${row.kind}`}>
                    <PencilIcon />
                    Edit layout
                  </AppLink>
                </Button>
                {info.items ? (
                  <Button asChild size="sm" variant="ghost">
                    <AppLink href={info.items.href}>Edit {info.items.label.toLowerCase()}</AppLink>
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground max-w-3xl text-sm">
        A template only changes the layout. What each page shows — a product’s photos and description, a collection’s
        story — is still edited on the product or collection itself. Until a template is published, its pages keep the
        layout they have now.
      </p>
    </div>
  );
}
