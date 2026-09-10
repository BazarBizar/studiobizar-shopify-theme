import { ArrowRightIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

/**
 * One KPI. Four of these, not a bar chart: four numbers are four numbers, and a chart for
 * them just produces four bars each needing its own label back.
 */
export function StatTile({
  label,
  href,
  icon,
  tint,
  value,
  detail,
  note,
  attention,
  loading = false,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** A series colour class from `lib/admin/series-colors.ts`. */
  tint: string;
  value: number;
  detail?: string;
  note?: string;
  /** A SENTENCE, never a bare coloured dot. */
  attention?: string;
  loading?: boolean;
}) {
  return (
    <Card className="group hover:border-foreground/20 relative gap-0 py-4 transition-colors">
      <CardContent className="space-y-2 px-4">
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", tint)}>{icon}</span>

          {/* `after:absolute after:inset-0` makes the whole card clickable while the
              markup stays one link with a real accessible name — wrapping the Card in an
              <a> would nest interactive content and lose that. */}
          <AppLink
            href={href}
            showPending={false}
            className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium after:absolute after:inset-0 focus-visible:outline-none"
          >
            {label}
          </AppLink>

          <ArrowRightIcon className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>

        {/* No `tabular-nums`: this is a display number standing alone, not a column. Tabular
            widths make a figure like 4 sit in a puddle of its own spacing. */}
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
        )}

        <div className="space-y-1">
          {detail ? <p className="text-muted-foreground text-xs">{detail}</p> : null}
          {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
          {attention ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              {attention}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
