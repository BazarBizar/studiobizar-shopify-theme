import { ChevronLeftIcon, EyeIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { Badge } from "@/components/admin/ui/badge";
import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * The header for a screen showing ONE record. Larger than `PageHeader` and, more
 * importantly, it carries a way back — a detail screen reached from a list is a
 * dead end without one.
 *
 * Left-aligned, not centred, so the title lines up with the list it came from.
 */
export function DetailHeader({
  backHref,
  backLabel,
  title,
  meta,
  readOnly = false,
  loading = false,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  /** Handle or id — monospace, because it is a machine identifier. */
  meta?: string;
  readOnly?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="space-y-3">
      <AppLink
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeftIcon className="size-3.5" />
        {backLabel}
      </AppLink>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {/* A skeleton rather than empty text, so the line does not collapse and
              then push the form down when the title arrives. */}
          {loading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          )}

          {readOnly ? (
            <Badge variant="secondary" className="gap-1">
              <EyeIcon className="size-3" />
              Read-only
            </Badge>
          ) : null}
        </div>

        {meta ? <p className="text-muted-foreground mt-1 font-mono text-xs">{meta}</p> : null}
      </div>
    </div>
  );
}
