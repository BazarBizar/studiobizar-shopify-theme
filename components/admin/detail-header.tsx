import { ChevronLeftIcon, EyeIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { CrumbLabel } from "@/components/admin/crumbs";
import { Badge } from "@/components/admin/ui/badge";
import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * The header for a screen showing ONE record — the standard for every record
 * screen (see docs/admin/ui-standard.md). Larger than `PageHeader` and, more
 * importantly, it carries a way back — a detail screen reached from a list is a
 * dead end without one.
 *
 * One line holds the title, its status badges and the screen's actions (View on
 * store, Open in Shopify), so no screen invents a row of its own for them. The
 * title also names the breadcrumb's last crumb.
 *
 * Left-aligned, not centred, so the title lines up with the list it came from.
 */
export function DetailHeader({
  backHref,
  backLabel,
  title,
  meta,
  status,
  actions,
  readOnly = false,
  loading = false,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  /** A short, human line under the title (an email, when it was saved). Never an id. */
  meta?: React.ReactNode;
  /** Badges beside the title: Draft, Published, New. */
  status?: React.ReactNode;
  /** Buttons on the right of the title line — outline, size sm. */
  actions?: React.ReactNode;
  readOnly?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="space-y-3">
      <CrumbLabel label={title} />
      <AppLink
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeftIcon className="size-3.5" />
        {backLabel}
      </AppLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* A skeleton rather than empty text, so the line does not collapse and
                then push the form down when the title arrives. */}
            {loading ? (
              <Skeleton className="h-8 w-64" />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            )}

            {status}

            {readOnly ? (
              <Badge variant="secondary" className="gap-1">
                <EyeIcon className="size-3" />
                View only
              </Badge>
            ) : null}
          </div>

          {meta ? <div className="text-muted-foreground mt-1 text-sm">{meta}</div> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
